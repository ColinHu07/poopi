import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyEloComparison,
  communityScore,
  displayScore,
  expectedScore,
  kFactor,
  rankCommunityComparisons,
  reviewQualityScore,
  reviewSeedRating,
  selectBinaryInsertionPair,
  selectSmartComparisonPair,
  voterWeight,
} from '@/src/lib/ranking';
import type { PairwiseComparison, UserRating } from '@/src/data/types';

test('expectedScore is symmetric around equal ratings', () => {
  assert.equal(expectedScore(1500, 1500), 0.5);
  assert.equal(Math.round(expectedScore(1900, 1500) * 100) / 100, 0.91);
});

test('kFactor steps down as comparison history grows', () => {
  assert.equal(kFactor(0), 48);
  assert.equal(kFactor(20), 32);
  assert.equal(kFactor(100), 16);
});

test('applyEloComparison rewards the winner and penalizes the loser', () => {
  const ratings: UserRating[] = [
    { bathroomId: 'a', rating: 1500, comparisons: 0, sentiment: 'fine' },
    { bathroomId: 'b', rating: 1500, comparisons: 0, sentiment: 'fine' },
  ];

  const next = applyEloComparison(ratings, 'a', 'b');
  assert.equal(next.find((rating) => rating.bathroomId === 'a')?.rating, 1524);
  assert.equal(next.find((rating) => rating.bathroomId === 'b')?.rating, 1476);
});

test('displayScore maps rank into a bounded 0 to 10 display scale', () => {
  const rating: UserRating = { bathroomId: 'top', rating: 1700, comparisons: 12, sentiment: 'liked' };
  assert.equal(displayScore(0, 8, rating), 9.9);
  assert.equal(displayScore(7, 8, rating), 1);
});

test('communityScore uses a Bayesian prior', () => {
  assert.equal(communityScore([], 6, 5), 6);
  assert.equal(communityScore([10], 6, 5), 6.7);
});

test('structured review dimensions seed a sensible personal rating', () => {
  assert.equal(
    reviewQualityScore({ sentiment: 'liked', cleanlinessRating: 5, odorRating: 5, privacyRating: 4 }),
    8.8,
  );
  assert.ok(
    reviewSeedRating({ sentiment: 'liked', cleanlinessRating: 5, odorRating: 5, privacyRating: 4 }) >
      reviewSeedRating({ sentiment: 'disliked', cleanlinessRating: 2, odorRating: 1, privacyRating: 2 }),
  );
});

test('voterWeight grows slowly with history and caps expert influence at 2x', () => {
  assert.equal(voterWeight(0), 1);
  assert.equal(voterWeight(25), 1.5);
  assert.equal(voterWeight(100), 2);
  assert.equal(voterWeight(10_000), 2);
});

test('community ranking pools comparisons and interpolates the resulting order', () => {
  const ranked = rankCommunityComparisons([
    { winnerId: 'a', loserId: 'b', voterComparisonCount: 4 },
    { winnerId: 'a', loserId: 'c', voterComparisonCount: 9 },
    { winnerId: 'b', loserId: 'c', voterComparisonCount: 16 },
  ]);

  assert.deepEqual(
    ranked.map(({ bathroomId, score }) => ({ bathroomId, score })),
    [
      { bathroomId: 'a', score: 10 },
      { bathroomId: 'b', score: 5.5 },
      { bathroomId: 'c', score: 1 },
    ],
  );
  assert.ok(ranked.every(({ confidence }) => confidence > 0 && confidence < 1));
});

test('an experienced voter breaks a one-to-one disagreement without dominating a majority', () => {
  const expertWins = rankCommunityComparisons([
    { winnerId: 'a', loserId: 'b', voterComparisonCount: 100 },
    { winnerId: 'b', loserId: 'a', voterComparisonCount: 0 },
  ]);
  assert.equal(expertWins[0].bathroomId, 'a');

  const majorityWins = rankCommunityComparisons([
    { winnerId: 'a', loserId: 'b', voterComparisonCount: 100 },
    { winnerId: 'b', loserId: 'a', voterComparisonCount: 0 },
    { winnerId: 'b', loserId: 'a', voterComparisonCount: 0 },
    { winnerId: 'b', loserId: 'a', voterComparisonCount: 0 },
  ]);
  assert.equal(majorityWins[0].bathroomId, 'b');
});

test('selectBinaryInsertionPair picks the median unasked candidate and stops after five comparisons', () => {
  const answered: PairwiseComparison[] = [
    { id: '1', userId: 'u', winnerId: 'new', loserId: 'b', createdAt: 'now' },
  ];

  assert.equal(selectBinaryInsertionPair('new', ['a', 'b', 'c', 'd', 'e'], answered), 'd');
  assert.equal(
    selectBinaryInsertionPair('new', ['a', 'b', 'c'], [
      ...answered,
      { id: '2', userId: 'u', winnerId: 'a', loserId: 'new', createdAt: 'now' },
      { id: '3', userId: 'u', winnerId: 'new', loserId: 'c', createdAt: 'now' },
      { id: '4', userId: 'u', winnerId: 'new', loserId: 'd', createdAt: 'now' },
      { id: '5', userId: 'u', winnerId: 'e', loserId: 'new', createdAt: 'now' },
    ]),
    null,
  );
});

test('smart comparison pairs a new review with a recent bathroom of similar quality', () => {
  const pair = selectSmartComparisonPair(
    [
      {
        bathroomId: 'new',
        sentiment: 'liked',
        cleanlinessRating: 4,
        odorRating: 4,
        privacyRating: 5,
        personalScore: 8.4,
        comparisons: 0,
        reviewedAt: '2026-07-21T12:00:00.000Z',
      },
      {
        bathroomId: 'old-close',
        sentiment: 'liked',
        cleanlinessRating: 4,
        odorRating: 4,
        privacyRating: 4,
        personalScore: 8.2,
        comparisons: 2,
        reviewedAt: '2026-01-01T12:00:00.000Z',
      },
      {
        bathroomId: 'recent-close',
        sentiment: 'liked',
        cleanlinessRating: 4,
        odorRating: 4,
        privacyRating: 4,
        personalScore: 8.2,
        comparisons: 1,
        reviewedAt: '2026-07-20T12:00:00.000Z',
      },
      {
        bathroomId: 'recent-far',
        sentiment: 'disliked',
        cleanlinessRating: 1,
        odorRating: 2,
        privacyRating: 1,
        personalScore: 3.1,
        comparisons: 1,
        reviewedAt: '2026-07-21T11:00:00.000Z',
      },
    ],
    [],
    'new',
    new Date('2026-07-21T13:00:00.000Z'),
  );

  assert.equal(pair?.focusId, 'new');
  assert.equal(pair?.opponentId, 'recent-close');
});

test('smart comparison does not repeat a pair that was already answered', () => {
  const candidates = [
    { bathroomId: 'new', sentiment: 'fine' as const, personalScore: 6, comparisons: 0, reviewedAt: '2026-07-21' },
    { bathroomId: 'same', sentiment: 'fine' as const, personalScore: 6.1, comparisons: 0, reviewedAt: '2026-07-20' },
    { bathroomId: 'next', sentiment: 'liked' as const, personalScore: 7.4, comparisons: 0, reviewedAt: '2026-07-19' },
  ];
  const answered: PairwiseComparison[] = [
    { id: '1', userId: 'u', winnerId: 'new', loserId: 'same', createdAt: '2026-07-21' },
  ];

  assert.equal(selectSmartComparisonPair(candidates, answered, 'new')?.opponentId, 'next');
});
