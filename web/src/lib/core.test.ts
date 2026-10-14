import { describe as suite, expect, it } from 'vitest';
import { aggregate, appendHistory, describe, select, validate } from './core';
import { normalizeConfig } from './configuration';
import type { NodeReport } from '../types';

suite('node reports', () => {
  it('rejects missing or duplicate node identities', () => {
    expect(() =>
      validate({ updated: 1, servers: [{ name: 'same' }, { name: 'same' }] }),
    ).toThrow();
    expect(() => validate({ updated: 1, servers: [null] })).toThrow();
    expect(() => validate({ updated: 1, servers: [{ name: '' }] })).toThrow();
  });

  it('aggregates only online nodes and weights memory by capacity', () => {
    const nodes: NodeReport[] = [
      {
        name: 'small',
        online4: true,
        cpu: 20,
        memory_total: 100,
        memory_used: 50,
      },
      {
        name: 'large',
        online6: true,
        cpu: 40,
        memory_total: 300,
        memory_used: 150,
      },
      { name: 'offline', cpu: 100, memory_total: 1000, memory_used: 1000 },
    ];
    expect(aggregate(nodes)).toMatchObject({
      online: 2,
      offline: 1,
      cpu: 30,
      memory: 50,
    });
    expect(describe(nodes[2]!).cpuUsage).toBeNull();
  });

  it('searches raw location codes without country-name aliases', () => {
    const nodes: NodeReport[] = [
      { name: 'node', location: 'cn', online4: true },
    ];
    expect(select(nodes, 'all', 'CN', 'default')).toHaveLength(1);
    expect(select(nodes, 'all', 'China', 'default')).toHaveLength(0);
    expect(select(nodes, 'all', '中国', 'default')).toHaveLength(0);
  });

  it('preserves history gaps and does not duplicate repeated reports', () => {
    const config = normalizeConfig({ historyLimit: 3 });
    const first = {
      updated: 100,
      servers: [{ name: 'node', online4: true, cpu: 20 }],
    };
    const history = appendHistory(new Map(), first, config);
    expect(appendHistory(history, first, config).get('node')).toHaveLength(1);
    const next = appendHistory(history, { ...first, updated: 200 }, config).get(
      'node',
    );
    expect(next).toHaveLength(3);
    expect(next?.[1]).toMatchObject({ cpu: null, rx: null, tx: null });
  });
});
