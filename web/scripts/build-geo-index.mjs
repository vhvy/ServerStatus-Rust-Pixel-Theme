import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Merge the GeoNames cities15000 and admin tables with Natural Earth label points.
const [directory, output = 'src/assets/geo-index.json'] = process.argv.slice(2);
if (!directory) {
  throw new Error(
    'Usage: node scripts/build-geo-index.mjs <source directory> [output]',
  );
}
const read = (file) => readFileSync(join(directory, file), 'utf8');
const table = (file) =>
  read(file)
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('\t'));
const features = (file) => JSON.parse(read(file)).features;
const validCode = (code) => /^[A-Z]{2}$/.test(code);
const validPoint = (lat, lon) =>
  Number.isFinite(lat) &&
  Math.abs(lat) <= 90 &&
  Number.isFinite(lon) &&
  Math.abs(lon) <= 180;
const round = (value) => Number(value.toFixed(3));
const aliases = (label, names) => [
  ...new Set(
    names.filter(
      (name) =>
        typeof name === 'string' && name && name !== label && name !== '-99',
    ),
  ),
];
function locality(label, lat, lon, province, names) {
  const namesToKeep = aliases(label, names);
  const record = [label, round(lat), round(lon), province];
  if (namesToKeep.length) record.push(namesToKeep);
  return record;
}

const countries = new Map();
const countryNames = new Map(
  table('countryInfo.txt').map((fields) => [fields[0], fields[4]]),
);
const country = (code) => {
  if (!countries.has(code))
    countries.set(code, { point: null, provinces: [], cities: [] });
  return countries.get(code);
};
for (const { properties: area } of features('countries.geojson')) {
  const code = area.ISO_A2_EH;
  if (validCode(code) && validPoint(area.LABEL_Y, area.LABEL_X)) {
    country(code).point = [
      countryNames.get(code) || area.NAME_EN || area.NAME,
      round(area.LABEL_Y),
      round(area.LABEL_X),
    ];
  }
}

const adminNames = new Map(
  table('admin1CodesASCII.txt').map(([code, name, ascii, id]) => [
    code,
    { name, ascii, id },
  ]),
);
const adminIds = new Map([...adminNames].map(([code, { id }]) => [id, code]));
for (const { properties: area } of features('admin1-full.geojson')) {
  const code = area.iso_a2;
  if (!validCode(code) || !validPoint(area.latitude, area.longitude)) continue;
  const label = area.name_en || area.name;
  if (!label) continue;
  const idCode = adminIds.get(String(area.gn_id));
  const admin = idCode?.startsWith(code + '.') ? idCode : area.gn_a1_code;
  const adminCode = admin?.startsWith(code + '.') ? admin.slice(3) : '';
  const official = adminNames.get(admin);
  const names = [
    area.name,
    area.name_alt,
    area.name_local,
    area.gn_name,
    area.woe_name,
    area.name_zh,
    area.name_zht,
    official?.name,
    official?.ascii,
    area.postal,
    area.iso_3166_2,
  ];
  if (code === 'CN') {
    for (const chinese of [area.name_zh, area.name_zht]) {
      if (chinese) names.push(chinese.replace(/[省市]$/, ''));
    }
  }
  country(code).provinces.push(
    locality(label, area.latitude, area.longitude, adminCode, names),
  );
}

const representativeCities = new Map();
for (const fields of table('cities15000.txt')) {
  const [
    ,
    label,
    ascii,
    otherNames,
    latitude,
    longitude,
    ,
    feature,
    code,
    ,
    province,
  ] = fields;
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!label || !validCode(code) || !validPoint(lat, lon)) continue;
  const chinese = /^(CN|HK|MO|TW)$/.test(code)
    ? otherNames.split(',').filter((name) => /^[\p{Script=Han}·]+$/u.test(name))
    : [];
  const names = [
    ascii,
    ...chinese,
    ...chinese.map((name) => name.replace(/市$/, '')),
  ];
  country(code).cities.push(locality(label, lat, lon, province, names));
  const rank = Number(fields[14]) + (feature === 'PPLC' ? 1e9 : 0);
  if (rank > (representativeCities.get(code)?.rank ?? -1)) {
    representativeCities.set(code, { lat, lon, rank, label });
  }
}
for (const [code, entry] of countries) {
  const city = representativeCities.get(code);
  if (!entry.point && city) {
    entry.point = [
      countryNames.get(code) || city.label,
      round(city.lat),
      round(city.lon),
    ];
  }
  if (!entry.point) countries.delete(code);
}
const rows = [...countries]
  .sort()
  .map(([code, entry]) => `  "${code}":${JSON.stringify(entry)}`);
writeFileSync(output, '{\n' + rows.join(',\n') + '\n}\n');
