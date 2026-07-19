-- DATA-02: privacy-safe, recency-weighted summaries shared by nearby and
-- detail queries. Unknown status/freshness remains explicitly unknown.

create or replace function public.bathroom_summary(p_bathroom_id uuid)
returns table (
  cleanliness_score numeric,
  odor_score numeric,
  privacy_score numeric,
  median_wait text,
  review_count bigint,
  community_score numeric,
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
  with bathroom_base as (
    select id, confidence, last_confirmed_at
    from public.bathrooms
    where id = p_bathroom_id
  ),
  public_visits as (
    select
      v.*,
      power(
        0.5,
        greatest(extract(epoch from (now() - v.observed_at)) / 86400.0, 0) / 45.0
      ) as recency_weight
    from public.visits v
    where v.bathroom_id = p_bathroom_id
      and v.visibility = 'public'
  ),
  review_stats as (
    select
      count(*)::bigint as review_count,
      round((sum(cleanliness_rating * recency_weight) filter (where cleanliness_rating is not null)
        / nullif(sum(recency_weight) filter (where cleanliness_rating is not null), 0))::numeric, 1) as cleanliness_score,
      round((sum(odor_rating * recency_weight) filter (where odor_rating is not null)
        / nullif(sum(recency_weight) filter (where odor_rating is not null), 0))::numeric, 1) as odor_score,
      round((sum(privacy_rating * recency_weight) filter (where privacy_rating is not null)
        / nullif(sum(recency_weight) filter (where privacy_rating is not null), 0))::numeric, 1) as privacy_score,
      round(((
        coalesce(sum((case sentiment when 'liked' then 9 when 'fine' then 6 else 3 end) * recency_weight), 0) + 30
      ) / (coalesce(sum(recency_weight), 0) + 5))::numeric, 1) as community_score,
      max(observed_at) as last_observation_at
    from public_visits
  ),
  wait_stats as (
    select percentile_disc(0.5) within group (
      order by case wait_bucket
        when 'none' then 0
        when 'under_five' then 1
        when 'five_to_ten' then 2
        when 'ten_to_twenty' then 3
        when 'over_twenty' then 4
      end
    ) as median_wait_order
    from public_visits
    where wait_bucket is not null
      and observed_at >= now() - interval '90 days'
  ),
  latest_status as (
    select observed_status, observed_at
    from public_visits
    where observed_status <> 'unknown'
    order by observed_at desc
    limit 1
  ),
  source_stats as (
    select
      avg(bs.confidence)::double precision as source_confidence,
      coalesce(sum(bs.confirmed_by_users), 0)::double precision as confirmations,
      coalesce(sum(bs.contradicted_by_users), 0)::double precision as contradictions
    from public.bathroom_sources bs
    where bs.bathroom_id = p_bathroom_id
  ),
  combined as (
    select
      b.*,
      r.*,
      w.median_wait_order,
      ls.observed_status as latest_status,
      ls.observed_at as latest_status_at,
      coalesce(ss.source_confidence, b.confidence::double precision) as source_confidence,
      ss.confirmations,
      ss.contradictions,
      coalesce(
        greatest(r.last_observation_at, b.last_confirmed_at),
        r.last_observation_at,
        b.last_confirmed_at
      ) as effective_last_confirmed_at
    from bathroom_base b
    cross join review_stats r
    cross join wait_stats w
    cross join source_stats ss
    left join latest_status ls on true
  ),
  signals as (
    select
      c.*,
      case
        when effective_last_confirmed_at is null then 'unknown'
        when effective_last_confirmed_at >= now() - interval '24 hours' then 'fresh'
        when effective_last_confirmed_at >= now() - interval '7 days' then 'aging'
        else 'stale'
      end as freshness_value,
      (source_confidence * 0.8)
        + (((confirmations + 1) / (confirmations + contradictions + 2)) * 0.2) as source_signal,
      least(1.0, ln(1 + review_count::double precision) / ln(11.0)) as review_signal
    from combined c
  )
  select
    s.cleanliness_score,
    s.odor_score,
    s.privacy_score,
    case s.median_wait_order
      when 0 then 'none'
      when 1 then 'under_five'
      when 2 then 'five_to_ten'
      when 3 then 'ten_to_twenty'
      when 4 then 'over_twenty'
      else null
    end as median_wait,
    s.review_count,
    case when s.review_count = 0 then null else s.community_score end,
    round(least(1.0, greatest(0.0,
      s.source_signal * 0.55
      + s.review_signal * 0.25
      + (case s.freshness_value when 'fresh' then 1.0 when 'aging' then 0.7 when 'stale' then 0.25 else 0.0 end) * 0.2
    ))::numeric, 2) as summary_confidence,
    s.effective_last_confirmed_at,
    case
      when s.latest_status_at >= now() - interval '24 hours' then s.latest_status
      else 'unknown'
    end as operating_status,
    s.freshness_value as freshness
  from signals s;
$$;

revoke all on function public.bathroom_summary(uuid) from public;
grant execute on function public.bathroom_summary(uuid) to anon, authenticated;

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
  distance_meters double precision,
  access access_type,
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
  group by b.id, target.location, s.cleanliness_score, s.odor_score, s.privacy_score,
    s.median_wait, s.review_count, s.community_score, s.summary_confidence,
    s.summary_last_confirmed_at, s.operating_status, s.freshness
  order by b.location <-> target.location
  limit least(greatest(result_limit, 1), 100);
$$;

revoke all on function public.nearby_bathrooms(double precision, double precision, integer) from public;
grant execute on function public.nearby_bathrooms(double precision, double precision, integer) to anon, authenticated;
