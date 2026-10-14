import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, normalizeConfig } from './configuration';

afterEach(() => vi.unstubAllGlobals());

describe('runtime theme configuration', () => {
  it('supplies defaults and bounds polling and history limits', () => {
    expect(
      normalizeConfig({ refreshInterval: 100, historyLimit: 1000 }),
    ).toMatchObject({
      endpoint: '/json/stats.json',
      refreshInterval: 1000,
      historyLimit: 600,
      defaultTheme: 'light',
    });
  });

  it('rejects malformed settings instead of silently using the wrong endpoint', () => {
    for (const value of [
      null,
      [],
      { endpoint: 123 },
      { defaultTheme: 'auto' },
      { refreshInterval: -1 },
      { nodeArt: { node: 'invalid' } },
    ]) {
      expect(() => normalizeConfig(value)).toThrow(/theme-config.json/);
    }
  });

  it('fetches the replaceable JSON at runtime without caching', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ title: 'Docker override' })),
      );
    vi.stubGlobal('fetch', fetch);
    expect((await loadConfig()).title).toBe('Docker override');
    expect(fetch).toHaveBeenCalledWith(
      '/theme-config.json',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('reports missing files, invalid JSON, and network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 404 })),
    );
    await expect(loadConfig()).rejects.toThrow(/HTTP 404/);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('invalid')));
    await expect(loadConfig()).rejects.toThrow(/invalid JSON/);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Network error')),
    );
    await expect(loadConfig()).rejects.toThrow(/Unable to fetch/);
  });
});
