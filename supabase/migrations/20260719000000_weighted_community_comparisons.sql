-- Pool one head-to-head opinion per identity and expose privacy-safe inputs for
-- weighted community Bradley-Terry ranking. Anonymous Supabase users have a
-- normal auth.uid(), so the same ownership policy applies to guests.

delete from public.pairwise_comparisons older
using public.pairwise_comparisons newer
where older.user_id = newer.user_id
  and least(older.winner_bathroom_id, older.loser_bathroom_id)
    = least(newer.winner_bathroom_id, newer.loser_bathroom_id)
  and greatest(older.winner_bathroom_id, older.loser_bathroom_id)
    = greatest(newer.winner_bathroom_id, newer.loser_bathroom_id)
  and (older.created_at, older.id) < (newer.created_at, newer.id);

alter table public.pairwise_comparisons
  add column pair_low_bathroom_id uuid
    generated always as (least(winner_bathroom_id, loser_bathroom_id)) stored,
  add column pair_high_bathroom_id uuid
    generated always as (greatest(winner_bathroom_id, loser_bathroom_id)) stored;

alter table public.pairwise_comparisons
  add constraint pairwise_comparisons_one_vote_per_pair
  unique (user_id, pair_low_bathroom_id, pair_high_bathroom_id);

create policy comparisons_update_own on public.pairwise_comparisons
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

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

revoke all on function public.community_comparison_votes() from public;
grant execute on function public.community_comparison_votes() to anon, authenticated;
