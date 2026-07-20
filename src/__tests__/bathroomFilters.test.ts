import assert from 'node:assert/strict';
import test from 'node:test';

import { seedBathrooms } from '@/src/data/fixtures';
import { matchesBathroomFilters } from '@/src/lib/bathroomFilters';

const base = seedBathrooms[0];

test('free filtering requires an explicit no-fee fact', () => {
  assert.equal(matchesBathroomFilters({ ...base, feeRequired: false }, { free: true }), true);
  assert.equal(matchesBathroomFilters({ ...base, feeRequired: true }, { free: true }), false);
  assert.equal(matchesBathroomFilters({ ...base, feeRequired: undefined }, { free: true }), false);
});

test('paid filtering uses cost independently from public access', () => {
  assert.equal(
    matchesBathroomFilters({ ...base, access: 'public', feeRequired: true }, { paid: true }),
    true,
  );
  assert.equal(
    matchesBathroomFilters({ ...base, access: 'paid', feeRequired: undefined }, { paid: true }),
    true,
  );
});

test('open-now filtering rejects unknown status even if legacy UI state says open', () => {
  assert.equal(
    matchesBathroomFilters(
      { ...base, isOpenNow: true, summary: { ...base.summary, operatingStatus: 'unknown' } },
      { openNow: true },
    ),
    false,
  );
});

test('public access excludes customer-only and unknown bathrooms', () => {
  assert.equal(matchesBathroomFilters({ ...base, access: 'public' }, { publicAccess: true }), true);
  assert.equal(matchesBathroomFilters({ ...base, access: 'customers_only' }, { publicAccess: true }), false);
  assert.equal(matchesBathroomFilters({ ...base, access: 'unknown' }, { publicAccess: true }), false);
});

test('wait and cleanliness thresholds exclude missing or worse observations', () => {
  const observed = {
    ...base,
    summary: { ...base.summary, medianWait: 'five_to_ten' as const, cleanlinessScore: 4.2 },
  };
  assert.equal(matchesBathroomFilters(observed, { maxWait: 'five_to_ten', minCleanliness: 4 }), true);
  assert.equal(matchesBathroomFilters(observed, { maxWait: 'under_five' }), false);
  assert.equal(matchesBathroomFilters(observed, { minCleanliness: 5 }), false);
  assert.equal(
    matchesBathroomFilters({ ...observed, summary: { ...observed.summary, medianWait: undefined } }, { maxWait: 'over_twenty' }),
    false,
  );
});
