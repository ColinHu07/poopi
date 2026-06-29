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
  user_id uuid not null,
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

create table public.pairwise_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  winner_bathroom_id uuid not null references public.bathrooms(id) on delete cascade,
  loser_bathroom_id uuid not null references public.bathrooms(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (winner_bathroom_id <> loser_bathroom_id)
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  bathroom_id uuid not null references public.bathrooms(id) on delete cascade,
  user_id uuid not null,
  storage_path text not null,
  alt text not null default '',
  moderation_status moderation_status not null default 'queued',
  created_at timestamptz not null default now()
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  title text not null,
  description text not null default '',
  visibility text not null default 'private',
  created_at timestamptz not null default now()
);

create table public.list_items (
  list_id uuid not null references public.lists(id) on delete cascade,
  bathroom_id uuid not null references public.bathrooms(id) on delete cascade,
  position integer not null default 0,
  primary key (list_id, bathroom_id)
);

create table public.follows (
  follower_user_id uuid not null,
  followed_user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (follower_user_id, followed_user_id),
  check (follower_user_id <> followed_user_id)
);

create table public.feed_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  bathroom_id uuid references public.bathrooms(id) on delete cascade,
  event_type text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  bathroom_id uuid not null references public.bathrooms(id) on delete cascade,
  user_id uuid not null,
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
