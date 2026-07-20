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
