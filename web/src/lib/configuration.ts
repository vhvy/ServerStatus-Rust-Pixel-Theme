import type { NodeArt, ThemeConfig } from '../types';

export function normalizeConfig(value: unknown): ThemeConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('theme-config.json must contain a JSON object.');
  }
  const options = value as Record<string, unknown>;
  function text(key: string, fallback: string): string {
    const value = options[key];
    if (value === undefined || value === '') return fallback;
    if (typeof value !== 'string')
      throw new Error(`theme-config.json: ${key} must be a string.`);
    return value;
  }
  function number(key: string, fallback: number, minimum: number): number {
    const value = options[key];
    if (value === undefined) return fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error(`theme-config.json: ${key} must be a positive number.`);
    }
    return Math.max(minimum, value);
  }
  const defaultTheme = text('defaultTheme', 'light');
  if (defaultTheme !== 'light' && defaultTheme !== 'dark') {
    throw new Error('theme-config.json: defaultTheme must be light or dark.');
  }
  const nodeArt: Record<string, NodeArt> = {};
  if (options.nodeArt !== undefined) {
    if (
      !options.nodeArt ||
      typeof options.nodeArt !== 'object' ||
      Array.isArray(options.nodeArt)
    ) {
      throw new Error('theme-config.json: nodeArt must be an object.');
    }
    for (const [name, art] of Object.entries(options.nodeArt)) {
      if (art !== 'compute' && art !== 'storage' && art !== 'router') {
        throw new Error(`theme-config.json: invalid nodeArt for ${name}.`);
      }
      nodeArt[name] = art;
    }
  }
  return {
    title: text('title', 'Pixel Status'),
    defaultTheme,
    endpoint: text('endpoint', '/json/stats.json'),
    refreshInterval: number('refreshInterval', 5000, 1000),
    staleAfter: number('staleAfter', 30, 10),
    requestTimeout: number('requestTimeout', 8000, 1000),
    historyLimit: Math.min(600, Math.floor(number('historyLimit', 60, 2))),
    nodeArt,
  };
}

export async function loadConfig(): Promise<ThemeConfig> {
  let response: Response;
  try {
    // This is a runtime request, never a JSON import into the compiled bundle.
    response = await fetch(`${import.meta.env.BASE_URL}theme-config.json`, {
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new Error(
      'Unable to fetch theme-config.json. Check the file and connection.',
    );
  }
  if (!response.ok)
    throw new Error('theme-config.json returned HTTP ' + response.status);
  let options: unknown;
  try {
    options = await response.json();
  } catch {
    throw new Error('theme-config.json contains invalid JSON.');
  }
  return normalizeConfig(options);
}
