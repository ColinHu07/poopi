import { seedBathrooms, seedFeed, seedLists, seedUserRatings, seedVisits } from '@/src/data/fixtures';
import type {
  Bathroom,
  BathroomFilters,
  FeedItem,
  FeatureTag,
  ReportReason,
  Sentiment,
  UserRating,
  Visit,
} from '@/src/data/types';
import { applyEloComparison, recommendationScore, scoreMapFromRatings, sortRatings } from '@/src/lib/ranking';

const DEFAULT_LATITUDE = 40.7536;
const DEFAULT_LONGITUDE = -73.9832;

let bathrooms = seedBathrooms.map((bathroom) => ({ ...bathroom }));
let visits = seedVisits.map((visit) => ({ ...visit }));
let userRatings = seedUserRatings.map((rating) => ({ ...rating }));

export function getNearbyBathrooms(filters: BathroomFilters = {}): Bathroom[] {
  const preferredFeatures: FeatureTag[] = [
    filters.wheelchair ? 'wheelchair_accessible' : null,
    filters.babyChanging ? 'baby_changing' : null,
    filters.allGender ? 'all_gender' : null,
    filters.singleStall ? 'single_stall' : null,
  ].filter(Boolean) as FeatureTag[];

  return bathrooms
    .map((bathroom) => ({
      ...bathroom,
      scores: {
        ...bathroom.scores,
        recommendation: recommendationScore({
          bathroom,
          targetLatitude: DEFAULT_LATITUDE,
          targetLongitude: DEFAULT_LONGITUDE,
          preferredFeatures,
        }),
      },
    }))
    .filter((bathroom) => matchesFilters(bathroom, filters))
    .sort((a, b) => b.scores.recommendation - a.scores.recommendation);
}

export function getBathroomById(id: string): Bathroom | undefined {
  return bathrooms.find((bathroom) => bathroom.id === id);
}

export function getRankedBathrooms(): Array<{ bathroom: Bathroom; rating: UserRating; score: number; rank: number }> {
  const scores = scoreMapFromRatings(userRatings);
  return sortRatings(userRatings)
    .map((rating, index) => {
      const bathroom = getBathroomById(rating.bathroomId);
      if (!bathroom) {
        return null;
      }
      return {
        bathroom,
        rating,
        score: scores[rating.bathroomId] ?? bathroom.scores.personal ?? bathroom.scores.community,
        rank: index + 1,
      };
    })
    .filter(Boolean) as Array<{ bathroom: Bathroom; rating: UserRating; score: number; rank: number }>;
}

export function getFeedItems(): FeedItem[] {
  return seedFeed;
}

export function getLists() {
  return seedLists.map((list) => ({
    ...list,
    bathrooms: list.bathroomIds.map(getBathroomById).filter(Boolean) as Bathroom[],
  }));
}

export function getProfileSummary() {
  const ranked = getRankedBathrooms();
  const visitedIds = new Set(visits.map((visit) => visit.bathroomId));
  const favoriteTags = visits.flatMap((visit) => visit.tags);
  return {
    displayName: 'Colin',
    handle: '@bathroomscout',
    city: 'New York',
    rankedCount: ranked.length,
    visitedCount: visitedIds.size,
    listsCount: seedLists.length,
    confidenceBoosts: bathrooms.reduce((sum, bathroom) => sum + bathroom.sourceRefs[0].confirmedByUsers, 0),
    favoriteTags,
  };
}

export function createBathroomCandidate(input: Pick<Bathroom, 'name' | 'address' | 'latitude' | 'longitude' | 'access'>) {
  const candidate: Bathroom = {
    ...input,
    id: `user-${Date.now()}`,
    kind: 'User submitted restroom',
    neighborhood: '',
    city: 'New York',
    priceNote: 'Unverified',
    openingHours: 'Unknown',
    isOpenNow: true,
    confidence: 0.35,
    features: [],
    directionsNote: '',
    sourceRefs: [
      {
        sourceName: 'user',
        sourceId: `submission-${Date.now()}`,
        fetchedAt: new Date().toISOString(),
        license: 'User contributed',
        confidence: 0.35,
        confirmedByUsers: 0,
        contradictedByUsers: 0,
      },
    ],
    photos: [],
    reportsSummary: {},
    scores: { community: 6, confidence: 0.35, recommendation: 0.4 },
    userStatus: 'unvisited',
    lastConfirmedAt: new Date().toISOString(),
  };
  bathrooms = [candidate, ...bathrooms];
  return candidate;
}

export function logVisit(input: {
  bathroomId: string;
  sentiment: Sentiment;
  publicNote: string;
  tags: FeatureTag[];
  privateNote?: string;
}): Visit {
  const visit: Visit = {
    id: `visit-${Date.now()}`,
    bathroomId: input.bathroomId,
    userId: 'demo-user',
    sentiment: input.sentiment,
    publicNote: input.publicNote,
    privateNote: input.privateNote,
    tags: input.tags,
    companionIds: [],
    createdAt: new Date().toISOString(),
  };
  visits = [visit, ...visits];

  if (!userRatings.some((rating) => rating.bathroomId === input.bathroomId)) {
    const seed = input.sentiment === 'liked' ? 1550 : input.sentiment === 'fine' ? 1500 : 1450;
    userRatings = [{ bathroomId: input.bathroomId, rating: seed, comparisons: 0, sentiment: input.sentiment }, ...userRatings];
  }

  bathrooms = bathrooms.map((bathroom) =>
    bathroom.id === input.bathroomId ? { ...bathroom, userStatus: 'visited' } : bathroom,
  );

  return visit;
}

export function recordComparison(winnerId: string, loserId: string): UserRating[] {
  userRatings = applyEloComparison(userRatings, winnerId, loserId);
  return userRatings;
}

export function createReport(bathroomId: string, reason: ReportReason): Bathroom | undefined {
  bathrooms = bathrooms.map((bathroom) => {
    if (bathroom.id !== bathroomId) {
      return bathroom;
    }
    return {
      ...bathroom,
      confidence: Math.max(0.2, Math.round((bathroom.confidence - 0.04) * 100) / 100),
      reportsSummary: {
        ...bathroom.reportsSummary,
        [reason]: (bathroom.reportsSummary[reason] ?? 0) + 1,
      },
    };
  });
  return getBathroomById(bathroomId);
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
