-- DATA-03: public bathroom discovery, persistent anonymous comparisons, and
-- permanent-account-only contributions. Raw visits remain owner-only because
-- they contain private notes; public reviews are exposed through a safe RPC.

create or replace function public.is_permanent_user()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select auth.uid() is not null
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

revoke all on function public.is_permanent_user() from public;
grant execute on function public.is_permanent_user() to authenticated;

drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert to authenticated
with check (id = auth.uid() and public.is_permanent_user());
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid() and public.is_permanent_user())
with check (id = auth.uid() and public.is_permanent_user());

drop policy if exists bathrooms_insert_authenticated on public.bathrooms;
create policy bathrooms_insert_permanent_account on public.bathrooms for insert to authenticated
with check (public.is_permanent_user());

drop policy if exists visits_insert_own on public.visits;
drop policy if exists visits_update_own on public.visits;
drop policy if exists visits_delete_own on public.visits;
create policy visits_insert_own on public.visits for insert to authenticated
with check (user_id = auth.uid() and public.is_permanent_user());
create policy visits_update_own on public.visits for update to authenticated
using (user_id = auth.uid() and public.is_permanent_user())
with check (user_id = auth.uid() and public.is_permanent_user());
create policy visits_delete_own on public.visits for delete to authenticated
using (user_id = auth.uid() and public.is_permanent_user());

drop policy if exists visit_tags_insert_own on public.visit_tags;
drop policy if exists visit_tags_delete_own on public.visit_tags;
create policy visit_tags_insert_own on public.visit_tags for insert to authenticated
with check (
  public.is_permanent_user()
  and exists (select 1 from public.visits v where v.id = visit_id and v.user_id = auth.uid())
);
create policy visit_tags_delete_own on public.visit_tags for delete to authenticated
using (
  public.is_permanent_user()
  and exists (select 1 from public.visits v where v.id = visit_id and v.user_id = auth.uid())
);

drop policy if exists photos_insert_own on public.photos;
create policy photos_insert_own on public.photos for insert to authenticated
with check (user_id = auth.uid() and public.is_permanent_user());

drop policy if exists lists_insert_own on public.lists;
drop policy if exists lists_update_own on public.lists;
create policy lists_insert_own on public.lists for insert to authenticated
with check (owner_user_id = auth.uid() and public.is_permanent_user());
create policy lists_update_own on public.lists for update to authenticated
using (owner_user_id = auth.uid() and public.is_permanent_user())
with check (owner_user_id = auth.uid() and public.is_permanent_user());
create policy lists_delete_own on public.lists for delete to authenticated
using (owner_user_id = auth.uid() and public.is_permanent_user());

drop policy if exists list_items_insert_own on public.list_items;
drop policy if exists list_items_delete_own on public.list_items;
create policy list_items_insert_own on public.list_items for insert to authenticated
with check (
  public.is_permanent_user()
  and exists (select 1 from public.lists l where l.id = list_id and l.owner_user_id = auth.uid())
);
create policy list_items_delete_own on public.list_items for delete to authenticated
using (
  public.is_permanent_user()
  and exists (select 1 from public.lists l where l.id = list_id and l.owner_user_id = auth.uid())
);

drop policy if exists follows_insert_own on public.follows;
drop policy if exists follows_delete_own on public.follows;
create policy follows_insert_own on public.follows for insert to authenticated
with check (follower_user_id = auth.uid() and public.is_permanent_user());
create policy follows_delete_own on public.follows for delete to authenticated
using (follower_user_id = auth.uid() and public.is_permanent_user());

drop policy if exists feed_insert_own on public.feed_events;
create policy feed_insert_own on public.feed_events for insert to authenticated
with check (actor_user_id = auth.uid() and public.is_permanent_user());

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports for insert to authenticated
with check (user_id = auth.uid() and public.is_permanent_user());

-- Comparisons remain available to anonymous and permanent identities, but all
-- writes go through the rate-limited function below.
drop policy if exists comparisons_insert_own on public.pairwise_comparisons;
drop policy if exists comparisons_update_own on public.pairwise_comparisons;

create table public.comparison_vote_rate_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index comparison_vote_rate_events_user_time_idx
  on public.comparison_vote_rate_events (user_id, created_at desc);
alter table public.comparison_vote_rate_events enable row level security;

create or replace function public.submit_comparison_vote(
  p_winner_bathroom_id uuid,
  p_loser_bathroom_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  comparison_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_winner_bathroom_id = p_loser_bathroom_id then
    raise exception 'A bathroom cannot be compared with itself';
  end if;

  delete from public.comparison_vote_rate_events
  where user_id = auth.uid() and created_at < now() - interval '24 hours';

  if (
    select count(*) from public.comparison_vote_rate_events e
    where e.user_id = auth.uid() and e.created_at >= now() - interval '1 hour'
  ) >= 60 then
    raise exception 'Comparison rate limit reached. Try again later.';
  end if;

  insert into public.comparison_vote_rate_events (user_id) values (auth.uid());

  insert into public.user_bathroom_ratings (
    user_id, bathroom_id, rating, comparisons, sentiment
  ) values
    (auth.uid(), p_winner_bathroom_id, 1500, 0, 'fine'),
    (auth.uid(), p_loser_bathroom_id, 1500, 0, 'fine')
  on conflict (user_id, bathroom_id) do nothing;

  insert into public.pairwise_comparisons (
    user_id, winner_bathroom_id, loser_bathroom_id, created_at
  ) values (
    auth.uid(), p_winner_bathroom_id, p_loser_bathroom_id, now()
  )
  on conflict (user_id, pair_low_bathroom_id, pair_high_bathroom_id)
  do update set
    winner_bathroom_id = excluded.winner_bathroom_id,
    loser_bathroom_id = excluded.loser_bathroom_id,
    created_at = now()
  returning id into comparison_id;

  return comparison_id;
end;
$$;

revoke all on function public.submit_comparison_vote(uuid, uuid) from public;
grant execute on function public.submit_comparison_vote(uuid, uuid) to authenticated;

create or replace function public.public_bathroom_reviews(p_bathroom_id uuid)
returns table (
  id uuid,
  bathroom_id uuid,
  sentiment sentiment,
  cleanliness_rating smallint,
  odor_rating smallint,
  privacy_rating smallint,
  wait_bucket text,
  observed_access access_type,
  observed_status text,
  rating_tags text[],
  public_note text,
  observed_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.bathroom_id,
    v.sentiment,
    v.cleanliness_rating,
    v.odor_rating,
    v.privacy_rating,
    v.wait_bucket,
    v.observed_access,
    v.observed_status,
    coalesce(array_agg(vt.tag order by vt.tag) filter (where vt.tag is not null), array[]::text[]) as rating_tags,
    v.public_note,
    v.observed_at,
    v.created_at
  from public.visits v
  left join public.visit_tags vt on vt.visit_id = v.id
  where v.bathroom_id = p_bathroom_id
    and v.visibility = 'public'
  group by v.id
  order by v.observed_at desc
  limit 100;
$$;

revoke all on function public.public_bathroom_reviews(uuid) from public;
grant execute on function public.public_bathroom_reviews(uuid) to anon, authenticated;
