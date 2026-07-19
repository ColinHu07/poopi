export const ACCESS_TYPES = [
  'public',
  'customers_only',
  'purchase_required',
  'paid',
  'code_required',
  'staff_permission',
  'members_only',
  'unknown',
] as const;

export type AccessType = (typeof ACCESS_TYPES)[number];

export const FEATURE_TAGS = [
  'wheelchair_accessible',
  'step_free',
  'accessible_stall',
  'grab_bars',
  'automatic_door',
  'baby_changing',
  'adult_changing',
  'family_room',
  'all_gender',
  'single_stall',
  'multiple_stalls',
  'urinal_only',
  'sharps_disposal',
  'hook_or_shelf',
  'mirror',
  'bidet',
] as const;

export type FeatureTag = (typeof FEATURE_TAGS)[number];

export const POSITIVE_RATING_LABELS = [
  'sparkling_clean',
  'fresh_smelling',
  'well_stocked',
  'great_soap',
  'paper_towels',
  'well_maintained',
  'no_wait',
  'short_line',
  'plenty_of_stalls',
  'easy_to_find',
  'open_late',
  'free_to_use',
  'very_private',
  'single_stall',
  'strong_locks',
  'minimal_stall_gaps',
  'spacious',
  'great_lighting',
  'good_ventilation',
  'hooks_and_shelves',
  'gender_neutral',
  'wheelchair_accessible',
  'step_free',
  'family_restroom',
  'changing_table',
  'menstrual_products',
  'touchless_fixtures',
  'bidet',
  'luxury_bathroom',
  'hidden_gem',
] as const;

export const NEGATIVE_RATING_LABELS = [
  'dirty',
  'smelly',
  'poorly_stocked',
  'no_toilet_paper',
  'no_soap',
  'long_line',
  'crowded',
  'hard_to_find',
  'customers_only',
  'broken_lock',
  'little_privacy',
  'cramped',
  'poor_lighting',
  'poor_ventilation',
  'out_of_order',
  'felt_unsafe',
] as const;

export const RATING_LABELS = [...POSITIVE_RATING_LABELS, ...NEGATIVE_RATING_LABELS] as const;

export type PositiveRatingLabel = (typeof POSITIVE_RATING_LABELS)[number];
export type NegativeRatingLabel = (typeof NEGATIVE_RATING_LABELS)[number];
export type RatingLabel = (typeof RATING_LABELS)[number];
export type RatingTag = RatingLabel;

export const WAIT_BUCKETS = ['none', 'under_five', 'five_to_ten', 'ten_to_twenty', 'over_twenty'] as const;
export type WaitBucket = (typeof WAIT_BUCKETS)[number];

export const OPERATING_STATUSES = ['open', 'closed', 'partly_out_of_order', 'out_of_order', 'unknown'] as const;
export type OperatingStatus = (typeof OPERATING_STATUSES)[number];

export const VISIT_VISIBILITIES = ['public', 'friends', 'private'] as const;
export type VisitVisibility = (typeof VISIT_VISIBILITIES)[number];

export const FRESHNESS_STATES = ['fresh', 'aging', 'stale', 'unknown'] as const;
export type FreshnessState = (typeof FRESHNESS_STATES)[number];

export type SourceName =
  | 'osm'
  | 'refuge'
  | 'nyc_open_data'
  | 'datasf'
  | 'user'
  | 'google_live';

export type Sentiment = 'liked' | 'fine' | 'disliked';

export type UserBathroomStatus = 'visited' | 'want_to_go' | 'unvisited';

export type ReportReason =
  | 'closed'
  | 'unsafe'
  | 'inaccessible'
  | 'dirty'
  | 'long_line'
  | 'inaccurate'
  | 'duplicate'
  | 'privacy';

export interface SourceRef {
  sourceName: SourceName;
  sourceId: string;
  fetchedAt: string;
  license: string;
  confidence: number;
  confirmedByUsers: number;
  contradictedByUsers: number;
}

export interface BathroomPhoto {
  id: string;
  url: string;
  alt: string;
  attribution: string;
  moderationStatus: 'approved' | 'queued' | 'rejected';
}

export interface ScoreBundle {
  personal?: number;
  friends?: number;
  community: number;
  communityReviewCount?: number;
  confidence: number;
  recommendation: number;
}

export interface Bathroom {
  id: string;
  name: string;
  kind: string;
  address: string;
  neighborhood: string;
  city: string;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
  access: AccessType;
  priceNote: string;
  openingHours: string;
  isOpenNow: boolean;
  confidence: number;
  features: FeatureTag[];
  directionsNote: string;
  sourceRefs: SourceRef[];
  photos: BathroomPhoto[];
  reportsSummary: Partial<Record<ReportReason, number>>;
  summary: BathroomSummary;
  scores: ScoreBundle;
  userStatus: UserBathroomStatus;
  lastConfirmedAt?: string;
}

export interface BathroomFilters {
  openNow?: boolean;
  free?: boolean;
  wheelchair?: boolean;
  babyChanging?: boolean;
  allGender?: boolean;
  singleStall?: boolean;
  customersOnly?: boolean;
  paid?: boolean;
  highConfidence?: boolean;
}

export interface VisitObservation {
  bathroomId: string;
  sentiment: Sentiment;
  cleanlinessRating?: number;
  odorRating?: number;
  privacyRating?: number;
  waitBucket?: WaitBucket;
  observedAccess?: AccessType;
  observedStatus?: OperatingStatus;
  ratingTags: RatingTag[];
  publicNote: string;
  privateNote?: string;
  visibility: VisitVisibility;
  observedAt: string;
}

export interface Visit extends VisitObservation {
  id: string;
  userId: string;
  /** @deprecated Use ratingTags. */
  tags: RatingTag[];
  companionIds: string[];
  createdAt: string;
}

export interface BathroomSummary {
  cleanlinessScore?: number;
  odorScore?: number;
  privacyScore?: number;
  medianWait?: WaitBucket;
  reviewCount: number;
  communityScore?: number;
  confidence: number;
  lastConfirmedAt?: string;
  operatingStatus: OperatingStatus;
  freshness: FreshnessState;
}

export interface PairwiseComparison {
  id: string;
  userId: string;
  winnerId: string;
  loserId: string;
  createdAt: string;
}

export interface UserRating {
  bathroomId: string;
  rating: number;
  comparisons: number;
  sentiment: Sentiment;
}

export interface FeedItem {
  id: string;
  actorName: string;
  actorAvatar: string;
  bathroomId: string;
  action: 'logged' | 'ranked' | 'listed' | 'confirmed';
  note: string;
  createdAt: string;
}

export interface BathroomList {
  id: string;
  title: string;
  description: string;
  visibility: 'private' | 'friends' | 'public';
  bathroomIds: string[];
}
