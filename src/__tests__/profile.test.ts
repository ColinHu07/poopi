import assert from 'node:assert/strict';
import test from 'node:test';

import { isProfileComplete, normalizePhoneE164, normalizeUsername, validateSignupInput } from '@/src/lib/profile';

test('normalizePhoneE164 handles common US and international input', () => {
  assert.equal(normalizePhoneE164('(212) 555-0199'), '+12125550199');
  assert.equal(normalizePhoneE164('1-212-555-0199'), '+12125550199');
  assert.equal(normalizePhoneE164('+44 20 7946 0958'), '+442079460958');
  assert.equal(normalizePhoneE164('123'), null);
  assert.equal(normalizePhoneE164(''), null);
});

test('validateSignupInput enforces account fields without requiring phone', () => {
  const valid = validateSignupInput({
    email: 'colin@example.com',
    password: 'password123',
    displayName: 'Colin',
    username: '@colin_hu',
  });
  assert.equal(valid.valid, true);

  const invalid = validateSignupInput({
    email: 'not-email',
    password: 'short',
    displayName: 'C',
    username: 'bad user',
    phone: '123',
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.email, 'Enter a valid email.');
  assert.equal(invalid.errors.phone, 'Use a valid phone number.');
});

test('profile completion only requires display name and username', () => {
  assert.equal(normalizeUsername('@Poopi_User'), 'poopi_user');
  assert.equal(isProfileComplete(null), false);
  assert.equal(isProfileComplete({ displayName: 'Colin', username: 'colin' }), true);
  assert.equal(isProfileComplete({ displayName: 'Colin', username: '' }), false);
});
