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
  'baby_changing',
  'adult_changing',
  'family_room',
  'all_gender',
  'single_stall',
  'menstrual_products',
  'sharps_disposal',
  'soap',
  'dryer_or_towels',
  'hook_or_shelf',
  'mirror',
  'lock_works',
  'clean',
  'smells_good',
  'stinks',
  'comfortable',
  'roomy_stall',
  'wide_seat',
  'urinal_only',
  'bidet',
  'private',
  'safe',
  'well_lit',
  'long_line',
  'out_of_order',
] as const;

export type FeatureTag = (typeof FEATURE_TAGS)[number];

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
  scores: ScoreBundle;
  userStatus: UserBathroomStatus;
  lastConfirmedAt: string;
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

export interface Visit {
  id: string;
  bathroomId: string;
  userId: string;
  sentiment: Sentiment;
  publicNote: string;
  privateNote?: string;
  tags: FeatureTag[];
  companionIds: string[];
  createdAt: string;
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
