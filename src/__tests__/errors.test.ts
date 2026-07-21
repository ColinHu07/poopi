import assert from 'node:assert/strict';
import test from 'node:test';

import { errorMessage } from '@/src/lib/errors';

test('Supabase-style plain error objects keep their useful message', () => {
  assert.equal(
    errorMessage({ code: 'P0001', message: 'A permanent account is required to add a bathroom' }, 'Fallback'),
    'A permanent account is required to add a bathroom',
  );
});

test('unknown errors use the supplied fallback', () => {
  assert.equal(errorMessage({ code: 'UNKNOWN' }, 'Unable to add this bathroom.'), 'Unable to add this bathroom.');
});
