import { expect, it } from 'vitest';
import data from '../assets/geo-index.json?raw';
import { describe } from './core';
import { createGeocoder } from './geography';
import { mapRoutes, mapSites, mapView } from './nodeMap';

const geocode = createGeocoder(JSON.parse(data));

it('only uses the reported country and the explicit map_location label', () => {
  const sites = mapSites(
    [
      describe({ name: 'aliyun_sh', location: 'CN' }),
      describe({
        name: 'lab',
        location: 'cn',
        labels: 'os=linux;map_location=Shaanxi',
      }),
      describe({ name: 'frankfurt', labels: 'map_location=Frankfurt' }),
      describe({ name: 'tokyo', location: '🏠', labels: 'map_location=Tokyo' }),
      describe({
        name: 'node-with-typo',
        location: 'DE',
        labels: 'map_location=Frakfurt',
      }),
    ],
    geocode,
  );
  expect(sites.map(({ label }) => label)).toEqual(['China', 'Shaanxi']);
});

it('looks up pinyin and Chinese names offline and handles locality ambiguity', () => {
  expect(geocode('CN', 'Xian')).toEqual(geocode('CN', '西安'));
  expect(geocode('CN', 'Xian')).toMatchObject({ label: 'Xi’an' });
  expect(geocode('CN', 'Shǎnxī')).toMatchObject({ label: 'Shanxi' });
  expect(geocode('CN', 'Shaanxi')).toEqual(geocode('CN', '陕西'));
  expect(geocode('CN', 'Shanghai')?.id).toContain(':province:');
  expect(geocode('🇩🇪', 'Frankfurt')).toMatchObject({
    label: 'Frankfurt am Main',
  });
  expect(geocode('US', 'Springfield')).toBeUndefined();
  expect(geocode('US', 'Missouri.Springfield')).toMatchObject({
    label: 'Springfield',
    lon: -93.298,
  });
});

it('groups colocated nodes, excludes timeouts and offline samples, and marks high loss', () => {
  const sites = mapSites(
    [
      describe({
        name: 'node-a',
        location: 'HK',
        online6: true,
        time_189: 15.4,
        ping_189: 20,
        time_10010: 22.4,
        ping_10010: 21,
        time_10086: 1000,
        ping_10086: 100,
      }),
      describe({
        name: 'node-b',
        location: 'HK',
        online4: false,
        time_189: 1000,
        ping_189: 0,
      }),
    ],
    geocode,
  );
  expect(sites).toHaveLength(1);
  expect(sites[0]).toMatchObject({
    status: 'warn',
    rtt: 19,
    members: [
      { number: 1, status: 'warn' },
      { number: 2, status: 'offline' },
    ],
  });
});

it('fits active sites and expands for a cross-continent node or world mode', () => {
  const sites = mapSites(
    [
      describe({
        name: 'node-sh',
        location: 'CN',
        labels: 'map_location=Shanghai',
        online4: true,
      }),
      describe({
        name: 'node-de',
        location: 'DE',
        labels: 'map_location=Frankfurt',
        online4: true,
      }),
      describe({
        name: 'node-ny',
        location: 'US',
        labels: 'map_location=New York',
        online4: false,
      }),
    ],
    geocode,
  );
  const fitted = mapView(sites, 5, false);
  expect(fitted.x + fitted.width).toBeLessThan(sites[2].x);
  expect(fitted.x + fitted.width).toBeGreaterThan(sites[0].x);
  const world = mapView(sites, 5, true);
  expect(world.x + world.width).toBeGreaterThan(sites[2].x);
  expect(
    mapView(
      sites.map((site) => ({ ...site, status: 'online' })),
      5,
      false,
    ).width,
  ).toBeGreaterThan(fitted.width);
});

it('connects all other sites to one explicitly configured center, including offline endpoints', () => {
  const sites = mapSites(
    [
      describe({
        name: 'sh',
        location: 'CN',
        labels: 'map_location=Shanghai',
        online4: true,
      }),
      describe({
        name: 'lab',
        location: 'CN',
        labels: 'map_location=Shaanxi;map_center=true',
      }),
      describe({ name: 'hk', location: 'HK', online4: true }),
      describe({
        name: 'usa',
        location: 'US',
        labels: 'map_location=New York City',
      }),
    ],
    geocode,
  );
  const [shanghai, center, hongKong, newYork] = sites;
  expect(mapRoutes(sites)).toEqual([
    { from: center, to: shanghai },
    { from: center, to: hongKong },
    { from: center, to: newYork },
  ]);
  const fitted = mapView(sites, 5, false, mapRoutes(sites));
  expect(fitted.x).toBeLessThan(newYork.x);
  expect(mapRoutes([shanghai, hongKong, newYork])).toEqual([]);
  expect(mapRoutes([{ ...shanghai, center: true }, center, hongKong])).toEqual(
    [],
  );
});

it('places central Europe left of China and routes to Los Angeles across the Pacific', () => {
  const [frankfurt, shaanxi, losAngeles] = mapSites(
    [
      describe({
        name: 'de',
        location: 'DE',
        labels: 'map_location=Frankfurt',
      }),
      describe({
        name: 'cn',
        location: 'CN',
        labels: 'map_location=Shaanxi;map_center=true',
      }),
      describe({
        name: 'us-west',
        location: 'US',
        labels: 'map_location=Los Angeles',
      }),
    ],
    geocode,
  );
  expect(frankfurt.x).toBeLessThan(shaanxi.x);
  expect(shaanxi.x).toBeLessThan(losAngeles.x);
  expect(losAngeles.x - shaanxi.x).toBeLessThan(180);
  expect(mapRoutes([frankfurt, shaanxi, losAngeles])).toContainEqual({
    from: shaanxi,
    to: losAngeles,
  });
});
