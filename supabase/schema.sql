create extension if not exists postgis;
create extension if not exists pgcrypto;

create type access_type as enum (
  'public',
  'customers_only',
  'purchase_required',
  'paid',
  'code_required',
  'staff_permission',
  'members_only',
  'unknown'
);

create type source_name as enum ('osm', 'refuge', 'nyc_open_data', 'datasf', 'user', 'google_live');
create type sentiment as enum ('liked', 'fine', 'disliked');
create type report_reason as enum ('closed', 'unsafe', 'inaccessible', 'dirty', 'long_line', 'inaccurate', 'duplicate', 'privacy');
create type moderation_status as enum ('approved', 'queued', 'rejected');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  username text not null unique,
  phone_e164 text,
  home_city text not null default 'New York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(display_name) >= 2),
  check (username ~ '^[a-z0-9_]{3,24}$'),
  check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.bathrooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null,
  address text not null default '',
  neighborhood text not null default '',
  city text not null default '',
  location geography(point, 4326) not null,
  access access_type not null default 'unknown',
  price_note text not null default 'Unknown',
  opening_hours text not null default 'Unknown',
  confidence numeric(4, 3) not null default 0.35,
  directions_note text not null default '',
  last_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger bathrooms_set_updated_at
before update on public.bathrooms
for each row execute function public.set_updated_at();

create table public.bathroom_sources (
  id uuid primary key default gen_random_uuid(),
  bathroom_id uuid not null references public.bathrooms(id) on delete cascade,
  source_name source_name not null,
  source_id text not null,
  fetched_at timestamptz not null,
  license text not null,
  confidence numeric(4, 3) not null default 0.35,
  confirmed_by_users integer not null default 0,
  contradicted_by_users integer not null default 0,
  unique (source_name, source_id)
);

create table public.bathroom_features (
  bathroom_id uuid not null references public.bathrooms(id) on delete cascade,
  feature text not null,
  confidence numeric(4, 3) not null default 0.5,
  source_id uuid references public.bathroom_sources(id) on delete set null,
  primary key (bathroom_id, feature)
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  bathroom_id uuid not null references public.bathrooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sentiment sentiment not null,
  public_note text not null default '',
  private_note text,
  created_at timestamptz not null default now()
);

create table public.visit_tags (
  visit_id uuid not null references public.visits(id) on delete cascade,
  tag text not null,
  primary key (visit_id, tag)
);

create table public.user_bathroom_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  bathroom_id uuid not null references public.bathrooms(id) on delete cascade,
  rating numeric(8, 3) not null default 1500,
  comparisons integer not null default 0,
  sentiment sentiment not null default 'fine',
  updated_at timestamptz not null default now(),
  primary key (user_id, bathroom_id)
);

create trigger user_bathroom_ratings_set_updated_at
before update on public.user_bathroom_ratings
for each row execute function public.set_updated_at();

create table public.pairwise_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  winner_bathroom_id uuid not null references public.bathrooms(id) on delete cascade,
  loser_bathroom_id uuid not null references public.bathrooms(id) on delete cascade,
  pair_low_bathroom_id uuid generated always as (least(winner_bathroom_id, loser_bathroom_id)) stored,
  pair_high_bathroom_id uuid generated always as (greatest(winner_bathroom_id, loser_bathroom_id)) stored,
  created_at timestamptz not null default now(),
  check (winner_bathroom_id <> loser_bathroom_id),
  unique (user_id, pair_low_bathroom_id, pair_high_bathroom_id)
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  bathroom_id uuid not null references public.bathrooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  alt text not null default '',
  moderation_status moderation_status not null default 'queued',
  created_at timestamptz not null default now()
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  visibility text not null default 'private',
  created_at timestamptz not null default now(),
  check (visibility in ('private', 'friends', 'public'))
);

create table public.list_items (
  list_id uuid not null references public.lists(id) on delete cascade,
  bathroom_id uuid not null references public.bathrooms(id) on delete cascade,
  position integer not null default 0,
  primary key (list_id, bathroom_id)
);

create table public.follows (
  follower_user_id uuid not null references auth.users(id) on delete cascade,
  followed_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_user_id, followed_user_id),
  check (follower_user_id <> followed_user_id)
);

create table public.feed_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  bathroom_id uuid references public.bathrooms(id) on delete cascade,
  event_type text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  bathroom_id uuid not null references public.bathrooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason report_reason not null,
  details text not null default '',
  created_at timestamptz not null default now()
);

create table public.moderation_queue (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  reason text not null,
  status moderation_status not null default 'queued',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  source_name source_name not null,
  status text not null default 'running',
  fetched_count integer not null default 0,
  merged_count integer not null default 0,
  rejected_count integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index bathrooms_location_idx on public.bathrooms using gist (location);
create index bathroom_sources_bathroom_idx on public.bathroom_sources (bathroom_id);
create index pairwise_comparisons_user_idx on public.pairwise_comparisons (user_id, created_at desc);
create index visits_user_idx on public.visits (user_id, created_at desc);
create index user_bathroom_ratings_user_idx on public.user_bathroom_ratings (user_id, rating desc);
create index lists_owner_idx on public.lists (owner_user_id, created_at desc);

create or replace function public.nearby_bathrooms(
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
  community_score numeric
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
    6.0::numeric as community_score
  from public.bathrooms b
  left join public.bathroom_features bf on bf.bathroom_id = b.id
  left join public.bathroom_sources bs on bs.bathroom_id = b.id
  group by b.id
  order by b.location <-> st_setsrid(st_makepoint(center_longitude, center_latitude), 4326)::geography
  limit least(greatest(result_limit, 1), 100);
$$;

grant execute on function public.nearby_bathrooms(double precision, double precision, integer) to anon, authenticated;

create or replace function public.community_comparison_votes()
returns table (
  winner_bathroom_id uuid,
  loser_bathroom_id uuid,
  voter_comparison_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with voter_history as (
    select user_id, count(*) as comparison_count
    from public.pairwise_comparisons
    group by user_id
  )
  select
    pc.winner_bathroom_id,
    pc.loser_bathroom_id,
    vh.comparison_count
  from public.pairwise_comparisons pc
  join voter_history vh on vh.user_id = pc.user_id;
$$;

grant execute on function public.community_comparison_votes() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.bathrooms enable row level security;
alter table public.bathroom_sources enable row level security;
alter table public.bathroom_features enable row level security;
alter table public.visits enable row level security;
alter table public.visit_tags enable row level security;
alter table public.user_bathroom_ratings enable row level security;
alter table public.pairwise_comparisons enable row level security;
alter table public.photos enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.follows enable row level security;
alter table public.feed_events enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_queue enable row level security;
alter table public.import_runs enable row level security;

create policy profiles_select_self on public.profiles for select using (id = auth.uid());
create policy profiles_insert_self on public.profiles for insert with check (id = auth.uid());
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy bathrooms_select_public on public.bathrooms for select to anon, authenticated using (true);
create policy bathrooms_insert_authenticated on public.bathrooms for insert to authenticated with check (true);
create policy bathroom_sources_select_public on public.bathroom_sources for select to anon, authenticated using (true);
create policy bathroom_features_select_public on public.bathroom_features for select to anon, authenticated using (true);

create policy visits_select_own on public.visits for select using (user_id = auth.uid());
create policy visits_insert_own on public.visits for insert with check (user_id = auth.uid());
create policy visits_update_own on public.visits for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy visit_tags_select_own on public.visit_tags
for select using (exists (select 1 from public.visits v where v.id = visit_id and v.user_id = auth.uid()));
create policy visit_tags_insert_own on public.visit_tags
for insert with check (exists (select 1 from public.visits v where v.id = visit_id and v.user_id = auth.uid()));

create policy ratings_select_own on public.user_bathroom_ratings for select using (user_id = auth.uid());
create policy ratings_insert_own on public.user_bathroom_ratings for insert with check (user_id = auth.uid());
create policy ratings_update_own on public.user_bathroom_ratings for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy comparisons_select_own on public.pairwise_comparisons for select using (user_id = auth.uid());
create policy comparisons_insert_own on public.pairwise_comparisons for insert with check (user_id = auth.uid());
create policy comparisons_update_own on public.pairwise_comparisons
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy photos_select_approved_or_own on public.photos
for select using (moderation_status = 'approved' or user_id = auth.uid());
create policy photos_insert_own on public.photos for insert with check (user_id = auth.uid());

create policy lists_select_own on public.lists for select using (owner_user_id = auth.uid());
create policy lists_insert_own on public.lists for insert with check (owner_user_id = auth.uid());
create policy lists_update_own on public.lists for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy list_items_select_own on public.list_items
for select using (exists (select 1 from public.lists l where l.id = list_id and l.owner_user_id = auth.uid()));
create policy list_items_insert_own on public.list_items
for insert with check (exists (select 1 from public.lists l where l.id = list_id and l.owner_user_id = auth.uid()));
create policy list_items_delete_own on public.list_items
for delete using (exists (select 1 from public.lists l where l.id = list_id and l.owner_user_id = auth.uid()));

create policy follows_select_own on public.follows for select using (follower_user_id = auth.uid() or followed_user_id = auth.uid());
create policy follows_insert_own on public.follows for insert with check (follower_user_id = auth.uid());
create policy follows_delete_own on public.follows for delete using (follower_user_id = auth.uid());

create policy feed_select_authenticated on public.feed_events for select to authenticated using (true);
create policy feed_insert_own on public.feed_events for insert with check (actor_user_id = auth.uid());

create policy reports_select_own on public.reports for select using (user_id = auth.uid());
create policy reports_insert_own on public.reports for insert with check (user_id = auth.uid());
