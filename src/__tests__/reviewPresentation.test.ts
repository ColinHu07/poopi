import assert from 'node:assert/strict';
import test from 'node:test';

import type { PublicBathroomReview } from '@/src/data/types';
import { aggregateRatingLabels, formatReviewAge } from '@/src/lib/reviewPresentation';

function review(id: string, labels: PublicBathroomReview['ratingTags']): PublicBathroomReview {
  return {
    id,
    bathroomId: 'bathroom',
    sentiment: 'liked',
    ratingTags: labels,
    publicNote: '',
    observedStatus: 'open',
    observedAt: '2026-07-19T12:00:00.000Z',
    createdAt: '2026-07-19T12:00:00.000Z',
  };
}

test('review labels aggregate unique endorsements and sort by frequency', () => {
  const labels = aggregateRatingLabels([
    review('one', ['sparkling_clean', 'short_line', 'short_line']),
    review('two', ['sparkling_clean', 'dirty']),
  ]);

  assert.deepEqual(
    labels.map(({ id, count, tone }) => ({ id, count, tone })),
    [
      { id: 'sparkling_clean', count: 2, tone: 'positive' },
      { id: 'dirty', count: 1, tone: 'negative' },
      { id: 'short_line', count: 1, tone: 'positive' },
    ],
  );
});

test('review age keeps recent observations easy to scan', () => {
  const now = new Date('2026-07-20T12:00:00.000Z');
  assert.equal(formatReviewAge('2026-07-20T11:30:00.000Z', now), 'Just now');
  assert.equal(formatReviewAge('2026-07-20T07:00:00.000Z', now), '5h ago');
  assert.equal(formatReviewAge('2026-07-17T12:00:00.000Z', now), '3d ago');
});
