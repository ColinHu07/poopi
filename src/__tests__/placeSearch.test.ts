import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPlaceSearchUrl,
  buildSmartPlaceQuery,
  mapNominatimResult,
  normalizePlaceQuery,
  rankPlaceSearchResults,
} from '@/src/services/placeSearch';

test('place search URL uses a nearby viewbox without excluding exact destinations', () => {
  const url = new URL(buildPlaceSearchUrl('Wenwen', { latitude: 40.7339, longitude: -73.955 }));

  assert.equal(url.searchParams.get('q'), 'Wenwen');
  assert.equal(url.searchParams.get('format'), 'jsonv2');
  assert.equal(url.searchParams.get('bounded'), '0');
  assert.match(url.searchParams.get('viewbox') ?? '', /^-/);
});

test('smart place query tolerates omitted apostrophes and an incomplete chain name', () => {
  assert.equal(normalizePlaceQuery("McDonald’s"), 'mcdonalds');
  assert.equal(buildSmartPlaceQuery('mcdonal'), "McDonald's fast food");
  assert.equal(buildSmartPlaceQuery('mcdonalds'), "McDonald's fast food");
  assert.equal(buildSmartPlaceQuery('Wenwen'), 'Wenwen');
});

test('place results favor nearby venues over roads and distant matches', () => {
  const ranked = rankPlaceSearchResults(
    'mcdonalds',
    [
      {
        id: 'road',
        name: 'McDonald Avenue',
        address: 'Brooklyn, NY',
        latitude: 40.65,
        longitude: -73.98,
        category: 'highway',
        type: 'primary',
      },
      {
        id: 'far',
        name: "McDonald's",
        address: 'Los Angeles, CA',
        latitude: 34.05,
        longitude: -118.24,
        category: 'amenity',
        type: 'fast_food',
      },
      {
        id: 'near',
        name: "McDonald's",
        address: '8th Avenue, New York, NY',
        latitude: 40.75,
        longitude: -73.99,
        category: 'amenity',
        type: 'fast_food',
      },
    ],
    { latitude: 40.7536, longitude: -73.9832 },
  );

  assert.equal(ranked[0].id, 'near');
  assert.ok(ranked.some(({ id }) => id === 'road'));
  assert.ok(!ranked.some(({ id }) => id === 'far'));
});

test('a lone distant venue is rejected while an exact destination city remains searchable', () => {
  const center = { latitude: 40.7536, longitude: -73.9832 };
  const farRestaurant = {
    id: 'restaurant',
    name: 'Example Cafe',
    address: 'Los Angeles, CA',
    latitude: 34.05,
    longitude: -118.24,
    category: 'amenity',
    type: 'restaurant',
  };
  assert.deepEqual(rankPlaceSearchResults('Example Cafe', [farRestaurant], center), []);

  const boston = {
    id: 'boston',
    name: 'Boston',
    address: 'Massachusetts, United States',
    latitude: 42.36,
    longitude: -71.06,
    category: 'boundary',
    type: 'city',
  };
  assert.equal(rankPlaceSearchResults('Boston', [boston], center)[0].id, 'boston');
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
