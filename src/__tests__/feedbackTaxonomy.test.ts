import assert from 'node:assert/strict';
import test from 'node:test';

import { isBathroomFeature, normalizeBathroomFeatures } from '@/src/data/bathroomFeatures';
import { RATING_LABELS } from '@/src/data/types';
import {
  isAccessType,
  isDimensionRating,
  isOperatingStatus,
  isVisitVisibility,
  isWaitBucket,
} from '@/src/data/visitObservations';

test('bathroom features contain durable facts and reject temporary conditions', () => {
  assert.equal(isBathroomFeature('wheelchair_accessible'), true);
  assert.equal(isBathroomFeature('multiple_stalls'), true);
  assert.equal(isBathroomFeature('clean'), false);
  assert.equal(isBathroomFeature('safe'), false);
  assert.equal(isBathroomFeature('long_line'), false);
  assert.equal(isBathroomFeature('out_of_order'), false);
  assert.deepEqual(
    normalizeBathroomFeatures(['mirror', 'clean', 'mirror', 'grab_bars']),
    ['mirror', 'grab_bars'],
  );
});

test('visit observation dimensions and controlled values validate at runtime', () => {
  assert.equal(isDimensionRating(1), true);
  assert.equal(isDimensionRating(5), true);
  assert.equal(isDimensionRating(0), false);
  assert.equal(isDimensionRating(3.5), false);
  assert.equal(isWaitBucket('five_to_ten'), true);
  assert.equal(isWaitBucket('soon'), false);
  assert.equal(isOperatingStatus('partly_out_of_order'), true);
  assert.equal(isOperatingStatus('probably_open'), false);
  assert.equal(isVisitVisibility('friends'), true);
  assert.equal(isVisitVisibility('everyone'), false);
  assert.equal(isAccessType('code_required'), true);
  assert.equal(isAccessType('maybe_public'), false);
});

test('the approved rating label catalog remains unique', () => {
  assert.equal(RATING_LABELS.length, 46);
  assert.equal(new Set(RATING_LABELS).size, RATING_LABELS.length);
});

