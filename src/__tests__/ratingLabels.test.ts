import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RATING_LABEL_DEFINITIONS,
  getInitialRatingLabelTone,
  getRatingLabels,
  isRatingLabel,
  normalizeRatingLabels,
  searchRatingLabels,
} from '@/src/data/ratingLabels';
import { NEGATIVE_RATING_LABELS, POSITIVE_RATING_LABELS, RATING_LABELS } from '@/src/data/types';

test('rating label catalog includes every unique supported label', () => {
  assert.equal(POSITIVE_RATING_LABELS.length, 30);
  assert.equal(NEGATIVE_RATING_LABELS.length, 16);
  assert.equal(RATING_LABEL_DEFINITIONS.length, RATING_LABELS.length);
  assert.equal(new Set(RATING_LABELS).size, RATING_LABELS.length);
  assert.deepEqual(
    new Set(RATING_LABEL_DEFINITIONS.map((definition) => definition.id)),
    new Set(RATING_LABELS),
  );
});

test('good and bad labels are returned separately in alphabetical order', () => {
  const goodLabels = getRatingLabels('positive').map((definition) => definition.label);
  const badLabels = getRatingLabels('negative').map((definition) => definition.label);

  assert.equal(goodLabels.length, 30);
  assert.equal(badLabels.length, 16);
  assert.deepEqual(goodLabels, [...goodLabels].sort((left, right) => left.localeCompare(right)));
  assert.deepEqual(badLabels, [...badLabels].sort((left, right) => left.localeCompare(right)));
});

test('label search is case-insensitive and remains scoped to its section', () => {
  assert.deepEqual(
    searchRatingLabels('positive', 'STALL').map((definition) => definition.id),
    ['minimal_stall_gaps', 'plenty_of_stalls', 'single_stall'],
  );
  assert.deepEqual(
    searchRatingLabels('negative', 'stall').map((definition) => definition.id),
    [],
  );
});

test('overall sentiment chooses the useful initial label tone', () => {
  assert.equal(getInitialRatingLabelTone('liked'), 'positive');
  assert.equal(getInitialRatingLabelTone('fine'), 'positive');
  assert.equal(getInitialRatingLabelTone('disliked'), 'negative');
});

test('rating label normalization removes duplicates and unsupported values', () => {
  assert.equal(isRatingLabel('sparkling_clean'), true);
  assert.equal(isRatingLabel('restaurant_vibes'), false);
  assert.deepEqual(
    normalizeRatingLabels(['sparkling_clean', 'restaurant_vibes', 'sparkling_clean', 'long_line']),
    ['sparkling_clean', 'long_line'],
  );
});
