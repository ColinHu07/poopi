import type { FreshnessState, OperatingStatus, WaitBucket } from '@/src/data/types';

export const SUMMARY_HALF_LIFE_DAYS = 45;
export const WAIT_WINDOW_DAYS = 90;
export const STATUS_FRESH_HOURS = 24;

const WAIT_ORDER: WaitBucket[] = ['none', 'under_five', 'five_to_ten', 'ten_to_twenty', 'over_twenty'];

export interface TimestampedValue {
  value: number;
  observedAt: string;
}

export interface TimestampedWait {
  wait: WaitBucket;
  observedAt: string;
}

export interface TimestampedStatus {
  status: OperatingStatus;
  observedAt: string;
}

export interface TimestampedCommunityRating {
  score: 3 | 6 | 9;
  observedAt: string;
}

export function recencyWeight(observedAt: string, now = new Date()): number {
  const ageDays = Math.max(0, (now.getTime() - new Date(observedAt).getTime()) / 86_400_000);
  return Math.pow(0.5, ageDays / SUMMARY_HALF_LIFE_DAYS);
}

export function recencyWeightedScore(values: TimestampedValue[], now = new Date()): number | undefined {
  if (!values.length) return undefined;
  const weighted = values.reduce(
    (total, item) => {
      const weight = recencyWeight(item.observedAt, now);
      return { value: total.value + item.value * weight, weight: total.weight + weight };
    },
    { value: 0, weight: 0 },
  );
  return Math.round((weighted.value / weighted.weight) * 10) / 10;
}

export function bayesianCommunityScore(
  values: TimestampedCommunityRating[],
  now = new Date(),
): number | undefined {
  if (!values.length) return undefined;
  const weighted = values.reduce(
    (total, item) => {
      const weight = recencyWeight(item.observedAt, now);
      return { value: total.value + item.score * weight, weight: total.weight + weight };
    },
    { value: 0, weight: 0 },
  );
  return Math.round(((weighted.value + 30) / (weighted.weight + 5)) * 10) / 10;
}

export function medianRecentWait(values: TimestampedWait[], now = new Date()): WaitBucket | undefined {
  const cutoff = now.getTime() - WAIT_WINDOW_DAYS * 86_400_000;
  const ordered = values
    .filter((item) => new Date(item.observedAt).getTime() >= cutoff)
    .map((item) => WAIT_ORDER.indexOf(item.wait))
    .filter((value) => value >= 0)
    .sort((left, right) => left - right);
  if (!ordered.length) return undefined;
  return WAIT_ORDER[ordered[Math.floor((ordered.length - 1) / 2)]];
}

export function currentOperatingStatus(values: TimestampedStatus[], now = new Date()): OperatingStatus {
  const latest = values
    .filter((item) => item.status !== 'unknown')
    .sort((left, right) => new Date(right.observedAt).getTime() - new Date(left.observedAt).getTime())[0];
  if (!latest) return 'unknown';
  const ageHours = (now.getTime() - new Date(latest.observedAt).getTime()) / 3_600_000;
  return ageHours <= STATUS_FRESH_HOURS ? latest.status : 'unknown';
}

export function freshnessState(lastConfirmedAt: string | undefined, now = new Date()): FreshnessState {
  if (!lastConfirmedAt) return 'unknown';
  const ageHours = Math.max(0, (now.getTime() - new Date(lastConfirmedAt).getTime()) / 3_600_000);
  if (ageHours <= 24) return 'fresh';
  if (ageHours <= 24 * 7) return 'aging';
  return 'stale';
}

export function summaryConfidence(input: {
  sourceConfidence: number;
  confirmations: number;
  contradictions: number;
  reviewCount: number;
  freshness: FreshnessState;
}): number {
  const voteQuality = (input.confirmations + 1) / (input.confirmations + input.contradictions + 2);
  const sourceSignal = input.sourceConfidence * 0.8 + voteQuality * 0.2;
  const reviewSignal = Math.min(1, Math.log1p(input.reviewCount) / Math.log(11));
  const freshnessSignal = { fresh: 1, aging: 0.7, stale: 0.25, unknown: 0 }[input.freshness];
  return Math.round(Math.min(1, Math.max(0, sourceSignal * 0.55 + reviewSignal * 0.25 + freshnessSignal * 0.2)) * 100) / 100;
}

export const WAIT_LABELS: Record<WaitBucket, string> = {
  none: 'No wait',
  under_five: 'Under 5 min',
  five_to_ten: '5–10 min',
  ten_to_twenty: '10–20 min',
  over_twenty: '20+ min',
};

export const STATUS_LABELS: Record<OperatingStatus, string> = {
  open: 'Open',
  closed: 'Closed',
  partly_out_of_order: 'Partly out of order',
  out_of_order: 'Out of order',
  unknown: 'Status unknown',
};

export const FRESHNESS_LABELS: Record<FreshnessState, string> = {
  fresh: 'Fresh',
  aging: 'Aging',
  stale: 'Stale',
  unknown: 'Unknown',
};

export function confidenceLabel(confidence: number): 'Low' | 'Medium' | 'High' {
  if (confidence < 0.4) return 'Low';
  if (confidence < 0.75) return 'Medium';
  return 'High';
}

export function confirmationLabel(lastConfirmedAt: string | undefined, now = new Date()): string {
  if (!lastConfirmedAt) return 'Never confirmed';
  const ageHours = Math.max(0, (now.getTime() - new Date(lastConfirmedAt).getTime()) / 3_600_000);
  if (ageHours < 1) return 'Confirmed less than an hour ago';
  if (ageHours < 24) return `Confirmed ${Math.floor(ageHours)}h ago`;
  const ageDays = Math.floor(ageHours / 24);
  return `Confirmed ${ageDays}d ago`;
}
