import geographyUrl from '../assets/geo-index.json?url';

type Coordinate = [label: string, lat: number, lon: number];
type Locality = [...Coordinate, provinceCode: string, aliases?: string[]];
type Country = {
  point: Coordinate;
  provinces: Locality[];
  cities: Locality[];
};
type Geography = Record<string, Country>;

export type MapPlace = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  region: string;
};
export type Geocoder = (
  location: string | undefined,
  name: string | undefined,
) => MapPlace | undefined;

export function countryCode(location: string | undefined) {
  if (typeof location !== 'string') return;
  const value = location.trim().toUpperCase();
  if (value === 'UK') return 'GB';
  if (/^[A-Z]{2}$/.test(value)) return value;
  if (/^[🇦-🇿]{2}$/u.test(value)) {
    return Array.from(value, (letter) =>
      String.fromCharCode(letter.codePointAt(0)! - 0x1f1e6 + 65),
    ).join('');
  }
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function byName(places: Locality[]) {
  const names = new Map<string, Set<Locality>>();
  for (const place of places) {
    for (const name of [place[0], ...(place[4] ?? [])]) {
      const key = normalize(name);
      if (!key) continue;
      let matches = names.get(key);
      if (!matches) names.set(key, (matches = new Set()));
      matches.add(place);
    }
  }
  return names;
}

function matches(
  index: ReturnType<typeof byName>,
  key: string,
  province?: string,
) {
  const candidates = [...(index.get(key) ?? [])].filter(
    (place) => province === undefined || place[3] === province,
  );
  const primary = candidates.filter((place) => normalize(place[0]) === key);
  return primary.length ? primary : candidates;
}

export function createGeocoder(data: Geography): Geocoder {
  const placeIndexes = new Map<
    string,
    {
      provinces: ReturnType<typeof byName>;
      cities: ReturnType<typeof byName>;
    }
  >();
  return (location, name) => {
    const region = countryCode(location);
    if (!region || !Object.hasOwn(data, region)) return;
    const country = data[region];
    const result = (
      [label, lat, lon]: Coordinate | Locality,
      level: string,
    ) => ({
      id: `${region}:${level}:${lat},${lon}`,
      label,
      lat,
      lon,
      region,
    });
    if (name === undefined) {
      return result(country.point, 'country');
    }

    let index = placeIndexes.get(region);
    if (!index) {
      index = {
        provinces: byName(country.provinces),
        cities: byName(country.cities),
      };
      placeIndexes.set(region, index);
    }
    const key = normalize(name);
    const provinces = matches(index.provinces, key);
    if (provinces.length === 1) {
      return result(provinces[0], 'province');
    }
    if (provinces.length) return;

    const lookupName =
      region === 'DE' && key === 'frankfurt' ? 'frankfurtammain' : key;
    const cities = matches(index.cities, lookupName);
    if (cities.length === 1) return result(cities[0], 'city');
    const parts = name.split('.');
    if (cities.length || parts.length < 2) return;

    const [provinceName, ...cityParts] = parts;
    const scope = matches(index.provinces, normalize(provinceName));
    if (scope.length !== 1) return;
    const provinceCode = scope[0][3];
    if (!provinceCode) return;
    const cityName = normalize(cityParts.join('.'));
    const qualifiedCities = matches(index.cities, cityName, provinceCode);
    if (qualifiedCities.length === 1) return result(qualifiedCities[0], 'city');
  };
}

export async function loadGeocoder(): Promise<Geocoder> {
  const response = await fetch(geographyUrl);
  if (!response.ok)
    throw new Error('Unable to load the bundled geography index.');
  return createGeocoder((await response.json()) as Geography);
}
