-- Run with `supabase test db` after all migrations. This verifies canonical
-- cross-source resolution, permanent-user creation, and real radius behavior.
begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '40000000-0000-4000-8000-000000000004',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pipeline@poopi.test', '', now(), '{}', '{}', now(), now()
);

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select * from public.upsert_canonical_bathroom(
  p_source_name => 'osm'::source_name,
  p_source_id => 'node/poopi-pipeline-test',
  p_fetched_at => now(),
  p_license => 'ODbL',
  p_name => 'Wenwen Restroom',
  p_kind => 'Mapped public toilet',
  p_address => '1025 Manhattan Ave, Brooklyn, NY',
  p_neighborhood => 'Greenpoint',
  p_city => 'Brooklyn',
  p_latitude => 40.7338,
  p_longitude => -73.9542,
  p_access => 'customers_only'::access_type,
  p_fee_required => false,
  p_price_note => 'Free',
  p_opening_hours => 'Unknown',
  p_confidence => 0.62,
  p_directions_note => '',
  p_last_confirmed_at => null,
  p_confirmed_by_users => 0,
  p_contradicted_by_users => 0,
  p_features => array['all_gender']
);

select * from public.upsert_canonical_bathroom(
  p_source_name => 'refuge'::source_name,
  p_source_id => 'poopi-pipeline-test',
  p_fetched_at => now(),
  p_license => 'Refuge Restrooms API',
  p_name => 'Wenwen Bathroom',
  p_kind => 'Community restroom',
  p_address => '1025 Manhattan Ave, Brooklyn, NY',
  p_neighborhood => 'Greenpoint',
  p_city => 'Brooklyn',
  p_latitude => 40.73381,
  p_longitude => -73.95421,
  p_access => 'unknown'::access_type,
  p_fee_required => null,
  p_price_note => 'Unknown',
  p_opening_hours => 'Unknown',
  p_confidence => 0.68,
  p_directions_note => '',
  p_last_confirmed_at => null,
  p_confirmed_by_users => 1,
  p_contradicted_by_users => 0,
  p_features => array['single_stall']
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":false}',
  true
);

select * from public.upsert_canonical_bathroom(
  p_source_name => 'user'::source_name,
  p_source_id => 'manual-wenwen-test',
  p_fetched_at => now(),
  p_license => 'User submitted',
  p_name => 'Wenwen',
  p_kind => 'User submitted restroom',
  p_address => '1025 Manhattan Ave, Brooklyn, NY',
  p_neighborhood => '',
  p_city => 'Brooklyn',
  p_latitude => 40.73382,
  p_longitude => -73.9542,
  p_access => 'unknown'::access_type,
  p_fee_required => null,
  p_price_note => 'Unverified',
  p_opening_hours => 'Unknown',
  p_confidence => 0.35,
  p_directions_note => '',
  p_last_confirmed_at => null,
  p_confirmed_by_users => 0,
  p_contradicted_by_users => 0,
  p_features => array[]::text[]
);

do $$
begin
  if (
    select count(distinct bathroom_id)
    from public.bathroom_sources
    where (source_name, source_id) in (
      ('osm'::source_name, 'node/poopi-pipeline-test'),
      ('refuge'::source_name, 'poopi-pipeline-test'),
      ('user'::source_name, '40000000-0000-4000-8000-000000000004:manual-wenwen-test')
    )
  ) <> 1 then
    raise exception 'OSM, Refuge, and user records did not resolve to one canonical UUID';
  end if;

  if (
    select count(*)
    from public.nearby_bathrooms(40.7338, -73.9542, 50, 250)
    where name = 'Wenwen Restroom'
  ) <> 1 then
    raise exception 'canonical bathroom was not returned inside the radius';
  end if;

  if (
    select count(*)
    from public.nearby_bathrooms(40.75, -73.98, 50, 250)
    where name = 'Wenwen Restroom'
  ) <> 0 then
    raise exception 'nearby_bathrooms returned a result outside the radius';
  end if;
end;
$$;

rollback;
