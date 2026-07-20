import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPlaceSearchUrl, mapNominatimResult } from '@/src/services/placeSearch';

test('place search URL uses a nearby viewbox without excluding exact results', () => {
  const url = new URL(buildPlaceSearchUrl('Wenwen', { latitude: 40.7339, longitude: -73.955 }));

  assert.equal(url.searchParams.get('q'), 'Wenwen');
  assert.equal(url.searchParams.get('format'), 'jsonv2');
  assert.equal(url.searchParams.get('bounded'), '0');
  assert.match(url.searchParams.get('viewbox') ?? '', /^-/);
});

test('Nominatim results become editable place candidates', () => {
  const place = mapNominatimResult({
    place_id: 123,
    osm_type: 'node',
    osm_id: 456,
    lat: '40.7339765',
    lon: '-73.9550761',
    display_name: 'Wenwen, Manhattan Avenue, Greenpoint, Brooklyn, New York, 11222, United States',
    category: 'amenity',
    type: 'restaurant',
    namedetails: { name: 'Wenwen' },
  });

  assert.deepEqual(place, {
    id: 'osm-node-456',
    name: 'Wenwen',
    address: 'Manhattan Avenue, Greenpoint, Brooklyn, New York, 11222, United States',
    latitude: 40.7339765,
    longitude: -73.9550761,
    category: 'amenity',
    type: 'restaurant',
  });
});

test('invalid place coordinates are discarded', () => {
  assert.equal(
    mapNominatimResult({
      place_id: 1,
      lat: 'unknown',
      lon: '-73',
      display_name: 'Bad result',
    }),
    undefined,
  );
});
