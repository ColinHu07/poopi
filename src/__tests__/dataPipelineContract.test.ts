import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  'supabase/migrations/20260720000000_canonical_import_osm_and_radius.sql',
  'utf8',
);
const bathroomApi = readFileSync('src/services/bathroomApi.ts', 'utf8');
const refugeImporter = readFileSync('supabase/functions/import-refuge-nearby/index.ts', 'utf8');
const osmImporter = readFileSync('supabase/functions/import-osm-nearby/index.ts', 'utf8');
const externalNormalizers = readFileSync('src/services/externalBathroomCandidates.ts', 'utf8');

test('canonical import resolves exact sources before conservative spatial dedupe', () => {
  assert.match(migration, /where bs\.source_name = p_source_name/);
  assert.match(migration, /st_dwithin\(b\.location, candidate_location, 80\)/);
  assert.match(migration, /normalize_place_text\(b\.name\) = normalized_name/);
  assert.match(migration, /normalize_place_text\(b\.address\) = normalized_address/);
  assert.match(migration, /return query select target_id, created_row, deduplicated_row/);
});

test('Refuge and OSM use the same canonical UUID pipeline', () => {
  for (const importer of [refugeImporter, osmImporter]) {
    assert.match(importer, /upsertCanonicalBathroom/);
    assert.match(importer, /bathroomIds/);
  }
  assert.match(osmImporter, /normalizeOsmCandidate/);
  assert.match(refugeImporter, /normalizeRefugeCandidate/);
  assert.match(externalNormalizers, /sourceId: `\$\{element\.type\}\/\$\{element\.id\}`/);
});

test('the app never displays direct non-UUID external fallback records', () => {
  assert.doesNotMatch(bathroomApi, /refugerestrooms\.org/);
  assert.doesNotMatch(bathroomApi, /normalizeRefugeRestroom/);
  assert.match(bathroomApi, /invokeNearbyImports/);
  assert.match(bathroomApi, /getNearbyFromSupabase/);
});

test('nearby discovery enforces a bounded geographic radius', () => {
  assert.match(migration, /radius_meters double precision default 5000/);
  assert.match(migration, /where st_dwithin\(/);
  assert.match(migration, /least\(greatest\(coalesce\(radius_meters, 5000\), 100\), 50000\)/);
  assert.match(bathroomApi, /radius_meters: input\.radiusMeters \?\? 5_000/);
});
