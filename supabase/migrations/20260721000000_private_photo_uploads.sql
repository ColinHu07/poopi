-- SAFETY-01: private bathroom-photo storage with owner uploads and
-- moderation-gated public reads. Client images are normalized to JPEG before
-- upload so location-bearing EXIF metadata is not retained.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bathroom-photos',
  'bathroom-photos',
  false,
  6291456,
  array['image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists bathroom_photos_insert_own on storage.objects;
create policy bathroom_photos_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'bathroom-photos'
  and public.is_permanent_user()
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg')
);

drop policy if exists bathroom_photos_select_allowed on storage.objects;
create policy bathroom_photos_select_allowed on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'bathroom-photos'
  and (
    owner_id = auth.uid()::text
    or exists (
      select 1
      from public.photos p
      where p.storage_path = storage.objects.name
        and p.moderation_status = 'approved'
    )
  )
);

drop policy if exists bathroom_photos_delete_own on storage.objects;
create policy bathroom_photos_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'bathroom-photos'
  and owner_id = auth.uid()::text
  and public.is_permanent_user()
);

drop policy if exists photos_insert_own on public.photos;
create policy photos_insert_own on public.photos
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_permanent_user()
  and storage_path like auth.uid()::text || '/%'
);

drop policy if exists photos_delete_own on public.photos;
create policy photos_delete_own on public.photos
for delete to authenticated
using (user_id = auth.uid() and public.is_permanent_user());
