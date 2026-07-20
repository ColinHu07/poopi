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

const SEARCH_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const resultCache = new Map<string, PlaceSearchResult[]>();

export function buildPlaceSearchUrl(query: string, center?: PlaceSearchCenter): string {
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set('q', query.trim());
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('namedetails', '1');
  url.searchParams.set('limit', '8');
  url.searchParams.set('countrycodes', 'us');
  url.searchParams.set('layer', 'poi,address');
  url.searchParams.set('accept-language', 'en');

  if (center) {
    const left = center.longitude - 0.25;
    const top = center.latitude + 0.2;
    const right = center.longitude + 0.25;
    const bottom = center.latitude - 0.2;
    url.searchParams.set('viewbox', `${left},${top},${right},${bottom}`);
    url.searchParams.set('bounded', '0');
  }

  return url.toString();
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

  const cacheKey = `${trimmed.toLocaleLowerCase()}|${center?.latitude.toFixed(2) ?? ''}|${center?.longitude.toFixed(2) ?? ''}`;
  const cached = resultCache.get(cacheKey);
  if (cached) return cached;

  const response = await fetch(buildPlaceSearchUrl(trimmed, center), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error('Place search is temporarily unavailable. You can still enter the place manually.');
  }

  const payload = (await response.json()) as NominatimResult[];
  const results = payload.map(mapNominatimResult).filter(Boolean) as PlaceSearchResult[];
  resultCache.set(cacheKey, results);
  return results;
}
