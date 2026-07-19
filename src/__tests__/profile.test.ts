import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isProfileComplete,
  isValidDateOfBirth,
  normalizeDisplayName,
  normalizePhoneE164,
  validateSignupInput,
} from '@/src/lib/profile';

test('normalizePhoneE164 handles common US and international input', () => {
  assert.equal(normalizePhoneE164('(212) 555-0199'), '+12125550199');
  assert.equal(normalizePhoneE164('1-212-555-0199'), '+12125550199');
  assert.equal(normalizePhoneE164('+44 20 7946 0958'), '+442079460958');
  assert.equal(normalizePhoneE164('123'), null);
  assert.equal(normalizePhoneE164(''), null);
});

test('validateSignupInput enforces private basics and a public display name', () => {
  const valid = validateSignupInput({
    email: 'colin@example.com',
    password: 'password123',
    firstName: 'Colin',
    lastName: 'Hu',
    dateOfBirth: '2007-07-18',
    displayName: '@colin_hu',
  });
  assert.equal(valid.valid, true);

  const invalid = validateSignupInput({
    email: 'not-email',
    password: 'short',
    firstName: '',
    lastName: '',
    dateOfBirth: 'not-a-date',
    displayName: 'bad user',
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.email, 'Enter a valid email.');
  assert.equal(invalid.errors.dateOfBirth, 'Enter a valid date of birth as YYYY-MM-DD.');
});

test('profile completion requires private basics and the unique display name', () => {
  assert.equal(normalizeDisplayName('@Poopi_User'), 'poopi_user');
  assert.equal(isValidDateOfBirth('2007-07-18'), true);
  assert.equal(isValidDateOfBirth('2026-02-30'), false);
  assert.equal(isProfileComplete(null), false);
  assert.equal(
    isProfileComplete({
      firstName: 'Colin',
      lastName: 'Hu',
      dateOfBirth: '2007-07-18',
      displayName: 'colin',
      username: 'colin',
    }),
    true,
  );
  assert.equal(isProfileComplete({ displayName: 'colin', username: 'colin' }), false);
});
