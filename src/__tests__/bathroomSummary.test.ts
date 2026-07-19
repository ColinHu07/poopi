import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bayesianCommunityScore,
  confirmationLabel,
  currentOperatingStatus,
  freshnessState,
  medianRecentWait,
  recencyWeightedScore,
  summaryConfidence,
} from '@/src/lib/bathroomSummary';

const NOW = new Date('2026-07-19T12:00:00.000Z');

test('recent dimension ratings influence the summary more than old ratings', () => {
  const score = recencyWeightedScore(
    [
      { value: 5, observedAt: '2026-07-19T11:00:00.000Z' },
      { value: 1, observedAt: '2026-01-19T12:00:00.000Z' },
    ],
    NOW,
  );
  assert.equal(score, 4.8);
});

test('community score uses a neutral Bayesian prior and stays unknown with no reviews', () => {
  assert.equal(bayesianCommunityScore([], NOW), undefined);
  assert.equal(bayesianCommunityScore([{ score: 9, observedAt: NOW.toISOString() }], NOW), 6.5);
});

test('median wait ignores observations older than 90 days', () => {
  assert.equal(
    medianRecentWait(
      [
        { wait: 'over_twenty', observedAt: '2026-01-01T12:00:00.000Z' },
        { wait: 'under_five', observedAt: '2026-07-18T12:00:00.000Z' },
        { wait: 'five_to_ten', observedAt: '2026-07-17T12:00:00.000Z' },
      ],
      NOW,
    ),
    'under_five',
  );
});

test('operating status expires after 24 hours instead of pretending stale data is current', () => {
  assert.equal(
    currentOperatingStatus([{ status: 'open', observedAt: '2026-07-19T01:00:00.000Z' }], NOW),
    'open',
  );
  assert.equal(
    currentOperatingStatus([{ status: 'open', observedAt: '2026-07-17T01:00:00.000Z' }], NOW),
    'unknown',
  );
});

test('freshness, confirmation copy, and confidence preserve honest unknown states', () => {
  assert.equal(freshnessState(undefined, NOW), 'unknown');
  assert.equal(confirmationLabel(undefined, NOW), 'Never confirmed');
  assert.equal(freshnessState('2026-07-19T01:00:00.000Z', NOW), 'fresh');
  const sparse = summaryConfidence({
    sourceConfidence: 0.6,
    confirmations: 0,
    contradictions: 0,
    reviewCount: 0,
    freshness: 'unknown',
  });
  const established = summaryConfidence({
    sourceConfidence: 0.8,
    confirmations: 12,
    contradictions: 1,
    reviewCount: 10,
    freshness: 'fresh',
  });
  assert.ok(established > sparse);
  assert.ok(sparse >= 0 && established <= 1);
});

