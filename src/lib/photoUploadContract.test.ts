import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  'supabase/migrations/20260721000000_private_photo_uploads.sql',
  'utf8',
);

test('bathroom photos use a private, JPEG-only, size-limited bucket', () => {
  assert.match(migration, /'bathroom-photos'/);
  assert.match(migration, /false,\s*6291456,\s*array\['image\/jpeg'\]/s);
});

test('photo object writes are permanent-user and owner scoped', () => {
  const insertPolicy = migration.slice(
    migration.indexOf('create policy bathroom_photos_insert_own'),
    migration.indexOf('drop policy if exists bathroom_photos_select_allowed'),
  );
  assert.match(insertPolicy, /is_permanent_user\(\)/);
  assert.match(insertPolicy, /storage\.foldername\(name\)/);
  assert.match(insertPolicy, /auth\.uid\(\)::text/);
  assert.match(insertPolicy, /storage\.extension\(name\)/);
});

test('only owners or approved photo objects can be read', () => {
  const selectPolicy = migration.slice(
    migration.indexOf('create policy bathroom_photos_select_allowed'),
    migration.indexOf('drop policy if exists bathroom_photos_delete_own'),
  );
  assert.match(selectPolicy, /owner_id = auth\.uid\(\)::text/);
  assert.match(selectPolicy, /p\.moderation_status = 'approved'/);
});
