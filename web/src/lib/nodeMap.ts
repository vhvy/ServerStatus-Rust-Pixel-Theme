import type { NodeView } from '../types';
import { labels } from './core';
import type { Geocoder } from './geography';

type Point = { x: number; y: number };
type MapStatus = 'online' | 'warn' | 'offline';
type Member = { node: NodeView; number: number; status: MapStatus };
export type MapView = Point & { width: number; height: number };
export type MapSite = Point & {
  id: string;
  label: string;
  region: string;
  center: boolean;
  members: Member[];
  status: MapStatus;
  rtt: number | null;
};
type MapRoute = { from: MapSite; to: MapSite };

// The source artwork starts at 180°W. Move the map seam to 30°W.
export const worldLandOffset = 150;

export function mapSites(nodes: NodeView[], geocode: Geocoder): MapSite[] {
  const groups = new Map<string, Omit<MapSite, 'status' | 'rtt'>>();
  nodes.forEach((node, index) => {
    const tags = labels(node.labels);
    const place = geocode(node.location, tags.map_location);
    if (!place) return;
    const x = (place.lon + 180 - worldLandOffset + 360) % 360;
    const y = 90 - place.lat;
    let group = groups.get(place.id);
    if (!group) {
      group = {
        id: place.id,
        x,
        y,
        label: place.label,
        region: place.region,
        center: false,
        members: [],
      };
      groups.set(place.id, group);
    }
    group.center ||= tags.map_center?.toLowerCase() === 'true';
    const status = !node.active
      ? 'offline'
      : node.probes.some((probe) => (probe.lossPercent ?? 0) > 20)
        ? 'warn'
        : 'online';
    group.members.push({ node, number: index + 1, status });
  });

  return [...groups.values()].map((group) => {
    const readings = group.members.flatMap(({ node }) =>
      node.probes.flatMap(({ rttMs }) => (rttMs === null ? [] : [rttMs])),
    );
    return {
      ...group,
      status: group.members.some(({ status }) => status === 'warn')
        ? 'warn'
        : group.members.some(({ status }) => status === 'online')
          ? 'online'
          : 'offline',
      rtt: readings.length
        ? Math.round(
            readings.reduce((sum, value) => sum + value, 0) / readings.length,
          )
        : null,
    };
  });
}

export function mapRoutes(sites: MapSite[]): MapRoute[] {
  const centers = sites.filter((site) => site.center);
  if (centers.length !== 1) return [];
  const from = centers[0];
  return sites
    .filter((site) => site.id !== from.id)
    .map((to) => ({ from, to }));
}

export function mapView(
  sites: MapSite[],
  aspect: number,
  world: boolean,
  routes: MapRoute[] = [],
): MapView {
  const active = sites.filter(({ status }) => status !== 'offline');
  const points = active.length
    ? [...active, ...routes.flatMap(({ from, to }) => [from, to])]
    : sites;
  if (world || !points.length) {
    const width = Math.max(360, 180 * aspect);
    const height = width / aspect;
    return { x: (360 - width) / 2, y: (180 - height) / 2, width, height };
  }

  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(
    66,
    (maxX - minX) * 1.3,
    22 * aspect,
    (maxY - minY) * 1.3 * aspect,
  );
  const height = width / aspect;
  const start = (middle: number, size: number, extent: number) =>
    size > extent
      ? (extent - size) / 2
      : Math.max(0, Math.min(extent - size, middle - size / 2));
  return {
    x: start((minX + maxX) / 2, width, 360),
    y: start((minY + maxY) / 2, height, 180),
    width,
    height,
  };
}
