import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  'supabase/migrations/20260719040000_public_reads_and_identity_bound_writes.sql',
  'utf8',
);

test('account contribution policies require a permanent identity', () => {
  for (const policy of [
    'profiles_insert_self',
    'bathrooms_insert_permanent_account',
    'visits_insert_own',
    'visit_tags_insert_own',
    'photos_insert_own',
    'lists_insert_own',
    'follows_insert_own',
    'feed_insert_own',
    'reports_insert_own',
  ]) {
    const start = migration.indexOf(`create policy ${policy}`);
    assert.notEqual(start, -1, `${policy} should exist`);
    assert.match(migration.slice(start, start + 350), /is_permanent_user\(\)/);
  }
});

test('anonymous comparison votes stay identity-bound and rate-limited', () => {
  const start = migration.indexOf('create or replace function public.submit_comparison_vote');
  const voteFunction = migration.slice(start, migration.indexOf('create or replace function public.public_bathroom_reviews'));
  assert.match(voteFunction, /auth\.uid\(\)/);
  assert.match(voteFunction, />= 60/);
  assert.match(voteFunction, /interval '1 hour'/);
  assert.doesNotMatch(voteFunction, /is_permanent_user/);
  assert.match(voteFunction, /grant execute[^;]+to authenticated/s);
});

test('public reviews expose safe fields without private notes or profile identity', () => {
  const start = migration.indexOf('create or replace function public.public_bathroom_reviews');
  const reviewFunction = migration.slice(start);
  assert.match(reviewFunction, /v\.visibility = 'public'/);
  assert.doesNotMatch(reviewFunction, /private_note/);
  assert.doesNotMatch(reviewFunction, /user_id/);
  assert.match(reviewFunction, /grant execute[^;]+to anon, authenticated/s);
});
