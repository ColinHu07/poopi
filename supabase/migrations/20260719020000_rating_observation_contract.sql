-- DATA-01: keep durable bathroom facts separate from timestamped visit ratings.
-- Unsupported legacy values are archived before removal so the migration is
-- forward-only without discarding source data.

create table public.legacy_bathroom_features (
  bathroom_id uuid not null,
  feature text not null,
  confidence numeric(4, 3),
  source_id uuid,
  archived_at timestamptz not null default now(),
  primary key (bathroom_id, feature)
);

insert into public.legacy_bathroom_features (bathroom_id, feature, confidence, source_id)
select bathroom_id, feature, confidence, source_id
from public.bathroom_features
where feature not in (
  'wheelchair_accessible', 'step_free', 'accessible_stall', 'grab_bars',
  'automatic_door', 'baby_changing', 'adult_changing', 'family_room',
  'all_gender', 'single_stall', 'multiple_stalls', 'urinal_only',
  'sharps_disposal', 'hook_or_shelf', 'mirror', 'bidet'
)
on conflict do nothing;

delete from public.bathroom_features
where feature not in (
  'wheelchair_accessible', 'step_free', 'accessible_stall', 'grab_bars',
  'automatic_door', 'baby_changing', 'adult_changing', 'family_room',
  'all_gender', 'single_stall', 'multiple_stalls', 'urinal_only',
  'sharps_disposal', 'hook_or_shelf', 'mirror', 'bidet'
);

alter table public.bathroom_features
  add constraint bathroom_features_durable_feature
  check (feature in (
    'wheelchair_accessible', 'step_free', 'accessible_stall', 'grab_bars',
    'automatic_door', 'baby_changing', 'adult_changing', 'family_room',
    'all_gender', 'single_stall', 'multiple_stalls', 'urinal_only',
    'sharps_disposal', 'hook_or_shelf', 'mirror', 'bidet'
  ));

alter table public.visits
  add column cleanliness_rating smallint,
  add column odor_rating smallint,
  add column privacy_rating smallint,
  add column wait_bucket text,
  add column observed_access access_type,
  add column observed_status text not null default 'unknown',
  add column visibility text not null default 'public',
  add column observed_at timestamptz;

update public.visits set observed_at = created_at where observed_at is null;

alter table public.visits
  alter column observed_at set default now(),
  alter column observed_at set not null,
  add constraint visits_cleanliness_rating_range check (cleanliness_rating between 1 and 5),
  add constraint visits_odor_rating_range check (odor_rating between 1 and 5),
  add constraint visits_privacy_rating_range check (privacy_rating between 1 and 5),
  add constraint visits_wait_bucket_valid check (
    wait_bucket is null or wait_bucket in ('none', 'under_five', 'five_to_ten', 'ten_to_twenty', 'over_twenty')
  ),
  add constraint visits_observed_status_valid check (
    observed_status in ('open', 'closed', 'partly_out_of_order', 'out_of_order', 'unknown')
  ),
  add constraint visits_visibility_valid check (visibility in ('public', 'friends', 'private')),
  add constraint visits_observed_at_not_future check (observed_at <= created_at + interval '5 minutes');

create table public.legacy_visit_tags (
  visit_id uuid not null,
  tag text not null,
  archived_at timestamptz not null default now(),
  primary key (visit_id, tag)
);

insert into public.legacy_visit_tags (visit_id, tag)
select visit_id, tag
from public.visit_tags
where tag not in (
  'sparkling_clean', 'fresh_smelling', 'well_stocked', 'great_soap',
  'paper_towels', 'well_maintained', 'no_wait', 'short_line',
  'plenty_of_stalls', 'easy_to_find', 'open_late', 'free_to_use',
  'very_private', 'single_stall', 'strong_locks', 'minimal_stall_gaps',
  'spacious', 'great_lighting', 'good_ventilation', 'hooks_and_shelves',
  'gender_neutral', 'wheelchair_accessible', 'step_free', 'family_restroom',
  'changing_table', 'menstrual_products', 'touchless_fixtures', 'bidet',
  'luxury_bathroom', 'hidden_gem', 'dirty', 'smelly', 'poorly_stocked',
  'no_toilet_paper', 'no_soap', 'long_line', 'crowded', 'hard_to_find',
  'customers_only', 'broken_lock', 'little_privacy', 'cramped',
  'poor_lighting', 'poor_ventilation', 'out_of_order', 'felt_unsafe'
)
on conflict do nothing;

insert into public.visit_tags (visit_id, tag)
select
  visit_id,
  case tag
    when 'clean' then 'sparkling_clean'
    when 'smells_good' then 'fresh_smelling'
    when 'soap' then 'great_soap'
    when 'dryer_or_towels' then 'paper_towels'
    when 'lock_works' then 'strong_locks'
    when 'roomy_stall' then 'spacious'
    when 'private' then 'very_private'
    when 'well_lit' then 'great_lighting'
    when 'baby_changing' then 'changing_table'
    when 'all_gender' then 'gender_neutral'
  end
from public.legacy_visit_tags
where tag in (
  'clean', 'smells_good', 'soap', 'dryer_or_towels', 'lock_works',
  'roomy_stall', 'private', 'well_lit', 'baby_changing', 'all_gender'
)
on conflict do nothing;

delete from public.visit_tags
where tag not in (
  'sparkling_clean', 'fresh_smelling', 'well_stocked', 'great_soap',
  'paper_towels', 'well_maintained', 'no_wait', 'short_line',
  'plenty_of_stalls', 'easy_to_find', 'open_late', 'free_to_use',
  'very_private', 'single_stall', 'strong_locks', 'minimal_stall_gaps',
  'spacious', 'great_lighting', 'good_ventilation', 'hooks_and_shelves',
  'gender_neutral', 'wheelchair_accessible', 'step_free', 'family_restroom',
  'changing_table', 'menstrual_products', 'touchless_fixtures', 'bidet',
  'luxury_bathroom', 'hidden_gem', 'dirty', 'smelly', 'poorly_stocked',
  'no_toilet_paper', 'no_soap', 'long_line', 'crowded', 'hard_to_find',
  'customers_only', 'broken_lock', 'little_privacy', 'cramped',
  'poor_lighting', 'poor_ventilation', 'out_of_order', 'felt_unsafe'
);

alter table public.visit_tags
  add constraint visit_tags_approved_rating_label
  check (tag in (
    'sparkling_clean', 'fresh_smelling', 'well_stocked', 'great_soap',
    'paper_towels', 'well_maintained', 'no_wait', 'short_line',
    'plenty_of_stalls', 'easy_to_find', 'open_late', 'free_to_use',
    'very_private', 'single_stall', 'strong_locks', 'minimal_stall_gaps',
    'spacious', 'great_lighting', 'good_ventilation', 'hooks_and_shelves',
    'gender_neutral', 'wheelchair_accessible', 'step_free', 'family_restroom',
    'changing_table', 'menstrual_products', 'touchless_fixtures', 'bidet',
    'luxury_bathroom', 'hidden_gem', 'dirty', 'smelly', 'poorly_stocked',
    'no_toilet_paper', 'no_soap', 'long_line', 'crowded', 'hard_to_find',
    'customers_only', 'broken_lock', 'little_privacy', 'cramped',
    'poor_lighting', 'poor_ventilation', 'out_of_order', 'felt_unsafe'
  ));

create policy visits_delete_own on public.visits
for delete using (user_id = auth.uid());

create policy visit_tags_delete_own on public.visit_tags
for delete using (exists (
  select 1 from public.visits v where v.id = visit_id and v.user_id = auth.uid()
));

create or replace function public.submit_visit_observation(
  p_bathroom_id uuid,
  p_sentiment sentiment,
  p_public_note text default '',
  p_private_note text default null,
  p_labels text[] default array[]::text[],
  p_cleanliness_rating smallint default null,
  p_odor_rating smallint default null,
  p_privacy_rating smallint default null,
  p_wait_bucket text default null,
  p_observed_access access_type default null,
  p_observed_status text default 'unknown',
  p_visibility text default 'public',
  p_observed_at timestamptz default now()
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_visit_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.visits (
    bathroom_id, user_id, sentiment, public_note, private_note,
    cleanliness_rating, odor_rating, privacy_rating, wait_bucket,
    observed_access, observed_status, visibility, observed_at
  ) values (
    p_bathroom_id, auth.uid(), p_sentiment, coalesce(p_public_note, ''), p_private_note,
    p_cleanliness_rating, p_odor_rating, p_privacy_rating, p_wait_bucket,
    p_observed_access, p_observed_status, p_visibility, p_observed_at
  ) returning id into new_visit_id;

  insert into public.visit_tags (visit_id, tag)
  select new_visit_id, label
  from (select distinct unnest(coalesce(p_labels, array[]::text[])) as label) labels;

  insert into public.user_bathroom_ratings (
    user_id, bathroom_id, rating, comparisons, sentiment
  ) values (
    auth.uid(), p_bathroom_id,
    case p_sentiment when 'liked' then 1550 when 'fine' then 1500 else 1450 end,
    0, p_sentiment
  ) on conflict (user_id, bathroom_id) do nothing;

  return new_visit_id;
end;
$$;

revoke all on function public.submit_visit_observation(
  uuid, sentiment, text, text, text[], smallint, smallint, smallint,
  text, access_type, text, text, timestamptz
) from public;
grant execute on function public.submit_visit_observation(
  uuid, sentiment, text, text, text[], smallint, smallint, smallint,
  text, access_type, text, text, timestamptz
) to authenticated;

