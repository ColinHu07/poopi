import assert from 'node:assert/strict';
import test from 'node:test';

import { clusterBathrooms, viewportMoved, viewportRadiusMeters, type MapViewport } from '@/src/lib/mapDiscovery';
import { seedBathrooms } from '@/src/data/fixtures';

test('nearby markers cluster at a city zoom and separate when zoomed in', () => {
  const close = [
    { ...seedBathrooms[0], id: 'a', latitude: 40.7201, longitude: -73.9501 },
    { ...seedBathrooms[1], id: 'b', latitude: 40.7202, longitude: -73.9502 },
  ];

  assert.equal(clusterBathrooms(close, 13).length, 1);
  assert.equal(clusterBathrooms(close, 20).length, 2);
});

test('viewport radius remains useful and safely bounded', () => {
  const tiny: MapViewport = { latitude: 40.7, longitude: -73.9, latitudeDelta: 0.001, longitudeDelta: 0.001, zoom: 18 };
  const huge: MapViewport = { latitude: 40.7, longitude: -73.9, latitudeDelta: 4, longitudeDelta: 4, zoom: 5 };

  assert.equal(viewportRadiusMeters(tiny), 1_000);
  assert.equal(viewportRadiusMeters(huge), 25_000);
});

test('viewport movement ignores tiny camera jitter', () => {
  const viewport: MapViewport = { latitude: 40.71, longitude: -73.95, latitudeDelta: 0.02, longitudeDelta: 0.02, zoom: 14 };
  assert.equal(viewportMoved({ latitude: 40.7101, longitude: -73.9501 }, viewport), false);
  assert.equal(viewportMoved({ latitude: 40.73, longitude: -73.95 }, viewport), true);
});
