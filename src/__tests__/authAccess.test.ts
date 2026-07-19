import assert from 'node:assert/strict';
import test from 'node:test';

import { canVoteInComparisons, isPermanentAccount } from '@/src/lib/authAccess';

test('public visitors have read access but no identity-bound write identity', () => {
  assert.equal(canVoteInComparisons(null), false);
  assert.equal(isPermanentAccount(null), false);
});

test('anonymous identities can vote but cannot make account contributions', () => {
  const anonymous = { id: 'anonymous-user', is_anonymous: true };
  assert.equal(canVoteInComparisons(anonymous), true);
  assert.equal(isPermanentAccount(anonymous), false);
});

test('permanent accounts can vote and contribute', () => {
  const account = { id: 'permanent-user', is_anonymous: false };
  assert.equal(canVoteInComparisons(account), true);
  assert.equal(isPermanentAccount(account), true);
});

