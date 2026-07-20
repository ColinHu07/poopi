-- DATA-04 through DATA-06: canonical UUID resolution for every source,
-- shared cross-source deduplication, explicit cost facts, and radius-bounded
-- discovery. Source fetch timestamps are not bathroom confirmations.

alter table public.bathrooms
  add column if not exists fee_required boolean;

update public.bathrooms
set fee_required = case
  when lower(trim(price_note)) = 'free' then false
  when access = 'paid' or lower(trim(price_note)) in ('fee reported', 'paid') then true
  else null
end
where fee_required is null;

create or replace function public.normalize_place_text(value text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select trim(regexp_replace(
    regexp_replace(
      replace(lower(value), '&', ' and '),
      '\m(restroom|bathroom|toilet|public|the)\M',
      '',
      'g'
    ),
    '[^a-z0-9]+',
    ' ',
    'g'
  ));
$$;

revoke all on function public.normalize_place_text(text) from public;
grant execute on function public.normalize_place_text(text) to anon, authenticated, service_role;

create or replace function public.upsert_canonical_bathroom(
  p_source_name source_name,
  p_source_id text,
  p_fetched_at timestamptz,
  p_license text,
  p_name text,
  p_kind text,
  p_address text,
  p_neighborhood text,
  p_city text,
  p_latitude double precision,
  p_longitude double precision,
  p_access access_type,
  p_fee_required boolean,
  p_price_note text,
  p_opening_hours text,
  p_confidence numeric,
  p_directions_note text,
  p_last_confirmed_at timestamptz,
  p_confirmed_by_users integer,
  p_contradicted_by_users integer,
  p_features text[]
)
returns table (
  bathroom_id uuid,
  created boolean,
  deduplicated boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_location geography(point, 4326);
  effective_source_id text;
  target_id uuid;
  exact_source_bathroom_id uuid;
  source_row_id uuid;
  created_row boolean := false;
  deduplicated_row boolean := false;
  normalized_name text;
  normalized_address text;
begin
  if p_source_id is null or trim(p_source_id) = '' then
    raise exception 'A source ID is required';
  end if;
  if p_name is null or trim(p_name) = '' then
    raise exception 'A bathroom name is required';
  end if;
  if p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90
    or p_longitude not between -180 and 180 then
    raise exception 'Invalid bathroom coordinates';
  end if;

  if p_source_name = 'user' then
    if not public.is_permanent_user() then
      raise exception 'A permanent account is required to add a bathroom';
    end if;
    effective_source_id := auth.uid()::text || ':' || p_source_id;
  else
    if auth.role() <> 'service_role' then
      raise exception 'External bathroom sources can only be imported by the service role';
    end if;
    effective_source_id := p_source_id;
  end if;

  candidate_location := st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography;
  normalized_name := public.normalize_place_text(p_name);
  normalized_address := public.normalize_place_text(coalesce(p_address, ''));

  -- Serialize candidates with the same normalized identity. The spatial query
  -- below is still authoritative; this only prevents concurrent duplicates.
  perform pg_advisory_xact_lock(hashtextextended(
    coalesce(nullif(normalized_address, ''), normalized_name) || ':' ||
    round(p_latitude::numeric, 3)::text || ':' || round(p_longitude::numeric, 3)::text,
    0
  ));

  select bs.bathroom_id
  into exact_source_bathroom_id
  from public.bathroom_sources bs
  where bs.source_name = p_source_name
    and bs.source_id = effective_source_id;

  target_id := exact_source_bathroom_id;

  if target_id is null then
    select b.id
    into target_id
    from public.bathrooms b
    where st_dwithin(b.location, candidate_location, 80)
      and (
        (normalized_name <> '' and public.normalize_place_text(b.name) = normalized_name)
        or
        (normalized_address <> '' and public.normalize_place_text(b.address) = normalized_address)
      )
    order by
      case when public.normalize_place_text(b.name) = normalized_name then 0 else 1 end,
      st_distance(b.location, candidate_location),
      b.created_at
    limit 1;

    deduplicated_row := target_id is not null;
  end if;

  if target_id is null then
    insert into public.bathrooms (
      name, kind, address, neighborhood, city, location, access,
      fee_required, price_note, opening_hours, confidence, directions_note,
      last_confirmed_at
    ) values (
      trim(p_name), coalesce(nullif(trim(p_kind), ''), 'Bathroom'),
      coalesce(p_address, ''), coalesce(p_neighborhood, ''), coalesce(p_city, ''),
      candidate_location, coalesce(p_access, 'unknown'), p_fee_required,
      coalesce(nullif(trim(p_price_note), ''), 'Unknown'),
      coalesce(nullif(trim(p_opening_hours), ''), 'Unknown'),
      least(greatest(coalesce(p_confidence, 0.35), 0), 1),
      coalesce(p_directions_note, ''), p_last_confirmed_at
    )
    returning id into target_id;
    created_row := true;
  elsif exact_source_bathroom_id is not null then
    -- Refresh fields only for the same authoritative source. Cross-source
    -- matches retain the existing canonical identity and curated description.
    update public.bathrooms
    set
      name = coalesce(nullif(trim(p_name), ''), name),
      kind = coalesce(nullif(trim(p_kind), ''), kind),
      address = coalesce(nullif(trim(p_address), ''), address),
      neighborhood = coalesce(nullif(trim(p_neighborhood), ''), neighborhood),
      city = coalesce(nullif(trim(p_city), ''), city),
      location = candidate_location,
      access = case when p_access = 'unknown' then access else p_access end,
      fee_required = coalesce(p_fee_required, fee_required),
      price_note = case when coalesce(trim(p_price_note), '') in ('', 'Unknown') then price_note else p_price_note end,
      opening_hours = case when coalesce(trim(p_opening_hours), '') in ('', 'Unknown') then opening_hours else p_opening_hours end,
      confidence = greatest(confidence, least(greatest(coalesce(p_confidence, 0.35), 0), 1)),
      directions_note = case when coalesce(trim(p_directions_note), '') = '' then directions_note else p_directions_note end,
      last_confirmed_at = greatest(last_confirmed_at, p_last_confirmed_at)
    where id = target_id;
  else
    -- A second source may add only facts that are currently unknown.
    update public.bathrooms
    set
      access = case when access = 'unknown' and p_access <> 'unknown' then p_access else access end,
      fee_required = coalesce(fee_required, p_fee_required),
      opening_hours = case when opening_hours = 'Unknown' and coalesce(trim(p_opening_hours), '') <> '' then p_opening_hours else opening_hours end,
      confidence = greatest(confidence, least(greatest(coalesce(p_confidence, 0.35), 0), 1)),
      last_confirmed_at = greatest(last_confirmed_at, p_last_confirmed_at)
    where id = target_id;
  end if;

  insert into public.bathroom_sources (
    bathroom_id, source_name, source_id, fetched_at, license, confidence,
    confirmed_by_users, contradicted_by_users
  ) values (
    target_id, p_source_name, effective_source_id, coalesce(p_fetched_at, now()),
    coalesce(p_license, ''), least(greatest(coalesce(p_confidence, 0.35), 0), 1),
    greatest(coalesce(p_confirmed_by_users, 0), 0),
    greatest(coalesce(p_contradicted_by_users, 0), 0)
  )
  on conflict (source_name, source_id) do update set
    bathroom_id = excluded.bathroom_id,
    fetched_at = excluded.fetched_at,
    license = excluded.license,
    confidence = excluded.confidence,
    confirmed_by_users = excluded.confirmed_by_users,
    contradicted_by_users = excluded.contradicted_by_users
  returning id into source_row_id;

  insert into public.bathroom_features (bathroom_id, feature, confidence, source_id)
  select
    target_id,
    feature,
    least(greatest(coalesce(p_confidence, 0.35), 0), 1),
    source_row_id
  from unnest(coalesce(p_features, array[]::text[])) feature
  where trim(feature) <> ''
  on conflict (bathroom_id, feature) do update set
    confidence = greatest(public.bathroom_features.confidence, excluded.confidence),
    source_id = coalesce(public.bathroom_features.source_id, excluded.source_id);

  return query select target_id, created_row, deduplicated_row;
end;
$$;

revoke all on function public.upsert_canonical_bathroom(
  source_name, text, timestamptz, text, text, text, text, text, text,
  double precision, double precision, access_type, boolean, text, text,
  numeric, text, timestamptz, integer, integer, text[]
) from public;
grant execute on function public.upsert_canonical_bathroom(
  source_name, text, timestamptz, text, text, text, text, text, text,
  double precision, double precision, access_type, boolean, text, text,
  numeric, text, timestamptz, integer, integer, text[]
) to authenticated, service_role;

drop function if exists public.nearby_bathrooms(double precision, double precision, integer);

create function public.nearby_bathrooms(
  center_latitude double precision,
  center_longitude double precision,
  result_limit integer default 50,
  radius_meters double precision default 5000
)
returns table (
  id uuid,
  name text,
  kind text,
  address text,
  neighborhood text,
  city text,
  latitude double precision,
  longitude double precision,
  distance_meters double precision,
  access access_type,
  fee_required boolean,
  price_note text,
  opening_hours text,
  confidence numeric,
  directions_note text,
  last_confirmed_at timestamptz,
  features text[],
  source_refs jsonb,
  community_score numeric,
  community_review_count bigint,
  cleanliness_score numeric,
  odor_score numeric,
  privacy_score numeric,
  median_wait text,
  summary_confidence numeric,
  summary_last_confirmed_at timestamptz,
  operating_status text,
  freshness text
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select st_setsrid(st_makepoint(center_longitude, center_latitude), 4326)::geography as location
  )
  select
    b.id,
    b.name,
    b.kind,
    b.address,
    b.neighborhood,
    b.city,
    st_y(b.location::geometry) as latitude,
    st_x(b.location::geometry) as longitude,
    st_distance(b.location, target.location) as distance_meters,
    b.access,
    b.fee_required,
    b.price_note,
    b.opening_hours,
    b.confidence,
    b.directions_note,
    b.last_confirmed_at,
    coalesce(array_agg(distinct bf.feature) filter (where bf.feature is not null), array[]::text[]) as features,
    coalesce(
      jsonb_agg(
        distinct jsonb_build_object(
          'sourceName', bs.source_name,
          'sourceId', bs.source_id,
          'fetchedAt', bs.fetched_at,
          'license', bs.license,
          'confidence', bs.confidence,
          'confirmedByUsers', bs.confirmed_by_users,
          'contradictedByUsers', bs.contradicted_by_users
        )
      ) filter (where bs.id is not null),
      '[]'::jsonb
    ) as source_refs,
    s.community_score,
    s.review_count as community_review_count,
    s.cleanliness_score,
    s.odor_score,
    s.privacy_score,
    s.median_wait,
    s.summary_confidence,
    s.summary_last_confirmed_at,
    s.operating_status,
    s.freshness
  from public.bathrooms b
  cross join target
  left join public.bathroom_features bf on bf.bathroom_id = b.id
  left join public.bathroom_sources bs on bs.bathroom_id = b.id
  left join lateral public.bathroom_summary(b.id) s on true
  where st_dwithin(
    b.location,
    target.location,
    least(greatest(coalesce(radius_meters, 5000), 100), 50000)
  )
  group by b.id, target.location, s.cleanliness_score, s.odor_score, s.privacy_score,
    s.median_wait, s.review_count, s.community_score, s.summary_confidence,
    s.summary_last_confirmed_at, s.operating_status, s.freshness
  order by b.location <-> target.location
  limit least(greatest(result_limit, 1), 100);
$$;

revoke all on function public.nearby_bathrooms(double precision, double precision, integer, double precision) from public;
grant execute on function public.nearby_bathrooms(double precision, double precision, integer, double precision) to anon, authenticated;
