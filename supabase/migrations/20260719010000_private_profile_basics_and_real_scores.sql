-- Keep legal/profile basics private while making the chosen display name the
-- single unique public identifier used by the client.
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists date_of_birth date;

update public.profiles
set display_name = username
where display_name is distinct from username;

create unique index if not exists profiles_display_name_unique_lower
  on public.profiles (lower(display_name));

alter table public.profiles
  add constraint profiles_first_name_length check (first_name is null or char_length(trim(first_name)) between 1 and 50),
  add constraint profiles_last_name_length check (last_name is null or char_length(trim(last_name)) between 1 and 50),
  add constraint profiles_date_of_birth_range check (date_of_birth is null or date_of_birth >= date '1900-01-01'),
  add constraint profiles_display_name_format check (display_name ~ '^[a-z0-9_]{3,24}$');

-- Replace the placeholder 6.0 with a score only when at least one real visit
-- exists. The score is a Bayesian average with a neutral 6.0 prior.
drop function if exists public.nearby_bathrooms(double precision, double precision, integer);

create function public.nearby_bathrooms(
  center_latitude double precision,
  center_longitude double precision,
  result_limit integer default 50
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
  access access_type,
  price_note text,
  opening_hours text,
  confidence numeric,
  directions_note text,
  last_confirmed_at timestamptz,
  features text[],
  source_refs jsonb,
  community_score numeric,
  community_review_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.name,
    b.kind,
    b.address,
    b.neighborhood,
    b.city,
    st_y(b.location::geometry) as latitude,
    st_x(b.location::geometry) as longitude,
    b.access,
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
    case
      when review_stats.review_count = 0 then null
      else round((review_stats.rating_total + 30) / (review_stats.review_count + 5), 1)
    end as community_score,
    review_stats.review_count as community_review_count
  from public.bathrooms b
  left join public.bathroom_features bf on bf.bathroom_id = b.id
  left join public.bathroom_sources bs on bs.bathroom_id = b.id
  left join lateral (
    select
      count(*)::bigint as review_count,
      coalesce(sum(case v.sentiment when 'liked' then 9 when 'fine' then 6 else 3 end), 0)::numeric as rating_total
    from public.visits v
    where v.bathroom_id = b.id
  ) review_stats on true
  group by b.id, review_stats.review_count, review_stats.rating_total
  order by b.location <-> st_setsrid(st_makepoint(center_longitude, center_latitude), 4326)::geography
  limit least(greatest(result_limit, 1), 100);
$$;

grant execute on function public.nearby_bathrooms(double precision, double precision, integer) to anon, authenticated;
