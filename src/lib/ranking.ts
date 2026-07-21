import type { Bathroom, FeatureTag, PairwiseComparison, Sentiment, UserRating } from '@/src/data/types';

const SENTIMENT_SEED: Record<Sentiment, number> = {
  liked: 1550,
  fine: 1500,
  disliked: 1450,
};

const SENTIMENT_ANCHOR: Record<Sentiment, number> = {
  liked: 8.2,
  fine: 6.0,
  disliked: 3.8,
};

export interface ReviewQualityInput {
  sentiment: Sentiment;
  cleanlinessRating?: number;
  odorRating?: number;
  privacyRating?: number;
}

export interface SmartComparisonCandidate extends ReviewQualityInput {
  bathroomId: string;
  personalScore: number;
  comparisons: number;
  reviewedAt?: string;
}

export interface SmartComparisonPair {
  focusId: string;
  opponentId: string;
  qualityGap: number;
}

export function seedRating(sentiment: Sentiment): number {
  return SENTIMENT_SEED[sentiment];
}

/**
 * Blends the quick overall reaction with the concrete visit dimensions. The
 * dimensions carry slightly more weight because they are more useful when
 * finding a close comparison opponent.
 */
export function reviewQualityScore({
  cleanlinessRating,
  odorRating,
  privacyRating,
  sentiment,
}: ReviewQualityInput): number {
  const dimensions = [cleanlinessRating, odorRating, privacyRating].filter(
    (value): value is number => Number.isFinite(value),
  );
  if (dimensions.length === 0) {
    return SENTIMENT_ANCHOR[sentiment];
  }

  const dimensionScore = (dimensions.reduce((sum, value) => sum + clamp(value, 1, 5), 0) / dimensions.length) * 2;
  return roundToTenth(clamp(SENTIMENT_ANCHOR[sentiment] * 0.45 + dimensionScore * 0.55, 1, 10));
}

/** Seeds a new personal Elo rating from the structured review before any comparisons. */
export function reviewSeedRating(input: ReviewQualityInput): number {
  return Math.round(clamp(1500 + (reviewQualityScore(input) - 6) * 50, 1350, 1700));
}

export function expectedScore(itemRating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - itemRating) / 400));
}

export function kFactor(comparisonCount: number): number {
  if (comparisonCount < 20) {
    return 48;
  }
  if (comparisonCount < 100) {
    return 32;
  }
  return 16;
}

export function applyEloComparison(
  ratings: UserRating[],
  winnerId: string,
  loserId: string,
): UserRating[] {
  const next = ratings.map((rating) => ({ ...rating }));
  const winner = next.find((rating) => rating.bathroomId === winnerId);
  const loser = next.find((rating) => rating.bathroomId === loserId);

  if (!winner || !loser) {
    return next;
  }

  const winnerExpected = expectedScore(winner.rating, loser.rating);
  const loserExpected = expectedScore(loser.rating, winner.rating);
  const winnerK = kFactor(winner.comparisons);
  const loserK = kFactor(loser.comparisons);

  winner.rating = Math.round(winner.rating + winnerK * (1 - winnerExpected));
  loser.rating = Math.round(loser.rating + loserK * (0 - loserExpected));
  winner.comparisons += 1;
  loser.comparisons += 1;

  return next;
}

export function sortRatings(ratings: UserRating[]): UserRating[] {
  return [...ratings].sort((a, b) => b.rating - a.rating);
}

export function displayScore(rankIndex: number, listSize: number, rating: UserRating): number {
  if (listSize < 2) {
    return SENTIMENT_ANCHOR[rating.sentiment];
  }

  const rankScore = clamp(10 * (1 - rankIndex / (listSize - 1)), 1, 9.9);
  if (rating.comparisons >= 10) {
    return roundToTenth(rankScore);
  }

  const anchor = SENTIMENT_ANCHOR[rating.sentiment];
  const blend = rankScore * 0.8 + anchor * 0.2;
  return roundToTenth(clamp(blend, 1, 9.9));
}

export function scoreMapFromRatings(ratings: UserRating[]): Record<string, number> {
  const sorted = sortRatings(ratings);
  return Object.fromEntries(
    sorted.map((rating, index) => [rating.bathroomId, displayScore(index, sorted.length, rating)]),
  );
}

export function communityScore(scores: number[], prior = 6, priorWeight = 5): number {
  if (scores.length === 0) {
    return prior;
  }
  const total = scores.reduce((sum, score) => sum + score, 0);
  return roundToTenth((total + prior * priorWeight) / (scores.length + priorWeight));
}

export interface CommunityComparison {
  winnerId: string;
  loserId: string;
  voterComparisonCount: number;
}

export interface CommunityRank {
  bathroomId: string;
  score: number;
  confidence: number;
  comparisonWeight: number;
}

/**
 * Gives experienced contributors modestly more influence without allowing a
 * power user to dominate. Weight grows with the square root of history and is
 * capped at 2x a new contributor.
 */
export function voterWeight(comparisonCount: number): number {
  const boundedCount = clamp(Math.max(0, comparisonCount), 0, 100);
  return 1 + Math.sqrt(boundedCount / 100);
}

/**
 * Fits a regularized Bradley-Terry model to weighted head-to-head votes, then
 * linearly maps the resulting community order onto a 1–10 display scale.
 *
 * The Gaussian-style regularization keeps sparse or disconnected comparison
 * graphs near neutral and makes the result deterministic and finite.
 */
export function rankCommunityComparisons(comparisons: CommunityComparison[]): CommunityRank[] {
  const bathroomIds = [...new Set(comparisons.flatMap(({ winnerId, loserId }) => [winnerId, loserId]))].sort();
  if (bathroomIds.length === 0) {
    return [];
  }

  const strengths = Object.fromEntries(bathroomIds.map((id) => [id, 0])) as Record<string, number>;
  const comparisonWeights = Object.fromEntries(bathroomIds.map((id) => [id, 0])) as Record<string, number>;
  const weighted = comparisons
    .filter(({ winnerId, loserId }) => winnerId !== loserId)
    .map((comparison) => ({ ...comparison, weight: voterWeight(comparison.voterComparisonCount) }));

  for (const comparison of weighted) {
    comparisonWeights[comparison.winnerId] += comparison.weight;
    comparisonWeights[comparison.loserId] += comparison.weight;
  }

  const regularization = 1;
  for (let iteration = 0; iteration < 200; iteration += 1) {
    const gradients = Object.fromEntries(bathroomIds.map((id) => [id, -regularization * strengths[id]])) as Record<
      string,
      number
    >;

    for (const { loserId, weight, winnerId } of weighted) {
      const winProbability = 1 / (1 + Math.exp(strengths[loserId] - strengths[winnerId]));
      const residual = weight * (1 - winProbability);
      gradients[winnerId] += residual;
      gradients[loserId] -= residual;
    }

    for (const id of bathroomIds) {
      strengths[id] += 0.15 * (gradients[id] / (comparisonWeights[id] + regularization));
    }

    const mean = bathroomIds.reduce((sum, id) => sum + strengths[id], 0) / bathroomIds.length;
    for (const id of bathroomIds) {
      strengths[id] -= mean;
    }
  }

  const orderedIds = [...bathroomIds].sort(
    (a, b) => strengths[b] - strengths[a] || comparisonWeights[b] - comparisonWeights[a] || a.localeCompare(b),
  );

  return orderedIds.map((bathroomId, index) => ({
    bathroomId,
    score: orderedIds.length === 1 ? 6 : roundToTenth(10 - (9 * index) / (orderedIds.length - 1)),
    confidence: roundToHundredth(1 - Math.exp(-comparisonWeights[bathroomId] / 5)),
    comparisonWeight: roundToHundredth(comparisonWeights[bathroomId]),
  }));
}

export function selectBinaryInsertionPair(
  newBathroomId: string,
  rankedIds: string[],
  answeredComparisons: PairwiseComparison[],
): string | null {
  const alreadyCompared = new Set(
    answeredComparisons.flatMap((comparison) =>
      comparison.winnerId === newBathroomId
        ? [comparison.loserId]
        : comparison.loserId === newBathroomId
          ? [comparison.winnerId]
          : [],
    ),
  );
  const candidates = rankedIds.filter((id) => id !== newBathroomId && !alreadyCompared.has(id));

  if (candidates.length === 0 || answeredComparisons.length >= 5) {
    return null;
  }

  return candidates[Math.floor(candidates.length / 2)] ?? null;
}

/**
 * Chooses an unanswered opponent for the newly/recently rated bathroom. Close
 * review quality is the strongest signal, followed by personal score and how
 * recently the opponent was reviewed. This makes each question informative
 * without repeatedly asking about the same pair.
 */
export function selectSmartComparisonPair(
  candidates: SmartComparisonCandidate[],
  answeredComparisons: PairwiseComparison[],
  preferredBathroomId?: string,
  now = new Date(),
): SmartComparisonPair | null {
  if (candidates.length < 2) return null;

  const focus =
    candidates.find(({ bathroomId }) => bathroomId === preferredBathroomId) ??
    [...candidates].sort(
      (a, b) => timestamp(b.reviewedAt) - timestamp(a.reviewedAt) || a.bathroomId.localeCompare(b.bathroomId),
    )[0];
  if (!focus) return null;

  const comparedIds = new Set(
    answeredComparisons.flatMap((comparison) => {
      if (comparison.winnerId === focus.bathroomId) return [comparison.loserId];
      if (comparison.loserId === focus.bathroomId) return [comparison.winnerId];
      return [];
    }),
  );
  const focusQuality = reviewQualityScore(focus);
  const opponents = candidates
    .filter(({ bathroomId }) => bathroomId !== focus.bathroomId && !comparedIds.has(bathroomId))
    .map((candidate) => {
      const qualityGap = Math.abs(focusQuality - reviewQualityScore(candidate));
      const personalGap = Math.abs(focus.personalScore - candidate.personalScore);
      const ageDays = candidate.reviewedAt
        ? Math.max(0, (now.getTime() - timestamp(candidate.reviewedAt)) / 86_400_000)
        : 365;
      const selectionCost =
        qualityGap * 4 +
        personalGap * 0.35 +
        Math.min(ageDays, 90) * 0.025 +
        Math.abs(focus.comparisons - candidate.comparisons) * 0.02;
      return { candidate, qualityGap, selectionCost };
    })
    .sort(
      (a, b) =>
        a.selectionCost - b.selectionCost ||
        timestamp(b.candidate.reviewedAt) - timestamp(a.candidate.reviewedAt) ||
        a.candidate.bathroomId.localeCompare(b.candidate.bathroomId),
    );

  const opponent = opponents[0];
  return opponent
    ? {
        focusId: focus.bathroomId,
        opponentId: opponent.candidate.bathroomId,
        qualityGap: roundToTenth(opponent.qualityGap),
      }
    : null;
}

export interface RecommendationInput {
  bathroom: Bathroom;
  targetLatitude: number;
  targetLongitude: number;
  preferredFeatures: FeatureTag[];
}

export function recommendationScore({
  bathroom,
  targetLatitude,
  targetLongitude,
  preferredFeatures,
}: RecommendationInput): number {
  const needMatch = preferredFeatures.length
    ? preferredFeatures.filter((feature) => bathroom.features.includes(feature)).length / preferredFeatures.length
    : 0.8;
  const quality = bathroom.scores.community / 10;
  const confidence = bathroom.confidence;
  const proximity = clamp(1 - distanceKm(targetLatitude, targetLongitude, bathroom.latitude, bathroom.longitude) / 6, 0, 1);
  const freshness = bathroom.isOpenNow ? 1 : 0.35;

  return roundToHundredth(
    needMatch * 0.35 + quality * 0.25 + confidence * 0.15 + proximity * 0.15 + freshness * 0.1,
  );
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radiusKm = 6371;
  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degreesToRadians(lat1)) * Math.cos(degreesToRadians(lat2)) * Math.sin(dLon / 2) ** 2;

  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundToHundredth(value: number): number {
  return Math.round(value * 100) / 100;
}

function timestamp(value?: string): number {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}
