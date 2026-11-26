"""Sample ServerStatus-Rust probe latencies and publish a bounded JSON history."""

from http.client import HTTPException
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import time
from urllib.request import urlopen


HISTORY_FILE = Path("/usr/share/nginx/html/data/ping_history.json")
PROBES = {"cu": "10010", "ct": "189", "cm": "10086"}


def positive_env(name, default):
    value = os.getenv(name, str(default))
    try:
        result = int(value)
        if result > 0:
            return result
    except ValueError:
        pass
    print(f"ping history: invalid {name}={value!r}; using {default}", file=sys.stderr)
    return default


def is_number(value):
    return type(value) in (int, float) and math.isfinite(value)


def sample(server, timestamp):
    online = server.get("online4") is True or server.get("online6") is True
    point = {"t": timestamp}
    for carrier, suffix in PROBES.items():
        latency = server.get(f"time_{suffix}")
        loss = server.get(f"ping_{suffix}")
        point[carrier] = (
            latency
            if online
            and is_number(latency)
            and is_number(loss)
            and latency >= 0
            and 0 <= loss < 100
            and (latency > 0 or loss > 0)
            else None
        )
    return point


def read_history():
    try:
        with HISTORY_FILE.open(encoding="utf-8") as stored:
            history = json.load(stored)
        if isinstance(history, dict):
            return history
    except FileNotFoundError:
        pass
    except (OSError, ValueError) as error:
        print(f"ping history: could not read history: {error}", file=sys.stderr)
    return {}


def publish(history):
    # Write on the same filesystem as the destination, including on bind mounts.
    temporary = tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=HISTORY_FILE.parent, suffix=".tmp", delete=False
    )
    path = Path(temporary.name)
    try:
        with temporary:
            json.dump(history, temporary, separators=(",", ":"), allow_nan=False)
        path.chmod(0o644)
        path.replace(HISTORY_FILE)
    finally:
        path.unlink(missing_ok=True)


def collect(url, history, max_points):
    with urlopen(url, timeout=10) as response:
        payload = json.load(response)
    servers = payload.get("servers") if isinstance(payload, dict) else None
    if not isinstance(servers, list) or any(
        not isinstance(server, dict) or not isinstance(server.get("name"), str)
        for server in servers
    ):
        raise ValueError("expected a stats.json servers array")

    timestamp = int(time.time())
    updated = {}
    for server in servers:
        name = server["name"]
        previous = history.get(name)
        if not isinstance(previous, list):
            previous = []
        points = [
            point
            for point in previous
            if isinstance(point, dict)
            and type(point.get("t")) is int
            and point["t"] < timestamp
        ]
        points.append(sample(server, timestamp))
        updated[name] = points[-max_points:]
    return updated


def main():
    url = os.getenv("STATS_URL", "http://stat_server:8080/json/stats.json")
    interval = positive_env("INTERVAL", 300)
    max_points = positive_env("MAX_POINTS", 2016)
    history = read_history()

    while True:
        started = time.monotonic()
        try:
            updated = collect(url, history, max_points)
            publish(updated)
            history = updated
        except (HTTPException, OSError, ValueError) as error:
            print(f"ping history: {error}", file=sys.stderr)
        time.sleep(max(0, interval - (time.monotonic() - started)))


if __name__ == "__main__":
    main()
