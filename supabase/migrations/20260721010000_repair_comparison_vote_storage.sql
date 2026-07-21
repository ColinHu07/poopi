-- Repair partially-applied comparison storage before accepting more votes.
-- Some projects received submit_comparison_vote without the canonical pair
-- columns from the earlier weighted-comparisons migration.

alter table public.pairwise_comparisons
  add column if not exists pair_low_bathroom_id uuid
    generated always as (least(winner_bathroom_id, loser_bathroom_id)) stored,
  add column if not exists pair_high_bathroom_id uuid
    generated always as (greatest(winner_bathroom_id, loser_bathroom_id)) stored;

delete from public.pairwise_comparisons older
using public.pairwise_comparisons newer
where older.user_id = newer.user_id
  and older.pair_low_bathroom_id = newer.pair_low_bathroom_id
  and older.pair_high_bathroom_id = newer.pair_high_bathroom_id
  and (older.created_at, older.id) < (newer.created_at, newer.id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pairwise_comparisons'::regclass
      and conname = 'pairwise_comparisons_one_vote_per_pair'
  ) then
    alter table public.pairwise_comparisons
      add constraint pairwise_comparisons_one_vote_per_pair
      unique (user_id, pair_low_bathroom_id, pair_high_bathroom_id);
  end if;
end;
$$;

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
  on conflict on constraint pairwise_comparisons_one_vote_per_pair
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
