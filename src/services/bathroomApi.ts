import { decode as decodeBase64 } from 'base64-arraybuffer';

import type {
  AccessType,
  Bathroom,
  BathroomFilters,
  BathroomList,
  BathroomPhoto,
  FeatureTag,
  FeedItem,
  RatingLabel,
  ReportReason,
  Sentiment,
  SourceRef,
  UserRating,
  Visit,
  VisitVisibility,
  WaitBucket,
  OperatingStatus,
  FreshnessState,
  PublicBathroomReview,
} from '@/src/data/types';
import { isRatingLabel } from '@/src/data/ratingLabels';
import { normalizeBathroomFeatures } from '@/src/data/bathroomFeatures';
import { isDimensionRating, isOperatingStatus, isWaitBucket } from '@/src/data/visitObservations';
import { freshnessState } from '@/src/lib/bathroomSummary';
import { matchesBathroomFilters } from '@/src/lib/bathroomFilters';
import { normalizeName } from '@/src/lib/dedupe';
import {
  applyEloComparison,
  distanceKm,
  rankCommunityComparisons,
  recommendationScore,
  scoreMapFromRatings,
  sortRatings,
} from '@/src/lib/ranking';
import { getCurrentProfile } from '@/src/services/auth';
import {
  getOrCreateRatingUser,
  isSupabaseConfigured,
  requirePermanentUser,
  requireSupabase,
  supabase,
} from '@/src/services/supabase';

export const DEFAULT_MAP_CENTER = {
  latitude: 40.7536,
  longitude: -73.9832,
};

export interface NearbyBathroomInput {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
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
  distance_meters?: number | null;
  access: AccessType;
  fee_required?: boolean | null;
  price_note: string;
  opening_hours: string;
  confidence: number;
  directions_note: string;
  last_confirmed_at: string | null;
  features?: FeatureTag[];
  source_refs?: SourceRef[];
  community_score?: number | null;
  community_review_count?: number;
  cleanliness_score?: number | null;
  odor_score?: number | null;
  privacy_score?: number | null;
  median_wait?: string | null;
  summary_confidence?: number | null;
  summary_last_confirmed_at?: string | null;
  operating_status?: string | null;
  freshness?: FreshnessState | null;
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
const detailedBathroomCache = new Set<string>();
const BATHROOM_PHOTO_BUCKET = 'bathroom-photos';
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

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
    await invokeNearbyImports(input).catch(() => undefined);
    bathrooms = await getNearbyFromSupabase(input).catch(() => bathrooms);
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
    .filter((bathroom) => matchesBathroomFilters(bathroom, filters))
    .sort((a, b) => b.scores.recommendation - a.scores.recommendation)
    .map(cacheBathroom);
}

export async function getBathroomById(id: string): Promise<Bathroom | undefined> {
  if (bathroomCache.has(id) && detailedBathroomCache.has(id)) {
    return bathroomCache.get(id);
  }
  if (!isSupabaseConfigured || !supabase) {
    return undefined;
  }

  let { data, error } = await supabase
    .from('bathrooms')
    .select(
      'id, name, kind, address, neighborhood, city, access, fee_required, price_note, opening_hours, confidence, directions_note, last_confirmed_at, bathroom_features(feature), bathroom_sources(source_name, source_id, fetched_at, license, confidence, confirmed_by_users, contradicted_by_users), photos(id, storage_path, alt, moderation_status)',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    ({ data, error } = await supabase
      .from('bathrooms')
      .select(
        'id, name, kind, address, neighborhood, city, access, price_note, opening_hours, confidence, directions_note, last_confirmed_at, bathroom_features(feature), bathroom_sources(source_name, source_id, fetched_at, license, confidence, confirmed_by_users, contradicted_by_users), photos(id, storage_path, alt, moderation_status)',
      )
      .eq('id', id)
      .maybeSingle());
  }

  if (error || !data) {
    return undefined;
  }

  const { data: summaryRows } = await supabase.rpc('bathroom_summary', { p_bathroom_id: id });
  const summary = Array.isArray(summaryRows) ? summaryRows[0] : undefined;
  const bathroomRow = await hydrateBathroomPhotoUrls(data as unknown as SupabaseBathroomRow);
  return cacheDetailedBathroom(
    mapSupabaseBathroom({ ...bathroomRow, ...(summary ?? {}) }),
  );
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

  const primaryRatingsResult = await supabase
    .from('user_bathroom_ratings')
    .select(
      'bathroom_id, rating, comparisons, sentiment, bathrooms(id, name, kind, address, neighborhood, city, access, fee_required, price_note, opening_hours, confidence, directions_note, last_confirmed_at, bathroom_features(feature), bathroom_sources(source_name, source_id, fetched_at, license, confidence, confirmed_by_users, contradicted_by_users), photos(id, storage_path, alt, moderation_status))',
    )
    .eq('user_id', userData.user.id);
  let data: any[] | null = primaryRatingsResult.data;
  let error = primaryRatingsResult.error;

  if (error) {
    const legacyRatingsResult = await supabase
      .from('user_bathroom_ratings')
      .select(
        'bathroom_id, rating, comparisons, sentiment, bathrooms(id, name, kind, address, neighborhood, city, access, price_note, opening_hours, confidence, directions_note, last_confirmed_at, bathroom_features(feature), bathroom_sources(source_name, source_id, fetched_at, license, confidence, confirmed_by_users, contradicted_by_users), photos(id, storage_path, alt, moderation_status))',
      )
      .eq('user_id', userData.user.id);
    data = legacyRatingsResult.data;
    error = legacyRatingsResult.error;
  }

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

export async function getComparisonCandidates(): Promise<
  Array<{ bathroom: Bathroom; rating: UserRating; score: number; rank: number }>
> {
  const ranked = await getRankedBathrooms();
  if (ranked.length >= 2) return ranked;

  const existingIds = new Set(ranked.map(({ bathroom }) => bathroom.id));
  const nearby = await getNearbyBathrooms(DEFAULT_MAP_CENTER);
  const additions = nearby.filter(({ id }) => isUuid(id) && !existingIds.has(id)).slice(0, 2 - ranked.length);
  return [
    ...ranked,
    ...additions.map((bathroom, index) => ({
      bathroom,
      rating: { bathroomId: bathroom.id, rating: 1500, comparisons: 0, sentiment: 'fine' as const },
      score: 6,
      rank: ranked.length + index + 1,
    })),
  ];
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

  return Promise.all(
    data.map(async (list: any) => {
      const bathroomIds = [...list.list_items]
        .sort((left: any, right: any) => left.position - right.position)
        .map((item: any) => item.bathroom_id);
      const bathrooms = (await Promise.all(bathroomIds.map((bathroomId: string) => getBathroomById(bathroomId)))).filter(
        Boolean,
      ) as Bathroom[];
      return {
        id: list.id,
        title: list.title,
        description: list.description,
        visibility: list.visibility,
        bathroomIds,
        bathrooms,
      };
    }),
  );
}

export async function isBathroomSaved(bathroomId: string): Promise<boolean> {
  if (!isUuid(bathroomId) || !isSupabaseConfigured || !supabase) return false;
  const user = await requirePermanentUser('view saved bathrooms');
  const listId = await getSavedListId(user.id);
  if (!listId) return false;
  const { count, error } = await supabase
    .from('list_items')
    .select('bathroom_id', { count: 'exact', head: true })
    .eq('list_id', listId)
    .eq('bathroom_id', bathroomId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function toggleBathroomSaved(bathroomId: string): Promise<boolean> {
  if (!isUuid(bathroomId)) {
    throw new Error('This bathroom needs to be imported into Poopi before it can be saved.');
  }
  const client = requireSupabase();
  const user = await requirePermanentUser('save a bathroom');
  let listId = await getSavedListId(user.id);
  if (!listId) {
    const { data, error } = await client
      .from('lists')
      .insert({
        owner_user_id: user.id,
        title: 'Saved',
        description: 'Bathrooms you want to remember.',
        visibility: 'private',
      })
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('Unable to create your Saved list.');
    listId = data.id;
  }

  const { count, error: lookupError } = await client
    .from('list_items')
    .select('bathroom_id', { count: 'exact', head: true })
    .eq('list_id', listId)
    .eq('bathroom_id', bathroomId);
  if (lookupError) throw lookupError;

  if ((count ?? 0) > 0) {
    const { error } = await client.from('list_items').delete().eq('list_id', listId).eq('bathroom_id', bathroomId);
    if (error) throw error;
    return false;
  }

  const { count: itemCount } = await client
    .from('list_items')
    .select('bathroom_id', { count: 'exact', head: true })
    .eq('list_id', listId);
  const { error } = await client.from('list_items').insert({
    list_id: listId,
    bathroom_id: bathroomId,
    position: itemCount ?? 0,
  });
  if (error) throw error;
  return true;
}

async function getSavedListId(userId: string): Promise<string | undefined> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('lists')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('title', 'Saved')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id;
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
  const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
  if (refreshError || !refreshed.session) {
    throw new Error('Your sign-in session expired. Log in again, then retry adding this bathroom.');
  }
  if (refreshed.session.user.is_anonymous) {
    throw new Error('This browser is still using a guest session. Log out, then sign in with Google or email before adding a bathroom.');
  }
  await requirePermanentUser('add a bathroom');
  const { data, error } = await client.rpc('upsert_canonical_bathroom', {
    p_source_name: 'user',
    p_source_id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    p_fetched_at: new Date().toISOString(),
    p_license: 'User submitted',
    p_name: input.name,
    p_kind: 'User submitted restroom',
    p_address: input.address,
    p_neighborhood: '',
    p_city: '',
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_access: input.access,
    p_fee_required: null,
    p_price_note: 'Unverified',
    p_opening_hours: 'Unknown',
    p_confidence: 0.35,
    p_directions_note: '',
    p_last_confirmed_at: null,
    p_confirmed_by_users: 0,
    p_contradicted_by_users: 0,
    p_features: [],
  });

  if (error) {
    if (error.code === 'PGRST202' || error.message.includes('upsert_canonical_bathroom')) {
      return createBathroomCandidateWithoutCanonicalRpc(input);
    }
    throw error;
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.bathroom_id) {
    throw new Error('The bathroom could not be resolved to a Poopi location.');
  }
  const bathroom = await getBathroomById(String(result.bathroom_id));
  if (!bathroom) {
    throw new Error('The resolved bathroom could not be loaded.');
  }
  return bathroom;
}

async function createBathroomCandidateWithoutCanonicalRpc(
  input: Pick<Bathroom, 'name' | 'address' | 'latitude' | 'longitude' | 'access'>,
): Promise<Bathroom> {
  const client = requireSupabase();
  const nearby = await getNearbyFromSupabase({
    latitude: input.latitude,
    longitude: input.longitude,
    radiusMeters: 100,
  }).catch(() => []);
  const normalizedName = normalizeName(input.name);
  const normalizedAddress = normalizeName(input.address);
  const existing = nearby.find((bathroom) => {
    const metersAway = distanceKm(input.latitude, input.longitude, bathroom.latitude, bathroom.longitude) * 1000;
    if (metersAway <= 18) return true;
    return (
      metersAway <= 80 &&
      ((normalizedName && normalizeName(bathroom.name) === normalizedName) ||
        (normalizedAddress && normalizeName(bathroom.address) === normalizedAddress))
    );
  });
  if (existing) return cacheBathroom(existing);

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
    .select(
      'id, name, kind, address, neighborhood, city, access, price_note, opening_hours, confidence, directions_note, last_confirmed_at',
    )
    .single();

  if (error || !data) throw error ?? new Error('The bathroom could not be created.');
  return cacheBathroom(
    mapSupabaseBathroom({
      ...(data as unknown as SupabaseBathroomRow),
      latitude: input.latitude,
      longitude: input.longitude,
    }),
  );
}

export interface BathroomPhotoUploadInput {
  bathroomId: string;
  base64: string;
  alt: string;
}

export async function uploadBathroomPhoto(input: BathroomPhotoUploadInput): Promise<BathroomPhoto> {
  if (!isUuid(input.bathroomId)) {
    throw new Error('Choose a bathroom before adding a photo.');
  }
  if (!input.base64) {
    throw new Error('Choose or take a photo first.');
  }

  const client = requireSupabase();
  const user = await requirePermanentUser('upload a bathroom photo');
  const bytes = decodeBase64(input.base64);
  if (bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new Error('That photo is still too large. Choose a photo under 6 MB.');
  }

  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const storagePath = `${user.id}/${input.bathroomId}/${fileName}`;
  const { error: uploadError } = await client.storage
    .from(BATHROOM_PHOTO_BUCKET)
    .upload(storagePath, bytes, { contentType: 'image/jpeg', upsert: false });

  if (uploadError) {
    if (/bucket|not found/i.test(uploadError.message)) {
      throw new Error('Photo storage is not ready yet. Apply Poopi’s latest Supabase migration, then retry.');
    }
    throw uploadError;
  }

  const { data: photoRow, error: insertError } = await client
    .from('photos')
    .insert({
      bathroom_id: input.bathroomId,
      user_id: user.id,
      storage_path: storagePath,
      alt: input.alt.trim() || 'User-submitted bathroom photo',
      moderation_status: 'queued',
    })
    .select('id, storage_path, alt, moderation_status')
    .single();

  if (insertError || !photoRow) {
    await client.storage.from(BATHROOM_PHOTO_BUCKET).remove([storagePath]);
    throw insertError ?? new Error('The photo uploaded, but Poopi could not attach it to this bathroom.');
  }

  const signedUrl = await createBathroomPhotoUrl(photoRow.storage_path);
  const photo: BathroomPhoto = {
    id: String(photoRow.id),
    url: signedUrl,
    alt: String(photoRow.alt),
    attribution: 'User submitted',
    moderationStatus: 'queued',
  };

  const cached = bathroomCache.get(input.bathroomId);
  if (cached) {
    bathroomCache.set(input.bathroomId, { ...cached, photos: [photo, ...cached.photos] });
  }
  detailedBathroomCache.delete(input.bathroomId);
  return photo;
}

export interface VisitObservationInput {
  bathroomId: string;
  sentiment: Sentiment;
  publicNote: string;
  tags: RatingLabel[];
  privateNote?: string;
  cleanlinessRating?: number;
  odorRating?: number;
  privacyRating?: number;
  waitBucket?: WaitBucket;
  observedAccess?: AccessType;
  observedStatus?: OperatingStatus;
  visibility?: VisitVisibility;
  observedAt?: string;
}

export async function logVisit(input: VisitObservationInput): Promise<Visit> {
  if (!isUuid(input.bathroomId)) {
    throw new Error('This bathroom needs to be imported into Poopi before it can be logged.');
  }

  const client = requireSupabase();
  const user = await requirePermanentUser('rate a bathroom');

  validateVisitObservation(input);
  const tags = [...new Set(input.tags)];

  const observedAt = input.observedAt ?? new Date().toISOString();
  const visibility = input.visibility ?? 'public';
  const { data: visitId, error } = await client.rpc('submit_visit_observation', {
    p_bathroom_id: input.bathroomId,
    p_sentiment: input.sentiment,
    p_public_note: input.publicNote,
    p_private_note: input.privateNote ?? null,
    p_labels: tags,
    p_cleanliness_rating: input.cleanlinessRating ?? null,
    p_odor_rating: input.odorRating ?? null,
    p_privacy_rating: input.privacyRating ?? null,
    p_wait_bucket: input.waitBucket ?? null,
    p_observed_access: input.observedAccess ?? null,
    p_observed_status: input.observedStatus ?? 'unknown',
    p_visibility: visibility,
    p_observed_at: observedAt,
  });

  if (error) {
    throw error;
  }

  bathroomCache.delete(input.bathroomId);

  return {
    id: String(visitId),
    bathroomId: input.bathroomId,
    userId: user.id,
    sentiment: input.sentiment,
    cleanlinessRating: input.cleanlinessRating,
    odorRating: input.odorRating,
    privacyRating: input.privacyRating,
    waitBucket: input.waitBucket,
    observedAccess: input.observedAccess,
    observedStatus: input.observedStatus ?? 'unknown',
    ratingTags: tags,
    publicNote: input.publicNote,
    privateNote: input.privateNote,
    visibility,
    observedAt,
    tags,
    companionIds: [],
    createdAt: observedAt,
  };
}

export async function getLatestOwnVisit(bathroomId: string): Promise<Visit | undefined> {
  if (!isUuid(bathroomId) || !isSupabaseConfigured || !supabase) return undefined;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user || userData.user.is_anonymous) return undefined;

  const { data: visit, error } = await supabase
    .from('visits')
    .select(
      'id, bathroom_id, user_id, sentiment, public_note, private_note, cleanliness_rating, odor_rating, privacy_rating, wait_bucket, observed_access, observed_status, visibility, observed_at, created_at',
    )
    .eq('bathroom_id', bathroomId)
    .eq('user_id', userData.user.id)
    .order('observed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !visit) return undefined;

  const { data: tagRows, error: tagError } = await supabase
    .from('visit_tags')
    .select('tag')
    .eq('visit_id', visit.id);
  if (tagError) throw tagError;

  const tags = (tagRows ?? []).map((row: any) => row.tag).filter(isRatingLabel);
  return mapOwnVisit(visit, tags);
}

export async function updateVisitObservation(visitId: string, input: VisitObservationInput): Promise<Visit> {
  if (!isUuid(visitId) || !isUuid(input.bathroomId)) {
    throw new Error('This review cannot be edited until it is connected to Poopi.');
  }

  const client = requireSupabase();
  const user = await requirePermanentUser('edit a review');
  validateVisitObservation(input);
  const tags = [...new Set(input.tags)];
  const observedAt = input.observedAt ?? new Date().toISOString();
  const visibility = input.visibility ?? 'public';

  const { data: visit, error } = await client
    .from('visits')
    .update({
      sentiment: input.sentiment,
      public_note: input.publicNote,
      private_note: input.privateNote ?? null,
      cleanliness_rating: input.cleanlinessRating ?? null,
      odor_rating: input.odorRating ?? null,
      privacy_rating: input.privacyRating ?? null,
      wait_bucket: input.waitBucket ?? null,
      observed_access: input.observedAccess ?? null,
      observed_status: input.observedStatus ?? 'unknown',
      visibility,
      observed_at: observedAt,
    })
    .eq('id', visitId)
    .eq('bathroom_id', input.bathroomId)
    .eq('user_id', user.id)
    .select(
      'id, bathroom_id, user_id, sentiment, public_note, private_note, cleanliness_rating, odor_rating, privacy_rating, wait_bucket, observed_access, observed_status, visibility, observed_at, created_at',
    )
    .single();

  if (error || !visit) throw error ?? new Error('This review could not be updated.');

  const { error: deleteError } = await client.from('visit_tags').delete().eq('visit_id', visitId);
  if (deleteError) throw deleteError;

  if (tags.length) {
    const { error: insertError } = await client
      .from('visit_tags')
      .insert(tags.map((tag) => ({ visit_id: visitId, tag })));
    if (insertError) throw insertError;
  }

  await client
    .from('user_bathroom_ratings')
    .update({ sentiment: input.sentiment })
    .eq('user_id', user.id)
    .eq('bathroom_id', input.bathroomId);

  bathroomCache.delete(input.bathroomId);
  return mapOwnVisit(visit, tags);
}

export async function deleteVisitObservation(visitId: string, bathroomId: string): Promise<void> {
  if (!isUuid(visitId) || !isUuid(bathroomId)) {
    throw new Error('This review cannot be deleted until it is connected to Poopi.');
  }

  const client = requireSupabase();
  const user = await requirePermanentUser('delete a review');
  const { data, error } = await client
    .from('visits')
    .delete()
    .eq('id', visitId)
    .eq('bathroom_id', bathroomId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('That review was not found or does not belong to your account.');

  bathroomCache.delete(bathroomId);
}

export async function getOwnVisitHistory(): Promise<Array<{ visit: Visit; bathroom: Bathroom }>> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user || userData.user.is_anonymous) return [];

  const { data: visits, error } = await supabase
    .from('visits')
    .select(
      'id, bathroom_id, user_id, sentiment, public_note, private_note, cleanliness_rating, odor_rating, privacy_rating, wait_bucket, observed_access, observed_status, visibility, observed_at, created_at',
    )
    .eq('user_id', userData.user.id)
    .order('observed_at', { ascending: false })
    .limit(30);
  if (error || !visits?.length) return [];

  const visitIds = visits.map((visit: any) => visit.id);
  const { data: tagRows } = await supabase.from('visit_tags').select('visit_id, tag').in('visit_id', visitIds);
  const tagsByVisit = new Map<string, RatingLabel[]>();
  (tagRows ?? []).forEach((row: any) => {
    if (!isRatingLabel(row.tag)) return;
    tagsByVisit.set(row.visit_id, [...(tagsByVisit.get(row.visit_id) ?? []), row.tag]);
  });

  const bathroomById = new Map<string, Bathroom>();
  await Promise.all(
    [...new Set(visits.map((visit: any) => visit.bathroom_id))].map(async (bathroomId) => {
      const bathroom = await getBathroomById(String(bathroomId));
      if (bathroom) bathroomById.set(String(bathroomId), bathroom);
    }),
  );

  return visits
    .map((row: any) => {
      const bathroom = bathroomById.get(row.bathroom_id);
      if (!bathroom) return undefined;
      return { visit: mapOwnVisit(row, tagsByVisit.get(row.id) ?? []), bathroom };
    })
    .filter(Boolean) as Array<{ visit: Visit; bathroom: Bathroom }>;
}

export async function getOwnSubmittedBathrooms(): Promise<Bathroom[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user || userData.user.is_anonymous) return [];

  const { data: sourceRows, error } = await supabase
    .from('bathroom_sources')
    .select('bathroom_id, fetched_at')
    .eq('source_name', 'user')
    .like('source_id', `${userData.user.id}:%`)
    .order('fetched_at', { ascending: false })
    .limit(30);
  if (error || !sourceRows?.length) return [];

  const bathrooms = await Promise.all(
    [...new Set(sourceRows.map((row: any) => String(row.bathroom_id)))].map(getBathroomById),
  );
  return bathrooms.filter(Boolean) as Bathroom[];
}

function validateVisitObservation(input: VisitObservationInput) {
  if (!input.tags.every(isRatingLabel)) {
    throw new Error('One or more bathroom labels are not supported.');
  }
  for (const [name, value] of [
    ['cleanliness', input.cleanlinessRating],
    ['odor', input.odorRating],
    ['privacy', input.privacyRating],
  ] as const) {
    if (value !== undefined && !isDimensionRating(value)) {
      throw new Error(`${name} rating must be a whole number from 1 to 5.`);
    }
  }
}

function mapOwnVisit(row: any, tags: RatingLabel[]): Visit {
  return {
    id: row.id,
    bathroomId: row.bathroom_id,
    userId: row.user_id,
    sentiment: row.sentiment,
    cleanlinessRating: row.cleanliness_rating ?? undefined,
    odorRating: row.odor_rating ?? undefined,
    privacyRating: row.privacy_rating ?? undefined,
    waitBucket: row.wait_bucket && isWaitBucket(row.wait_bucket) ? row.wait_bucket : undefined,
    observedAccess: row.observed_access ?? undefined,
    observedStatus: row.observed_status && isOperatingStatus(row.observed_status) ? row.observed_status : 'unknown',
    ratingTags: tags,
    publicNote: row.public_note ?? '',
    privateNote: row.private_note ?? undefined,
    visibility: row.visibility ?? 'public',
    observedAt: row.observed_at,
    tags,
    companionIds: row.companion_ids ?? [],
    createdAt: row.created_at,
  };
}

export async function recordComparison(winnerId: string, loserId: string): Promise<UserRating[]> {
  if (!isUuid(winnerId) || !isUuid(loserId)) {
    throw new Error('Both bathrooms need to be imported into Poopi before they can be compared.');
  }

  const client = requireSupabase();
  const user = await getOrCreateRatingUser();

  const { error: comparisonError } = await client.rpc('submit_comparison_vote', {
    p_winner_bathroom_id: winnerId,
    p_loser_bathroom_id: loserId,
  });
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
            communityReviewCount: Math.max(
              bathroom.scores.communityReviewCount ?? 0,
              Math.max(1, Math.round(community.comparisonWeight)),
            ),
            confidence: community.confidence,
          },
          summary: {
            ...bathroom.summary,
            communityScore: community.score,
          },
        }
      : bathroom;
  });
}

export async function createReport(bathroomId: string, reason: ReportReason, details = ''): Promise<void> {
  if (!isUuid(bathroomId)) {
    throw new Error('This bathroom needs to be imported into Poopi before it can be reported.');
  }

  const client = requireSupabase();
  const user = await requirePermanentUser('report a bathroom');

  const { error } = await client.from('reports').insert({
    bathroom_id: bathroomId,
    user_id: user.id,
    reason,
    details,
  });
  if (error) {
    throw error;
  }
}

export async function getPublicBathroomReviews(bathroomId: string): Promise<PublicBathroomReview[]> {
  if (!isUuid(bathroomId) || !isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc('public_bathroom_reviews', { p_bathroom_id: bathroomId });
  if (error || !data) return [];
  return (data as any[]).map((row) => ({
    id: row.id,
    bathroomId: row.bathroom_id,
    sentiment: row.sentiment,
    cleanlinessRating: row.cleanliness_rating ?? undefined,
    odorRating: row.odor_rating ?? undefined,
    privacyRating: row.privacy_rating ?? undefined,
    waitBucket: row.wait_bucket && isWaitBucket(row.wait_bucket) ? row.wait_bucket : undefined,
    observedAccess: row.observed_access ?? undefined,
    observedStatus: row.observed_status && isOperatingStatus(row.observed_status) ? row.observed_status : 'unknown',
    ratingTags: Array.isArray(row.rating_tags) ? row.rating_tags.filter(isRatingLabel) : [],
    publicNote: row.public_note,
    observedAt: row.observed_at,
    createdAt: row.created_at,
  }));
}

async function getNearbyFromSupabase(input: NearbyBathroomInput): Promise<Bathroom[]> {
  const client = requireSupabase();
  let { data, error } = await client.rpc('nearby_bathrooms', {
    center_latitude: input.latitude,
    center_longitude: input.longitude,
    result_limit: 50,
    radius_meters: input.radiusMeters ?? 5_000,
  });

  if (error) {
    ({ data, error } = await client.rpc('nearby_bathrooms', {
      center_latitude: input.latitude,
      center_longitude: input.longitude,
      result_limit: 50,
    }));
  }

  if (error || !data) {
    return [];
  }

  const rows = await hydrateNearbyBathroomPhotos(data as SupabaseBathroomRow[]);
  return rows.map(mapSupabaseBathroom).map(cacheBathroom);
}

async function invokeNearbyImports(input: NearbyBathroomInput): Promise<void> {
  const client = requireSupabase();
  const body = {
    latitude: input.latitude,
    longitude: input.longitude,
    radiusMeters: input.radiusMeters ?? 5_000,
    perPage: 40,
  };
  await Promise.allSettled([
    client.functions.invoke('import-refuge-nearby', { body }),
    client.functions.invoke('import-osm-nearby', { body }),
  ]);
}

function mapSupabaseBathroom(row: SupabaseBathroomRow): Bathroom {
  const features = normalizeBathroomFeatures(
    row.features ?? row.bathroom_features?.map((feature) => feature.feature) ?? [],
  );
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

  const lastConfirmedAt = row.summary_last_confirmed_at ?? row.last_confirmed_at ?? undefined;
  const operatingStatus: OperatingStatus =
    row.operating_status && isOperatingStatus(row.operating_status) ? row.operating_status : 'unknown';
  const medianWait = row.median_wait && isWaitBucket(row.median_wait) ? row.median_wait : undefined;
  const freshness = row.freshness ?? freshnessState(lastConfirmedAt);
  const summaryConfidence = Number(row.summary_confidence ?? row.confidence ?? 0);
  const reviewCount = Number(row.community_review_count ?? 0);
  const communityScore = row.community_score == null ? undefined : Number(row.community_score);

  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    address: row.address,
    neighborhood: row.neighborhood,
    city: row.city,
    latitude: Number(row.latitude ?? DEFAULT_MAP_CENTER.latitude),
    longitude: Number(row.longitude ?? DEFAULT_MAP_CENTER.longitude),
    distanceMeters: row.distance_meters == null ? undefined : Number(row.distance_meters),
    access: row.access,
    feeRequired: row.fee_required ?? undefined,
    priceNote: row.price_note,
    openingHours: row.opening_hours,
    isOpenNow: operatingStatus === 'open',
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
      : [],
    reportsSummary: {},
    summary: {
      cleanlinessScore: row.cleanliness_score == null ? undefined : Number(row.cleanliness_score),
      odorScore: row.odor_score == null ? undefined : Number(row.odor_score),
      privacyScore: row.privacy_score == null ? undefined : Number(row.privacy_score),
      medianWait,
      reviewCount,
      communityScore,
      confidence: summaryConfidence,
      lastConfirmedAt,
      operatingStatus,
      freshness,
    },
    scores: {
      community: communityScore ?? 0,
      communityReviewCount: reviewCount,
      confidence: summaryConfidence,
      recommendation: Number(row.recommendation ?? 0.5),
    },
    userStatus: 'unvisited',
    lastConfirmedAt,
  };
}

function cacheBathroom<T extends Bathroom>(bathroom: T): T {
  bathroomCache.set(bathroom.id, bathroom);
  return bathroom;
}

function cacheDetailedBathroom<T extends Bathroom>(bathroom: T): T {
  detailedBathroomCache.add(bathroom.id);
  return cacheBathroom(bathroom);
}

async function hydrateBathroomPhotoUrls(row: SupabaseBathroomRow): Promise<SupabaseBathroomRow> {
  if (!row.photos?.length) return row;
  const photos = await Promise.all(
    row.photos.map(async (photo) => ({ ...photo, storage_path: await createBathroomPhotoUrl(photo.storage_path) })),
  );
  return { ...row, photos };
}

async function hydrateNearbyBathroomPhotos(rows: SupabaseBathroomRow[]): Promise<SupabaseBathroomRow[]> {
  if (!rows.length || !supabase) return rows;

  const ids = rows.map(({ id }) => id).filter(isUuid);
  if (!ids.length) return rows;
  const { data, error } = await supabase
    .from('photos')
    .select('id, bathroom_id, storage_path, alt, moderation_status')
    .in('bathroom_id', ids)
    .order('created_at', { ascending: true });
  if (error || !data?.length) return rows;

  const hydratedPhotos = await Promise.all((data as Array<{
    id: string;
    bathroom_id: string;
    storage_path: string;
    alt: string;
    moderation_status: BathroomPhoto['moderationStatus'];
  }>).map(async (photo) => ({
    ...photo,
    storage_path: await createBathroomPhotoUrl(photo.storage_path),
  })));

  const photosByBathroom = new Map<string, SupabaseBathroomRow['photos']>();
  for (const photo of hydratedPhotos) {
    const existing = photosByBathroom.get(photo.bathroom_id) ?? [];
    existing.push({
      id: photo.id,
      storage_path: photo.storage_path,
      alt: photo.alt,
      moderation_status: photo.moderation_status,
    });
    photosByBathroom.set(photo.bathroom_id, existing);
  }

  return rows.map((row) => ({ ...row, photos: photosByBathroom.get(row.id) ?? row.photos }));
}

async function createBathroomPhotoUrl(storagePath: string): Promise<string> {
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  if (!supabase) return '';
  const { data, error } = await supabase.storage
    .from(BATHROOM_PHOTO_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24);
  if (error) return '';
  return data.signedUrl;
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
