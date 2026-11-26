#!/bin/sh
set -eu

if [ "${ENABLE_PING_HISTORY:-true}" = "true" ]; then
    if mkdir -p /usr/share/nginx/html/data; then
        python3 /opt/ServerStatus/collector.py &
    fi
fi
