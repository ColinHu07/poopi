import { getRatingLabelDefinition } from '@/src/data/ratingLabels';
import type { PublicBathroomReview, RatingLabel, ReportReason, Sentiment } from '@/src/data/types';

export interface AggregatedRatingLabel {
  id: RatingLabel;
  label: string;
  count: number;
  tone: 'positive' | 'negative';
}

export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  liked: 'Liked',
  fine: 'Fine',
  disliked: 'Disliked',
};

export const REPORT_REASON_OPTIONS: Array<{
  id: ReportReason;
  label: string;
  details?: string;
}> = [
  { id: 'closed', label: 'Closed permanently' },
  { id: 'inaccurate', label: 'Out of order', details: 'Bathroom reported out of order.' },
  { id: 'unsafe', label: 'Feels unsafe' },
  { id: 'inaccessible', label: 'Accessibility is inaccurate' },
  { id: 'inaccurate', label: 'Other information is inaccurate' },
  { id: 'duplicate', label: 'Duplicate bathroom' },
  { id: 'privacy', label: 'Privacy concern' },
];

export function aggregateRatingLabels(reviews: PublicBathroomReview[]): AggregatedRatingLabel[] {
  const counts = new Map<RatingLabel, number>();
  for (const review of reviews) {
    for (const label of new Set(review.ratingTags)) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([id, count]) => {
      const definition = getRatingLabelDefinition(id);
      return { id, count, label: definition.label, tone: definition.tone };
    })
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function formatReviewAge(observedAt: string, now = new Date()): string {
  const elapsedMs = Math.max(0, now.getTime() - new Date(observedAt).getTime());
  const hours = Math.floor(elapsedMs / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(observedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
