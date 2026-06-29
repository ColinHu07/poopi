import assert from 'node:assert/strict';
import test from 'node:test';

import { seedBathrooms } from '@/src/data/fixtures';
import { arePotentialDuplicates, normalizeName } from '@/src/lib/dedupe';
import { normalizeOsmToilet, normalizeRefugeRestroom } from '@/src/services/sourceNormalizers';

test('normalizeRefugeRestroom maps accessibility and changing table fields', () => {
  const bathroom = normalizeRefugeRestroom({
    id: 12,
    name: 'Library',
    street: '1 Main St',
    city: 'New York',
    state: 'NY',
    accessible: true,
    unisex: true,
    directions: 'Back hall',
    comment: 'No purchase',
    latitude: 40,
    longitude: -73,
    updated_at: '2026-01-01T00:00:00.000Z',
    downvote: 1,
    upvote: 4,
    country: 'US',
    changing_table: true,
    approved: true,
  });

  assert.equal(bathroom.id, 'refuge-12');
  assert.deepEqual(bathroom.features.sort(), ['all_gender', 'baby_changing', 'single_stall', 'wheelchair_accessible'].sort());
  assert.equal(bathroom.sourceRefs[0].sourceName, 'refuge');
});

test('normalizeOsmToilet maps fee and wheelchair tags', () => {
  const bathroom = normalizeOsmToilet({
    type: 'node',
    id: 42,
    lat: 40,
    lon: -73,
    tags: {
      amenity: 'toilets',
      name: 'Park toilet',
      fee: 'yes',
      wheelchair: 'yes',
      changing_table: 'yes',
      opening_hours: '24/7',
    },
  });

  assert.equal(bathroom.access, 'paid');
  assert.equal(bathroom.priceNote, 'Fee reported');
  assert.ok(bathroom.features.includes('wheelchair_accessible'));
  assert.ok(bathroom.features.includes('baby_changing'));
});

test('dedupe uses source ids, proximity, and normalized names', () => {
  assert.equal(normalizeName('The Bryant Park Public Restroom'), 'bryant park');

  const decision = arePotentialDuplicates(seedBathrooms[0], {
    ...seedBathrooms[0],
    id: 'copy',
    name: 'Bryant Park Bathroom',
    latitude: seedBathrooms[0].latitude + 0.00002,
    longitude: seedBathrooms[0].longitude + 0.00002,
  });

  assert.equal(decision.duplicate, true);
  assert.ok(decision.confidence >= 0.55);
});
