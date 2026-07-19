import type {
  AccessType,
  Bathroom,
  BathroomFilters,
  BathroomList,
  BathroomPhoto,
  FeatureTag,
  FeedItem,
  ReportReason,
  Sentiment,
  SourceRef,
  UserRating,
  Visit,
} from '@/src/data/types';
import {
  applyEloComparison,
  rankCommunityComparisons,
  recommendationScore,
  scoreMapFromRatings,
  sortRatings,
} from '@/src/lib/ranking';
import { getCurrentProfile } from '@/src/services/auth';
import { normalizeRefugeRestroom, type RefugeRestroom } from '@/src/services/sourceNormalizers';
import { getOrCreateRatingUser, isSupabaseConfigured, requireSupabase, supabase } from '@/src/services/supabase';

export const DEFAULT_MAP_CENTER = {
  latitude: 40.7536,
  longitude: -73.9832,
};

export interface NearbyBathroomInput {
  latitude: number;
  longitude: number;
  filters?: BathroomFilters;
}

export interface ProfileSummary {
  displayName: string;
  handle: string;
  city: string;
  rankedCount: number;
  visitedCount: number;
  listsCount: number;
  confidenceBoosts: number;
  favoriteTags: FeatureTag[];
}

type SupabaseBathroomRow = {
  id: string;
  name: string;
  kind: string;
  address: string;
  neighborhood: string;
  city: string;
  latitude?: number;
  longitude?: number;
  access: AccessType;
  price_note: string;
  opening_hours: string;
  confidence: number;
  directions_note: string;
  last_confirmed_at: string | null;
  features?: FeatureTag[];
  source_refs?: SourceRef[];
  community_score?: number;
  recommendation?: number;
  bathroom_features?: Array<{ feature: FeatureTag }>;
  bathroom_sources?: Array<{
    source_name: SourceRef['sourceName'];
    source_id: string;
    fetched_at: string;
    license: string;
    confidence: number;
    confirmed_by_users: number;
    contradicted_by_users: number;
  }>;
  photos?: Array<{ id: string; storage_path: string; alt: string; moderation_status: BathroomPhoto['moderationStatus'] }>;
};

const bathroomCache = new Map<string, Bathroom>();

export async function getNearbyBathrooms(input: NearbyBathroomInput): Promise<Bathroom[]> {
  const filters = input.filters ?? {};
  const preferredFeatures: FeatureTag[] = [
    filters.wheelchair ? 'wheelchair_accessible' : null,
    filters.babyChanging ? 'baby_changing' : null,
    filters.allGender ? 'all_gender' : null,
    filters.singleStall ? 'single_stall' : null,
  ].filter(Boolean) as FeatureTag[];

  let bathrooms = isSupabaseConfigured ? await getNearbyFromSupabase(input).catch(() => []) : [];

  if (isSupabaseConfigured && bathrooms.length < 3) {
    const imported = await invokeRefugeImport(input).catch(() => []);
    bathrooms = imported.length ? imported : bathrooms;
    if (bathrooms.length < 3) {
      const refreshed = await getNearbyFromSupabase(input).catch(() => []);
      bathrooms = refreshed.length > bathrooms.length ? refreshed : bathrooms;
    }
  }

  if (bathrooms.length < 3) {
    const refugeBathrooms = await fetchRefugeNearbyBathrooms(input).catch(() => []);
    bathrooms = mergeBathrooms(bathrooms, refugeBathrooms);
  }

  bathrooms = await applyCommunityComparisonScores(bathrooms);

  return bathrooms
    .map((bathroom) => ({
      ...bathroom,
      scores: {
        ...bathroom.scores,
        recommendation: recommendationScore({
          bathroom,
          targetLatitude: input.latitude,
          targetLongitude: input.longitude,
          preferredFeatures,
        }),
      },
    }))
    .filter((bathroom) => matchesFilters(bathroom, filters))
    .sort((a, b) => b.scores.recommendation - a.scores.recommendation)
    .map(cacheBathroom);
}

export async function getBathroomById(id: string): Promise<Bathroom | undefined> {
  if (bathroomCache.has(id)) {
    return bathroomCache.get(id);
  }
  if (!isSupabaseConfigured || !supabase) {
    return undefined;
  }

  const { data, error } = await supabase
    .from('bathrooms')
    .select(
      'id, name, kind, address, neighborhood, city, access, price_note, opening_hours, confidence, directions_note, last_confirmed_at, bathroom_features(feature), bathroom_sources(source_name, source_id, fetched_at, license, confidence, confirmed_by_users, contradicted_by_users), photos(id, storage_path, alt, moderation_status)',
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  return cacheBathroom(mapSupabaseBathroom(data as unknown as SupabaseBathroomRow));
}

export async function getRankedBathrooms(): Promise<
  Array<{ bathroom: Bathroom; rating: UserRating; score: number; rank: number }>
> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return [];
  }

  const { data, error } = await supabase
    .from('user_bathroom_ratings')
    .select(
      'bathroom_id, rating, comparisons, sentiment, bathrooms(id, name, kind, address, neighborhood, city, access, price_note, opening_hours, confidence, directions_note, last_confirmed_at, bathroom_features(feature), bathroom_sources(source_name, source_id, fetched_at, license, confidence, confirmed_by_users, contradicted_by_users), photos(id, storage_path, alt, moderation_status))',
    )
    .eq('user_id', userData.user.id);

  if (error || !data) {
    return [];
  }

  const ratings = data.map((row: any) => ({
    bathroomId: row.bathroom_id,
    rating: Number(row.rating),
    comparisons: Number(row.comparisons),
    sentiment: row.sentiment as Sentiment,
  }));
  const scores = scoreMapFromRatings(ratings);

  return sortRatings(ratings)
    .map((rating, index) => {
      const row = data.find((candidate: any) => candidate.bathroom_id === rating.bathroomId);
      const bathroom = row?.bathrooms ? mapSupabaseBathroom(row.bathrooms as unknown as SupabaseBathroomRow) : undefined;
      if (!bathroom) {
        return null;
      }
      return {
        bathroom: cacheBathroom(bathroom),
        rating,
        score: scores[rating.bathroomId] ?? bathroom.scores.community,
        rank: index + 1,
      };
    })
    .filter(Boolean) as Array<{ bathroom: Bathroom; rating: UserRating; score: number; rank: number }>;
}

export async function getFeedItems(): Promise<FeedItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from('feed_events')
    .select('id, actor_user_id, bathroom_id, event_type, body, created_at')
    .order('created_at', { ascending: false })
    .limit(40);

  if (error || !data) {
    return [];
  }

  return data.map((item: any) => ({
    id: item.id,
    actorName: 'Poopi member',
    actorAvatar: 'P',
    bathroomId: item.bathroom_id,
    action: item.event_type === 'ranked' ? 'ranked' : item.event_type === 'listed' ? 'listed' : 'logged',
    note: item.body,
    createdAt: new Date(item.created_at).toLocaleString(),
  }));
}

export async function getLists(): Promise<Array<BathroomList & { bathrooms: Bathroom[] }>> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return [];
  }

  const { data, error } = await supabase
    .from('lists')
    .select('id, title, description, visibility, list_items(position, bathroom_id)')
    .eq('owner_user_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((list: any) => ({
    id: list.id,
    title: list.title,
    description: list.description,
    visibility: list.visibility,
    bathroomIds: list.list_items.map((item: any) => item.bathroom_id),
    bathrooms: [],
  }));
}

export async function getProfileSummary(): Promise<ProfileSummary> {
  const profile = isSupabaseConfigured ? await getCurrentProfile().catch(() => null) : null;

  if (!isSupabaseConfigured || !supabase) {
    return emptyProfileSummary(profile);
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    return emptyProfileSummary(profile);
  }

  const [ranked, visits, lists] = await Promise.all([
    supabase.from('user_bathroom_ratings').select('bathroom_id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('visits').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('lists').select('id', { count: 'exact', head: true }).eq('owner_user_id', userId),
  ]);

  return {
    displayName: profile?.displayName ?? 'Poopi member',
    handle: profile?.username ? `@${profile.username}` : '@new',
    city: profile?.homeCity ?? 'New York',
    rankedCount: ranked.count ?? 0,
    visitedCount: visits.count ?? 0,
    listsCount: lists.count ?? 0,
    confidenceBoosts: 0,
    favoriteTags: [],
  };
}

export async function createBathroomCandidate(
  input: Pick<Bathroom, 'name' | 'address' | 'latitude' | 'longitude' | 'access'>,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('bathrooms')
    .insert({
      name: input.name,
      kind: 'User submitted restroom',
      address: input.address,
      location: `POINT(${input.longitude} ${input.latitude})`,
      access: input.access,
      price_note: 'Unverified',
      opening_hours: 'Unknown',
      confidence: 0.35,
      directions_note: '',
    })
    .select('id, name, kind, address, neighborhood, city, access, price_note, opening_hours, confidence, directions_note, last_confirmed_at')
    .single();

  if (error) {
    throw error;
  }
  return cacheBathroom(mapSupabaseBathroom({ ...data, latitude: input.latitude, longitude: input.longitude }));
}

export async function logVisit(input: {
  bathroomId: string;
  sentiment: Sentiment;
  publicNote: string;
  tags: FeatureTag[];
  privateNote?: string;
}): Promise<Visit> {
  if (!isUuid(input.bathroomId)) {
    throw new Error('This bathroom needs to be imported into Poopi before it can be logged.');
  }

  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    throw userError ?? new Error('You need to be signed in to log a visit.');
  }

  const { data, error } = await client
    .from('visits')
    .insert({
      bathroom_id: input.bathroomId,
      user_id: userData.user.id,
      sentiment: input.sentiment,
      public_note: input.publicNote,
      private_note: input.privateNote,
    })
    .select('id, bathroom_id, user_id, sentiment, public_note, private_note, created_at')
    .single();

  if (error) {
    throw error;
  }

  if (input.tags.length) {
    await client.from('visit_tags').insert(input.tags.map((tag) => ({ visit_id: data.id, tag })));
  }

  await client.from('user_bathroom_ratings').upsert(
    {
      user_id: userData.user.id,
      bathroom_id: input.bathroomId,
      rating: input.sentiment === 'liked' ? 1550 : input.sentiment === 'fine' ? 1500 : 1450,
      comparisons: 0,
      sentiment: input.sentiment,
    },
    { onConflict: 'user_id,bathroom_id', ignoreDuplicates: true },
  );

  return {
    id: data.id,
    bathroomId: data.bathroom_id,
    userId: data.user_id,
    sentiment: data.sentiment,
    publicNote: data.public_note,
    privateNote: data.private_note,
    tags: input.tags,
    companionIds: [],
    createdAt: data.created_at,
  };
}

export async function recordComparison(winnerId: string, loserId: string): Promise<UserRating[]> {
  if (!isUuid(winnerId) || !isUuid(loserId)) {
    throw new Error('Both bathrooms need to be imported into Poopi before they can be compared.');
  }

  const client = requireSupabase();
  const user = await getOrCreateRatingUser();

  const { error: comparisonError } = await client.from('pairwise_comparisons').upsert(
    {
      user_id: user.id,
      winner_bathroom_id: winnerId,
      loser_bathroom_id: loserId,
    },
    { onConflict: 'user_id,pair_low_bathroom_id,pair_high_bathroom_id' },
  );
  if (comparisonError) {
    throw comparisonError;
  }

  const ranked = await getRankedBathrooms();
  const ratings = applyEloComparison(
    ranked.map((item) => item.rating),
    winnerId,
    loserId,
  );

  await client.from('user_bathroom_ratings').upsert(
    ratings.map((rating) => ({
      user_id: user.id,
      bathroom_id: rating.bathroomId,
      rating: rating.rating,
      comparisons: rating.comparisons,
      sentiment: rating.sentiment,
    })),
    { onConflict: 'user_id,bathroom_id' },
  );

  return ratings;
}

async function applyCommunityComparisonScores(bathrooms: Bathroom[]): Promise<Bathroom[]> {
  if (!isSupabaseConfigured || !supabase) {
    return bathrooms;
  }

  if (bathrooms.filter(({ id }) => isUuid(id)).length < 2) {
    return bathrooms;
  }

  const { data, error } = await supabase.rpc('community_comparison_votes');
  if (error || !data?.length) {
    return bathrooms;
  }

  const ranked = rankCommunityComparisons(
    data.map((row: any) => ({
      winnerId: row.winner_bathroom_id,
      loserId: row.loser_bathroom_id,
      voterComparisonCount: Number(row.voter_comparison_count),
    })),
  );
  const scores = new Map(ranked.map((item) => [item.bathroomId, item]));

  return bathrooms.map((bathroom) => {
    const community = scores.get(bathroom.id);
    return community
      ? {
          ...bathroom,
          scores: {
            ...bathroom.scores,
            community: community.score,
          },
        }
      : bathroom;
  });
}

export async function createReport(bathroomId: string, reason: ReportReason): Promise<void> {
  if (!isUuid(bathroomId)) {
    throw new Error('This bathroom needs to be imported into Poopi before it can be reported.');
  }

  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    throw userError ?? new Error('You need to be signed in to report a bathroom.');
  }

  const { error } = await client.from('reports').insert({
    bathroom_id: bathroomId,
    user_id: userData.user.id,
    reason,
  });
  if (error) {
    throw error;
  }
}

async function getNearbyFromSupabase(input: NearbyBathroomInput): Promise<Bathroom[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('nearby_bathrooms', {
    center_latitude: input.latitude,
    center_longitude: input.longitude,
    result_limit: 50,
  });

  if (error || !data) {
    return [];
  }

  return (data as SupabaseBathroomRow[]).map(mapSupabaseBathroom).map(cacheBathroom);
}

async function invokeRefugeImport(input: NearbyBathroomInput): Promise<Bathroom[]> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('import-refuge-nearby', {
    body: {
      latitude: input.latitude,
      longitude: input.longitude,
      perPage: 40,
    },
  });

  if (error || !data?.bathrooms) {
    return [];
  }

  return (data.bathrooms as SupabaseBathroomRow[]).map(mapSupabaseBathroom).map(cacheBathroom);
}

async function fetchRefugeNearbyBathrooms(input: NearbyBathroomInput): Promise<Bathroom[]> {
  const url = new URL('https://www.refugerestrooms.org/api/v1/restrooms/by_location');
  url.searchParams.set('lat', String(input.latitude));
  url.searchParams.set('lng', String(input.longitude));
  url.searchParams.set('page', '1');
  url.searchParams.set('per_page', '40');
  url.searchParams.set('offset', '0');

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Refuge request failed with ${response.status}.`);
  }

  const records = (await response.json()) as RefugeRestroom[];
  return records.map(normalizeRefugeRestroom).map(cacheBathroom);
}

function mapSupabaseBathroom(row: SupabaseBathroomRow): Bathroom {
  const features = row.features ?? row.bathroom_features?.map((feature) => feature.feature) ?? [];
  const sourceRefs =
    row.source_refs ??
    row.bathroom_sources?.map((source) => ({
      sourceName: source.source_name,
      sourceId: source.source_id,
      fetchedAt: source.fetched_at,
      license: source.license,
      confidence: Number(source.confidence),
      confirmedByUsers: source.confirmed_by_users,
      contradictedByUsers: source.contradicted_by_users,
    })) ??
    [];

  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    address: row.address,
    neighborhood: row.neighborhood,
    city: row.city,
    latitude: Number(row.latitude ?? DEFAULT_MAP_CENTER.latitude),
    longitude: Number(row.longitude ?? DEFAULT_MAP_CENTER.longitude),
    access: row.access,
    priceNote: row.price_note,
    openingHours: row.opening_hours,
    isOpenNow: row.opening_hours.toLowerCase() !== 'closed',
    confidence: Number(row.confidence),
    features,
    directionsNote: row.directions_note,
    sourceRefs,
    photos: row.photos?.length
      ? row.photos.map((photo) => ({
          id: photo.id,
          url: photo.storage_path,
          alt: photo.alt,
          attribution: 'User submitted',
          moderationStatus: photo.moderation_status,
        }))
      : [placeholderPhoto(row.id)],
    reportsSummary: {},
    scores: {
      community: Number(row.community_score ?? 6),
      confidence: Number(row.confidence),
      recommendation: Number(row.recommendation ?? 0.5),
    },
    userStatus: 'unvisited',
    lastConfirmedAt: row.last_confirmed_at ?? new Date().toISOString(),
  };
}

function placeholderPhoto(id: string): BathroomPhoto {
  return {
    id: `placeholder-${id}`,
    url: 'https://images.unsplash.com/photo-1584622781564-1d987f7333c1?auto=format&fit=crop&w=1000&q=80',
    alt: 'Restroom sign placeholder',
    attribution: 'Unsplash placeholder',
    moderationStatus: 'approved',
  };
}

function matchesFilters(bathroom: Bathroom, filters: BathroomFilters): boolean {
  if (filters.openNow && !bathroom.isOpenNow) return false;
  if (filters.free && bathroom.access !== 'public') return false;
  if (filters.wheelchair && !bathroom.features.includes('wheelchair_accessible')) return false;
  if (filters.babyChanging && !bathroom.features.includes('baby_changing')) return false;
  if (filters.allGender && !bathroom.features.includes('all_gender')) return false;
  if (filters.singleStall && !bathroom.features.includes('single_stall')) return false;
  if (filters.customersOnly && bathroom.access !== 'customers_only') return false;
  if (filters.paid && bathroom.access !== 'paid') return false;
  if (filters.highConfidence && bathroom.confidence < 0.8) return false;
  return true;
}

function mergeBathrooms(primary: Bathroom[], fallback: Bathroom[]): Bathroom[] {
  const seen = new Set(primary.map((bathroom) => bathroom.id));
  return [...primary, ...fallback.filter((bathroom) => !seen.has(bathroom.id))];
}

function cacheBathroom<T extends Bathroom>(bathroom: T): T {
  bathroomCache.set(bathroom.id, bathroom);
  return bathroom;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function emptyProfileSummary(profile: Awaited<ReturnType<typeof getCurrentProfile>>): ProfileSummary {
  return {
    displayName: profile?.displayName ?? 'Poopi member',
    handle: profile?.username ? `@${profile.username}` : '@new',
    city: profile?.homeCity ?? 'New York',
    rankedCount: 0,
    visitedCount: 0,
    listsCount: 0,
    confidenceBoosts: 0,
    favoriteTags: [],
  };
}
