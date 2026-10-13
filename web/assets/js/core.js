(function (root) {
  'use strict';
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  const num = (value) => (finite(value) && value >= 0 ? value : null);
  const online = (server) => server.online4 === true || server.online6 === true;
  const percent = (used, total) =>
    num(used) !== null && num(total) > 0
      ? Math.min(100, Math.max(0, (used / total) * 100))
      : null;
  const cpu = (server) =>
    num(server.cpu) === null ? null : Math.min(100, server.cpu);
  const memory = (server) => percent(server.memory_used, server.memory_total);
  const disk = (server) => percent(server.hdd_used, server.hdd_total);
  function bytes(value, si = false, precision = 1) {
    if (num(value) === null) return '—';
    const base = si ? 1000 : 1024,
      units = si
        ? ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
        : ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
    let i = 0;
    while (value >= base && i < units.length - 1) {
      value /= base;
      i++;
    }
    return value.toFixed(i === 0 ? 0 : precision) + ' ' + units[i];
  }
  function month(total, baseline) {
    return num(total) === null || num(baseline) === null
      ? null
      : Math.max(0, total - baseline);
  }
  function labels(value) {
    const result = Object.create(null);
    if (typeof value !== 'string') return result;
    for (const item of value.split(';')) {
      const pos = item.indexOf('=');
      if (pos > 0)
        result[item.slice(0, pos).trim()] = item.slice(pos + 1).trim();
    }
    return result;
  }
  const locations = {
    cn: '中国',
    hk: '香港',
    tw: '台湾',
    us: '美国',
    jp: '日本',
    sg: '新加坡',
    kr: '韩国',
    de: '德国',
    gb: '英国',
    uk: '英国',
    fr: '法国',
    ca: '加拿大',
    au: '澳大利亚',
    nl: '荷兰',
    ru: '俄罗斯',
    in: '印度',
  };
  const englishLocations = {
    cn: 'China',
    hk: 'Hong Kong',
    tw: 'Taiwan',
    us: 'United States',
    jp: 'Japan',
    sg: 'Singapore',
    kr: 'South Korea',
    de: 'Germany',
    gb: 'United Kingdom',
    uk: 'United Kingdom',
    fr: 'France',
    ca: 'Canada',
    au: 'Australia',
    nl: 'Netherlands',
    ru: 'Russia',
    in: 'India',
  };
  function location(value) {
    const code = String(value || '').toLowerCase();
    return locations[code] || value || '未知地区';
  }
  function validate(data) {
    if (
      !data ||
      !Array.isArray(data.servers) ||
      !finite(data.updated) ||
      data.updated <= 0
    )
      throw new Error('接口数据格式不符合 ServerStatus-Rust 格式');
    const names = new Set();
    for (const item of data.servers) {
      if (
        !item ||
        typeof item.name !== 'string' ||
        !item.name ||
        names.has(item.name)
      )
        throw new Error('节点标识缺失或重复');
      names.add(item.name);
    }
    return data;
  }
  function aggregate(servers) {
    const active = servers.filter(online),
      cpus = active.map(cpu).filter((value) => value !== null);
    const mem = active.filter(
      (server) =>
        num(server.memory_total) > 0 && num(server.memory_used) !== null,
    );
    const used = mem.reduce((sum, server) => sum + server.memory_used, 0),
      total = mem.reduce((sum, server) => sum + server.memory_total, 0);
    return {
      online: active.length,
      offline: servers.length - active.length,
      cpu: cpus.length ? cpus.reduce((a, b) => a + b, 0) / cpus.length : null,
      memory: percent(used, total),
      memoryUsed: mem.length ? used * 1024 : null,
      memoryTotal: mem.length ? total * 1024 : null,
      rx: active.some((s) => num(s.network_rx) !== null)
        ? active.reduce((sum, s) => sum + (num(s.network_rx) ?? 0), 0)
        : null,
      tx: active.some((s) => num(s.network_tx) !== null)
        ? active.reduce((sum, s) => sum + (num(s.network_tx) ?? 0), 0)
        : null,
    };
  }
  function select(servers, filter, query, sort) {
    const q = query.trim().toLocaleLowerCase();
    const result = servers.filter(
      (s) =>
        (filter === 'all' || online(s) === (filter === 'online')) &&
        [
          s.name,
          s.alias,
          s.location,
          location(s.location),
          englishLocations[String(s.location || '').toLowerCase()],
          s.type,
          s.gid,
          s.labels,
        ].some((v) =>
          String(v ?? '')
            .toLocaleLowerCase()
            .includes(q),
        ),
    );
    if (sort === 'name')
      result.sort((a, b) =>
        (a.alias || a.name).localeCompare(b.alias || b.name),
      );
    if (['cpu', 'memory', 'traffic'].includes(sort)) {
      const value = (s) =>
        !online(s)
          ? -1
          : sort === 'cpu'
            ? (cpu(s) ?? -1)
            : sort === 'memory'
              ? (memory(s) ?? -1)
              : (num(s.network_rx) ?? 0) + (num(s.network_tx) ?? 0);
      result.sort((a, b) => value(b) - value(a));
    }
    return result;
  }
  // Presentation helpers are shared by the template and node view models.
  const format = {
    count: (value) => String(value).padStart(2, '0'),
    percent: (value) => (value === null ? '--' : Math.round(value) + '%'),
    bytes: (value, si = false) =>
      num(value) === null ? '--' : bytes(value, si),
    rate: (value, si = false) =>
      num(value) === null ? '--' : bytes(value, si) + '/s',
    time: (timestamp) =>
      timestamp > 0
        ? new Date(timestamp * 1000).toLocaleTimeString('en-GB', {
            hour12: false,
          })
        : '--:--:--',
    counter: (value) =>
      num(value) === null || value >= 4294967294
        ? '--'
        : value.toLocaleString('en-US'),
  };

  function describe(server, artOverrides = {}) {
    const tags = labels(server.labels);
    const active = online(server);
    const name = server.alias || server.name;
    const identity = server.name + ' ' + server.alias;
    const requestedArt = artOverrides[server.name];
    const kind = ['compute', 'storage', 'router'].includes(requestedArt)
      ? requestedArt
      : /router|switch|gateway/i.test(identity)
        ? 'router'
        : /nas|synology|storage/i.test(identity)
          ? 'storage'
          : 'compute';
    const memoryBytes = (value) => (num(value) === null ? null : value * 1024);
    const diskBytes = (value) =>
      num(value) === null ? null : value * (server.si ? 1000000 : 1048576);
    const remaining = (total, used) =>
      num(total) === null || num(used) === null
        ? null
        : Math.max(0, total - used);
    const traffic = (received, sent) =>
      `RX ${format.bytes(received, server.si)} / TX ${format.bytes(sent, server.si)}`;
    const cpuUsage = active ? cpu(server) : null;
    const memoryUsage = active ? memory(server) : null;
    const diskUsage = active ? disk(server) : null;
    const swapUsage = percent(server.swap_used, server.swap_total);
    const uptimeText = String(server.uptime || '--')
      .replace(/\s*天/g, 'D')
      .replace(/\s*小时/g, 'H')
      .replace(/\s*分钟/g, 'M');

    const probes = [
      ['CT', '189'],
      ['CU', '10010'],
      ['CM', '10086'],
    ].map(([carrier, key]) => {
      const time = num(server['time_' + key]);
      const loss = num(server['ping_' + key]);
      const available =
        active && time !== null && loss !== null && (time > 0 || loss > 0);
      return {
        carrier,
        latency: available
          ? loss >= 100
            ? 'TIMEOUT'
            : Math.round(time) + 'ms'
          : '--',
        loss: available ? Math.min(100, loss) + '%' : '--',
        timeout: available && loss >= 100,
        lossWarning: available && loss > 0,
      };
    });

    return {
      ...server,
      displayName: name,
      active,
      kind,
      kindLabel: {
        compute: 'COMPUTE NODE',
        storage: 'STORAGE NODE',
        router: 'NETWORK NODE',
      }[kind],
      art: './assets/' + kind + '.png',
      artAlt:
        'Pixel art illustration of a ' +
        {
          compute: 'gold compute server',
          storage: 'four-bay NAS',
          router: 'eight-port switch',
        }[kind],
      locationCode: /^[a-z]{2}$/i.test(server.location || '')
        ? server.location.toUpperCase()
        : String(server.location || 'UNKNOWN').toUpperCase(),
      platform: [tags.os || 'OS UNKNOWN', server.type || 'TYPE UNKNOWN']
        .join(' / ')
        .toUpperCase(),
      uptimeText,
      uptimeLabel: active ? 'UP ' + uptimeText : 'NODE OFFLINE',
      cpuUsage,
      memoryUsage,
      diskUsage,
      metrics: [
        { label: 'CPU', kind: 'cpu', value: cpuUsage },
        { label: 'MEM', kind: 'memory', value: memoryUsage },
        { label: 'DSK', kind: 'disk', value: diskUsage },
      ],
      loadText: [server.load_1, server.load_5, server.load_15]
        .map((value) => (num(value) === null ? '--' : value.toFixed(2)))
        .join(' / '),
      memoryAmount:
        format.bytes(memoryBytes(server.memory_used)) +
        ' / ' +
        format.bytes(memoryBytes(server.memory_total)),
      memoryUsed: format.bytes(memoryBytes(server.memory_used)),
      memoryFree: format.bytes(
        memoryBytes(remaining(server.memory_total, server.memory_used)),
      ),
      memoryFill: memory(server) ?? 0,
      swapAmount:
        num(server.swap_total) === 0
          ? 'DISABLED'
          : format.bytes(memoryBytes(server.swap_used)) +
            ' / ' +
            format.bytes(memoryBytes(server.swap_total)),
      swapFill: swapUsage ?? 0,
      processCount: format.counter(server.process_count),
      threadCount: format.counter(server.thread_count),
      connectionCount:
        format.counter(server.tcp_count) +
        ' / ' +
        format.counter(server.udp_count),
      receiveRate: active
        ? format.rate(num(server.network_rx), server.si)
        : '--',
      transmitRate: active
        ? format.rate(num(server.network_tx), server.si)
        : '--',
      totalTraffic: traffic(num(server.network_in), num(server.network_out)),
      monthTraffic: traffic(
        month(server.network_in, server.last_network_in),
        month(server.network_out, server.last_network_out),
      ),
      diskAmount:
        format.bytes(diskBytes(server.hdd_used), server.si) +
        ' / ' +
        format.bytes(diskBytes(server.hdd_total), server.si),
      diskFree: format.bytes(
        diskBytes(remaining(server.hdd_total, server.hdd_used)),
        server.si,
      ),
      usedDiskBlocks: Math.round(((disk(server) ?? 0) / 100) * 48),
      probes,
      spec: tags.spec ? 'SPEC / ' + tags.spec : 'ART / ILLUSTRATION ONLY',
      extra: [
        tags.ndd ? ['RENEWAL', tags.ndd] : null,
        server.gid ? ['GROUP', server.gid] : null,
        server.custom ? ['NOTE', server.custom] : null,
      ]
        .filter(Boolean)
        .map(([label, value]) => ({ label, value })),
    };
  }

  // Copy on update lets Vue watch the history map without deep reactive arrays.
  function appendHistory(previous, payload, config) {
    const history = new Map();
    const gapThreshold = Math.max(
      config.staleAfter,
      (config.refreshInterval / 1000) * 3,
    );

    for (const server of payload.servers) {
      const samples = [...(previous.get(server.name) || [])];
      const timestamp = num(server.latest_ts) || payload.updated;
      const last = samples[samples.length - 1];

      if (!last || timestamp > last.ts) {
        if (last && timestamp - last.ts > gapThreshold) {
          samples.push({ ts: timestamp - 1, cpu: null, rx: null, tx: null });
        }

        samples.push({
          ts: timestamp,
          cpu: online(server) ? cpu(server) : null,
          rx: online(server) ? num(server.network_rx) : null,
          tx: online(server) ? num(server.network_tx) : null,
        });
      }

      history.set(server.name, samples.slice(-config.historyLimit));
    }

    return history;
  }

  const api = {
    num,
    online,
    percent,
    cpu,
    memory,
    disk,
    bytes,
    month,
    labels,
    location,
    validate,
    aggregate,
    select,
    format,
    describe,
    appendHistory,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PixelStatus = api;
})(typeof window !== 'undefined' ? window : this);
