export interface PlaceSearchCenter {
  latitude: number;
  longitude: number;
}

export interface PlaceSearchResult {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
  type: string;
}

interface NominatimResult {
  place_id: number;
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  display_name: string;
  category?: string;
  type?: string;
  namedetails?: Record<string, string>;
}

interface PlaceAlias {
  name: string;
  searchQuery: string;
  aliases?: string[];
}

const SEARCH_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const REVERSE_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const resultCache = new Map<string, PlaceSearchResult[]>();

const COMMON_PLACE_ALIASES: PlaceAlias[] = [
  { name: "McDonald's", searchQuery: "McDonald's fast food", aliases: ['mcdonald', 'mcdonalds'] },
  { name: "Dunkin'", searchQuery: "Dunkin' cafe", aliases: ['dunkin', 'dunkindonuts'] },
  { name: "Wendy's", searchQuery: "Wendy's fast food", aliases: ['wendy', 'wendys'] },
  { name: 'Chick-fil-A', searchQuery: 'Chick-fil-A fast food', aliases: ['chickfila', 'chicfila'] },
  { name: "Trader Joe's", searchQuery: "Trader Joe's supermarket", aliases: ['traderjoes'] },
  { name: 'Whole Foods Market', searchQuery: 'Whole Foods Market supermarket', aliases: ['wholefoods'] },
  { name: 'Shake Shack', searchQuery: 'Shake Shack fast food' },
  { name: 'Burger King', searchQuery: 'Burger King fast food' },
  { name: 'Taco Bell', searchQuery: 'Taco Bell fast food' },
  { name: 'Starbucks', searchQuery: 'Starbucks cafe' },
  { name: 'Chipotle', searchQuery: 'Chipotle fast food' },
  { name: 'Popeyes', searchQuery: 'Popeyes fast food' },
  { name: 'Subway', searchQuery: 'Subway fast food' },
  { name: 'CVS Pharmacy', searchQuery: 'CVS Pharmacy' },
  { name: 'Walgreens', searchQuery: 'Walgreens pharmacy' },
];

const VENUE_TYPES = new Set([
  'restaurant',
  'cafe',
  'fast_food',
  'bar',
  'pub',
  'supermarket',
  'convenience',
  'department_store',
  'mall',
  'pharmacy',
  'library',
  'cinema',
  'hotel',
]);
const DESTINATION_TYPES = new Set(['city', 'town', 'village', 'borough', 'suburb', 'municipality', 'administrative']);

export function buildPlaceSearchUrl(query: string, center?: PlaceSearchCenter, nearbyOnly = false): string {
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set('q', query.trim());
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('namedetails', '1');
  url.searchParams.set('limit', '12');
  url.searchParams.set('countrycodes', 'us');
  url.searchParams.set('layer', 'poi,address');
  url.searchParams.set('accept-language', 'en');

  if (center) {
    const left = center.longitude - 0.15;
    const top = center.latitude + 0.12;
    const right = center.longitude + 0.15;
    const bottom = center.latitude - 0.12;
    url.searchParams.set('viewbox', `${left},${top},${right},${bottom}`);
    url.searchParams.set('bounded', nearbyOnly ? '1' : '0');
  }

  return url.toString();
}

export function normalizePlaceQuery(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildSmartPlaceQuery(query: string): string {
  const normalized = normalizePlaceQuery(query);
  const compact = normalized.replace(/\s/g, '');
  if (compact.length < 4) return query.trim();

  const alias = COMMON_PLACE_ALIASES.find((candidate) => {
    const names = [candidate.name, ...(candidate.aliases ?? [])].map((name) => normalizePlaceQuery(name).replace(/\s/g, ''));
    return names.some((name) => {
      const prefixMatch = compact.length >= 5 && name.startsWith(compact) && name.length - compact.length <= 3;
      return compact === name || prefixMatch || editDistance(compact, name) <= typoAllowance(name.length);
    });
  });

  return alias?.searchQuery ?? query.trim();
}

export function rankPlaceSearchResults(
  query: string,
  results: PlaceSearchResult[],
  center?: PlaceSearchCenter,
): PlaceSearchResult[] {
  const normalizedQuery = normalizePlaceQuery(query);
  const deduped = new Map<string, PlaceSearchResult>();
  for (const result of results) {
    const key = `${normalizePlaceQuery(result.name)}|${result.latitude.toFixed(4)}|${result.longitude.toFixed(4)}`;
    if (!deduped.has(key)) deduped.set(key, result);
  }

  const uniqueResults = [...deduped.values()];
  const nearbyResults = center
    ? uniqueResults.filter(
        (result) => distanceKm(center.latitude, center.longitude, result.latitude, result.longitude) <= 80,
      )
    : uniqueResults;
  const explicitDistantAddress = /,|\b\d{5}(?:-\d{4})?\b/.test(query);
  const distantDestinations = center
    ? uniqueResults.filter(
        (result) =>
          !nearbyResults.includes(result) &&
          (explicitDistantAddress ||
            (DESTINATION_TYPES.has(result.type) && normalizePlaceQuery(result.name) === normalizedQuery)),
      )
    : [];
  const eligibleResults = center ? [...nearbyResults, ...distantDestinations] : uniqueResults;

  return eligibleResults
    .map((result) => ({ result, score: placeResultScore(normalizedQuery, result, center) }))
    .sort((a, b) => b.score - a.score || a.result.name.localeCompare(b.result.name))
    .map(({ result }) => result)
    .slice(0, 8);
}

export function mapNominatimResult(result: NominatimResult): PlaceSearchResult | undefined {
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !result.display_name) {
    return undefined;
  }

  const parts = result.display_name
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const name = result.namedetails?.name?.trim() || parts[0] || 'Unnamed place';
  const addressParts = parts[0]?.toLocaleLowerCase() === name.toLocaleLowerCase() ? parts.slice(1) : parts;

  return {
    id: result.osm_type && result.osm_id ? `osm-${result.osm_type}-${result.osm_id}` : `nominatim-${result.place_id}`,
    name,
    address: addressParts.join(', '),
    latitude,
    longitude,
    category: result.category ?? 'place',
    type: result.type ?? 'place',
  };
}

export async function searchPlaces(query: string, center?: PlaceSearchCenter): Promise<PlaceSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    throw new Error('Enter at least two characters to search places.');
  }

  const smartQuery = buildSmartPlaceQuery(trimmed);
  const cacheKey = `${normalizePlaceQuery(trimmed)}|${center?.latitude.toFixed(2) ?? ''}|${center?.longitude.toFixed(2) ?? ''}`;
  const cached = resultCache.get(cacheKey);
  if (cached) return cached;

  const response = await fetch(buildPlaceSearchUrl(smartQuery, center), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error('Place search is temporarily unavailable. You can still enter the place manually.');
  }

  const payload = (await response.json()) as NominatimResult[];
  let results = payload.map(mapNominatimResult).filter(Boolean) as PlaceSearchResult[];
  results = rankPlaceSearchResults(trimmed, results, center);
  resultCache.set(cacheKey, results);
  return results;
}

export async function findCurrentPlace(center: PlaceSearchCenter): Promise<PlaceSearchResult | undefined> {
  const cacheKey = `reverse|${center.latitude.toFixed(5)}|${center.longitude.toFixed(5)}`;
  const cached = resultCache.get(cacheKey);
  if (cached) return cached[0];

  const url = new URL(REVERSE_ENDPOINT);
  url.searchParams.set('lat', String(center.latitude));
  url.searchParams.set('lon', String(center.longitude));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('namedetails', '1');
  url.searchParams.set('zoom', '18');
  url.searchParams.set('accept-language', 'en');

  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error('We could not identify your current place. Search or enter it manually instead.');
  }
  const place = mapNominatimResult((await response.json()) as NominatimResult);
  resultCache.set(cacheKey, place ? [place] : []);
  return place;
}

function placeResultScore(query: string, result: PlaceSearchResult, center?: PlaceSearchCenter): number {
  const name = normalizePlaceQuery(result.name);
  let score = 0;
  if (name === query) score += 70;
  else if (name.startsWith(query) || query.startsWith(name)) score += 48;
  else if (name.includes(query) || query.includes(name)) score += 32;
  else score += tokenOverlap(query, name) * 24;

  if (VENUE_TYPES.has(result.type)) score += 22;
  if (result.category === 'amenity' || result.category === 'shop' || result.category === 'tourism') score += 10;
  if (result.category === 'highway' || result.type === 'road' || result.type === 'secondary' || result.type === 'primary') {
    score -= 18;
  }
  if (center) {
    const distance = distanceKm(center.latitude, center.longitude, result.latitude, result.longitude);
    score += Math.max(-30, 30 - distance * 2.5);
  }
  return score;
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(left.split(' ').filter(Boolean));
  const rightTokens = new Set(right.split(' ').filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return shared / Math.max(leftTokens.size, rightTokens.size);
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radius = 6371;
  const latitudeDelta = ((lat2 - lat1) * Math.PI) / 180;
  const longitudeDelta = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(longitudeDelta / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function typoAllowance(length: number): number {
  if (length >= 10) return 2;
  return length >= 6 ? 1 : 0;
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    for (let index = 0; index < current.length; index += 1) previous[index] = current[index];
  }
  return previous[right.length];
}
