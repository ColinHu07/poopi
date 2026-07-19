-- Run with `supabase test db` after all migrations. The transaction rolls back
-- every fixture and verifies the real Postgres policies with JWT-shaped claims.
begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'anon@poopi.test', '', now(), '{}', '{}', now(), now()),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member@poopi.test', '', now(), '{}', '{}', now(), now()),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@poopi.test', '', now(), '{}', '{}', now(), now());

insert into public.bathrooms (id, name, kind, location) values
  ('a0000000-0000-4000-8000-000000000001', 'RLS Bathroom A', 'test', st_geogfromtext('POINT(-73.98 40.75)')),
  ('a0000000-0000-4000-8000-000000000002', 'RLS Bathroom B', 'test', st_geogfromtext('POINT(-73.99 40.76)'));

set local role anon;
select set_config('request.jwt.claims', '{}', true);
do $$
begin
  if (select count(*) from public.bathrooms where id = 'a0000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'anon role could not read public bathrooms';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}', true);
select public.submit_comparison_vote(
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000002'
);

do $$
begin
  begin
    insert into public.visits (bathroom_id, user_id, sentiment)
    values ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'fine');
    raise exception 'anonymous visit unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}', true);
insert into public.visits (id, bathroom_id, user_id, sentiment, public_note, private_note, visibility)
values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'liked', 'Safe public copy', 'Never public', 'public'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'fine', 'Private visit copy', 'Also private', 'private');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{}', true);
do $$
begin
  if (select count(*) from public.public_bathroom_reviews('a0000000-0000-4000-8000-000000000001')) <> 1 then
    raise exception 'public review RPC leaked or omitted visits';
  end if;
  if pg_get_function_result('public.public_bathroom_reviews(uuid)'::regprocedure) like '%private_note%'
     or pg_get_function_result('public.public_bathroom_reviews(uuid)'::regprocedure) like '%user_id%' then
    raise exception 'public review RPC exposes protected fields';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}', true);
do $$
begin
  if (select count(*) from public.visits where user_id = '20000000-0000-4000-8000-000000000002') <> 0 then
    raise exception 'another account could read owner-only visits or private notes';
  end if;
end;
$$;

rollback;
