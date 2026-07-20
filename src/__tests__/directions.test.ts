import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWalkingDirectionsUrl, formatDistance, formatWalkingEta } from '@/src/lib/directions';

test('walking route labels preserve trustworthy unknown states', () => {
  assert.equal(formatDistance(undefined), 'Distance unknown');
  assert.equal(formatWalkingEta(undefined), 'ETA unknown');
  assert.equal(formatDistance(420), '420 m away');
  assert.equal(formatWalkingEta(800), '10 min walk');
});

test('directions target exact bathroom coordinates with walking mode', () => {
  const destination = { latitude: 40.7211, longitude: -73.9541, name: 'Wenwen' };
  const apple = buildWalkingDirectionsUrl(destination, 'ios');
  const google = buildWalkingDirectionsUrl(destination, 'web');

  assert.match(apple, /^https:\/\/maps\.apple\.com\//);
  assert.match(apple, /daddr=40.7211%2C-73.9541/);
  assert.match(apple, /dirflg=w/);
  assert.match(google, /destination=40.7211%2C-73.9541/);
  assert.match(google, /travelmode=walking/);
});
