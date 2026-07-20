export type CandidateAccess =
  | 'public'
  | 'customers_only'
  | 'purchase_required'
  | 'paid'
  | 'code_required'
  | 'staff_permission'
  | 'members_only'
  | 'unknown';

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

export interface ExternalBathroomCandidate {
  externalId: string;
  sourceName: 'refuge' | 'osm';
  sourceId: string;
  fetchedAt: string;
  license: string;
  name: string;
  kind: string;
  address: string;
  neighborhood: string;
  city: string;
  latitude: number;
  longitude: number;
  access: CandidateAccess;
  feeRequired?: boolean;
  priceNote: string;
  openingHours: string;
  confidence: number;
  directionsNote: string;
  lastConfirmedAt?: string;
  confirmedByUsers: number;
  contradictedByUsers: number;
  features: string[];
}

export function normalizeRefugeCandidate(
  record: RefugeRestroom,
  fetchedAt = new Date().toISOString(),
): ExternalBathroomCandidate {
  const features = new Set<string>();
  if (record.accessible) features.add('wheelchair_accessible');
  if (record.unisex) {
    features.add('all_gender');
    features.add('single_stall');
  }
  if (record.changing_table) features.add('baby_changing');
  const confidence = confidenceFromVotes(record.upvote, record.downvote, record.approved ? 0.68 : 0.35);

  return {
    externalId: `refuge-${record.id}`,
    sourceName: 'refuge',
    sourceId: String(record.id),
    fetchedAt,
    license: 'Refuge Restrooms API',
    name: record.name || 'Unnamed restroom',
    kind: 'Community restroom',
    address: [record.street, record.city, record.state].filter(Boolean).join(', '),
    neighborhood: record.city || '',
    city: record.city || '',
    latitude: record.latitude,
    longitude: record.longitude,
    access: 'unknown',
    priceNote: 'Unknown',
    openingHours: 'Unknown',
    confidence,
    directionsNote: [record.directions, record.comment].filter(Boolean).join(' '),
    // Refuge updated_at is source metadata, not a recent bathroom observation.
    lastConfirmedAt: undefined,
    confirmedByUsers: Math.max(record.upvote, 0),
    contradictedByUsers: Math.max(record.downvote, 0),
    features: [...features],
  };
}

export function normalizeOsmCandidate(
  element: OsmToiletElement,
  fetchedAt = new Date().toISOString(),
): ExternalBathroomCandidate {
  const tags = element.tags ?? {};
  const latitude = element.lat ?? element.center?.lat ?? 0;
  const longitude = element.lon ?? element.center?.lon ?? 0;
  const feeRequired = tags.fee === 'yes' ? true : tags.fee === 'no' ? false : undefined;
  const access = accessFromOsmTags(tags);
  const confidence = tags.check_date ? 0.78 : 0.62;

  return {
    externalId: `osm-${element.type}-${element.id}`,
    sourceName: 'osm',
    sourceId: `${element.type}/${element.id}`,
    fetchedAt,
    license: 'OpenStreetMap contributors, ODbL',
    name: tags.name ?? tags.operator ?? 'Mapped restroom',
    kind: 'Mapped public toilet',
    address: tags['addr:full'] ?? [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    neighborhood: tags['addr:suburb'] ?? '',
    city: tags['addr:city'] ?? '',
    latitude,
    longitude,
    access,
    feeRequired,
    priceNote: feeRequired === true ? 'Fee reported' : feeRequired === false ? 'Free' : 'Unknown',
    openingHours: tags.opening_hours ?? 'Unknown',
    confidence,
    directionsNote: tags.description ?? tags.note ?? '',
    lastConfirmedAt: validCheckDate(tags.check_date),
    confirmedByUsers: tags.check_date ? 1 : 0,
    contradictedByUsers: 0,
    features: featuresFromOsmTags(tags),
  };
}

function featuresFromOsmTags(tags: Record<string, string>) {
  const features = new Set<string>();
  if (truthy(tags.wheelchair) || truthy(tags['toilets:wheelchair'])) {
    features.add('wheelchair_accessible');
    features.add('step_free');
  }
  if (truthy(tags.changing_table) || truthy(tags['toilets:changing_table'])) features.add('baby_changing');
  if (truthy(tags['toilets:unisex']) || tags.gender_neutral === 'yes') features.add('all_gender');
  if (tags['toilets:position'] === 'seated' || tags['toilets:number'] === '1') features.add('single_stall');
  return [...features];
}

function accessFromOsmTags(tags: Record<string, string>): CandidateAccess {
  if (tags.access === 'customers') return 'customers_only';
  if (tags.access === 'private') return 'members_only';
  if (tags.access === 'yes' || tags.access === 'permissive') return 'public';
  if (tags.fee === 'yes') return 'paid';
  return 'unknown';
}

function validCheckDate(value: string | undefined) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
}

function truthy(value: string | undefined) {
  return value === 'yes' || value === 'true' || value === '1' || value === 'limited';
}

function confidenceFromVotes(upvote: number, downvote: number, base: number) {
  const safeUpvotes = Math.max(upvote, 0);
  const safeDownvotes = Math.max(downvote, 0);
  const totalVotes = safeUpvotes + safeDownvotes;
  if (totalVotes === 0) return base;
  return Math.round((base * 0.55 + (safeUpvotes / totalVotes) * 0.45) * 100) / 100;
}
