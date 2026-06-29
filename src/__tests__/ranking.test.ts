import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyEloComparison,
  communityScore,
  displayScore,
  expectedScore,
  kFactor,
  selectBinaryInsertionPair,
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
