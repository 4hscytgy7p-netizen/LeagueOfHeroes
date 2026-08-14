-- Приватное хранилище портретов персонажей личного кабинета.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'character-portraits',
  'character-portraits',
  false,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users_read_own_character_portraits" on storage.objects;
create policy "users_read_own_character_portraits" on storage.objects
for select to authenticated
using (bucket_id = 'character-portraits' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users_upload_own_character_portraits" on storage.objects;
create policy "users_upload_own_character_portraits" on storage.objects
for insert to authenticated
with check (bucket_id = 'character-portraits' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users_update_own_character_portraits" on storage.objects;
create policy "users_update_own_character_portraits" on storage.objects
for update to authenticated
using (bucket_id = 'character-portraits' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'character-portraits' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users_delete_own_character_portraits" on storage.objects;
create policy "users_delete_own_character_portraits" on storage.objects
for delete to authenticated
using (bucket_id = 'character-portraits' and (storage.foldername(name))[1] = auth.uid()::text);
