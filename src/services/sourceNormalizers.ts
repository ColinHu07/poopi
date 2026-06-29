import type { AccessType, Bathroom, FeatureTag, SourceRef } from '@/src/data/types';

export interface RefugeRestroom {
  id: number;
  name: string;
  street: string;
  city: string;
  state: string;
  accessible: boolean;
  unisex: boolean;
  directions: string;
  comment: string;
  latitude: number;
  longitude: number;
  updated_at: string;
  downvote: number;
  upvote: number;
  country: string;
  changing_table: boolean;
  approved: boolean;
}

export interface OsmToiletElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function normalizeRefugeRestroom(record: RefugeRestroom): Bathroom {
  const features: FeatureTag[] = [];
  if (record.accessible) {
    features.push('wheelchair_accessible');
  }
  if (record.unisex) {
    features.push('all_gender', 'single_stall');
  }
  if (record.changing_table) {
    features.push('baby_changing');
  }

  const confidence = confidenceFromVotes(record.upvote, record.downvote, record.approved ? 0.68 : 0.35);

  return {
    id: `refuge-${record.id}`,
    name: record.name || 'Unnamed restroom',
    kind: 'Community restroom',
    address: [record.street, record.city, record.state].filter(Boolean).join(', '),
    neighborhood: record.city,
    city: record.city,
    latitude: record.latitude,
    longitude: record.longitude,
    access: 'unknown',
    priceNote: 'Community reported',
    openingHours: 'Unknown',
    isOpenNow: true,
    confidence,
    features,
    directionsNote: [record.directions, record.comment].filter(Boolean).join(' '),
    sourceRefs: [
      sourceRef({
        sourceName: 'refuge',
        sourceId: String(record.id),
        fetchedAt: record.updated_at,
        license: 'Refuge Restrooms API',
        confidence,
        confirmedByUsers: record.upvote,
        contradictedByUsers: record.downvote,
      }),
    ],
    photos: [],
    reportsSummary: {},
    scores: { community: 6, confidence, recommendation: 0.5 },
    userStatus: 'unvisited',
    lastConfirmedAt: record.updated_at,
  };
}

export function normalizeOsmToilet(element: OsmToiletElement): Bathroom {
  const tags = element.tags ?? {};
  const lat = element.lat ?? element.center?.lat ?? 0;
  const lon = element.lon ?? element.center?.lon ?? 0;
  const features = featuresFromOsmTags(tags);
  const access = accessFromOsmTags(tags);
  const confidence = tags.check_date ? 0.78 : 0.62;

  return {
    id: `osm-${element.type}-${element.id}`,
    name: tags.name ?? tags.operator ?? 'Mapped restroom',
    kind: tags.amenity === 'toilets' ? 'Mapped public toilet' : 'Mapped restroom',
    address: tags['addr:full'] ?? [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    neighborhood: tags['addr:suburb'] ?? '',
    city: tags['addr:city'] ?? '',
    latitude: lat,
    longitude: lon,
    access,
    priceNote: tags.fee === 'yes' ? 'Fee reported' : tags.fee === 'no' ? 'Free' : 'Unknown',
    openingHours: tags.opening_hours ?? 'Unknown',
    isOpenNow: tags.opening_hours !== 'closed',
    confidence,
    features,
    directionsNote: tags.description ?? tags.note ?? '',
    sourceRefs: [
      sourceRef({
        sourceName: 'osm',
        sourceId: `${element.type}/${element.id}`,
        fetchedAt: new Date().toISOString(),
        license: 'Open Database License',
        confidence,
        confirmedByUsers: tags.check_date ? 1 : 0,
        contradictedByUsers: 0,
      }),
    ],
    photos: [],
    reportsSummary: {},
    scores: { community: 6, confidence, recommendation: 0.5 },
    userStatus: 'unvisited',
    lastConfirmedAt: tags.check_date ?? new Date().toISOString(),
  };
}

function featuresFromOsmTags(tags: Record<string, string>): FeatureTag[] {
  const features = new Set<FeatureTag>();
  if (truthy(tags.wheelchair) || truthy(tags['toilets:wheelchair'])) {
    features.add('wheelchair_accessible');
    features.add('step_free');
  }
  if (truthy(tags.changing_table) || truthy(tags['toilets:changing_table'])) {
    features.add('baby_changing');
  }
  if (truthy(tags['toilets:unisex']) || tags.gender_neutral === 'yes') {
    features.add('all_gender');
  }
  if (tags['toilets:position'] === 'seated' || tags['toilets:number'] === '1') {
    features.add('single_stall');
  }
  if (truthy(tags.fee) || tags.fee === 'no') {
    features.add(tags.fee === 'no' ? 'safe' : 'lock_works');
  }
  return [...features];
}

function accessFromOsmTags(tags: Record<string, string>): AccessType {
  if (tags.fee === 'yes') {
    return 'paid';
  }
  if (tags.access === 'customers') {
    return 'customers_only';
  }
  if (tags.access === 'private') {
    return 'members_only';
  }
  if (tags.access === 'yes' || tags.access === 'permissive' || tags.fee === 'no') {
    return 'public';
  }
  return 'unknown';
}

function truthy(value: string | undefined): boolean {
  return value === 'yes' || value === 'true' || value === '1' || value === 'limited';
}

function confidenceFromVotes(upvote: number, downvote: number, base: number): number {
  const totalVotes = upvote + downvote;
  if (totalVotes === 0) {
    return base;
  }
  const voteScore = upvote / totalVotes;
  return Math.round((base * 0.55 + voteScore * 0.45) * 100) / 100;
}

function sourceRef(ref: SourceRef): SourceRef {
  return ref;
}
