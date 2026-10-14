import type { aggregate, describe } from './lib/core';

export type Theme = 'light' | 'dark';
export type NodeArt = 'compute' | 'storage' | 'router';
export type StatusFilter = 'all' | 'online' | 'offline';
export type NodeSort = 'default' | 'name' | 'cpu' | 'memory' | 'traffic';

export interface ThemeConfig {
  title: string;
  defaultTheme: Theme;
  endpoint: string;
  refreshInterval: number;
  staleAfter: number;
  requestTimeout: number;
  historyLimit: number;
  nodeArt: Record<string, NodeArt>;
}

type ProbeField =
  `time_${'189' | '10010' | '10086'}` | `ping_${'189' | '10010' | '10086'}`;
export interface NodeReport extends Partial<Record<ProbeField, number | null>> {
  name: string;
  alias?: string;
  type?: string;
  location?: string;
  labels?: string;
  gid?: string;
  custom?: string;
  uptime?: string;
  online4?: boolean;
  online6?: boolean;
  si?: boolean;
  cpu?: number | null;
  memory_total?: number | null;
  memory_used?: number | null;
  swap_total?: number | null;
  swap_used?: number | null;
  hdd_total?: number | null;
  hdd_used?: number | null;
  network_rx?: number | null;
  network_tx?: number | null;
  network_in?: number | null;
  network_out?: number | null;
  last_network_in?: number | null;
  last_network_out?: number | null;
  latest_ts?: number | null;
  load_1?: number | null;
  load_5?: number | null;
  load_15?: number | null;
  process_count?: number | null;
  thread_count?: number | null;
  tcp_count?: number | null;
  udp_count?: number | null;
}

export interface StatsPayload {
  updated: number;
  servers: NodeReport[];
}

export interface HistorySample {
  ts: number;
  cpu: number | null;
  rx: number | null;
  tx: number | null;
}

export interface EmptyState {
  title: string;
  message: string;
}

export type NodeView = ReturnType<typeof describe>;
export type FleetSummary = ReturnType<typeof aggregate>;
