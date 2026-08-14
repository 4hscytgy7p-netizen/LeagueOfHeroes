-- League of Heroes: журнал/handout и синхронизация инициативы.
-- Выполните после schema.sql либо после предыдущих миграций Roll20 Sync.

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  character_id uuid references public.characters(id) on delete cascade,
  entry_type text not null default 'diary'
    check (entry_type in ('gm_note','location','quest','diary','deity','organization')),
  title text not null default 'Без названия',
  body text not null default '',
  visibility text not null default 'private'
    check (visibility in ('private','players')),
  roll20_handout_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists journal_entries_owner_character_idx
  on public.journal_entries(user_id, character_id, updated_at desc);

alter table public.journal_entries enable row level security;
drop policy if exists "users_manage_own_journal" on public.journal_entries;
create policy "users_manage_own_journal" on public.journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists set_timestamp on public.journal_entries;
create trigger set_timestamp before update on public.journal_entries
  for each row execute function public.set_timestamp();

create or replace function public.extension_list_journal(sync_token text, filter_character_id uuid)
returns table(id uuid, character_id uuid, entry_type text, title text, body text,
  visibility text, roll20_handout_id text, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare owner_id uuid := public.sync_token_owner(sync_token);
begin
  if owner_id is null then raise exception 'Invalid sync token'; end if;
  return query select entry.id, entry.character_id, entry.entry_type, entry.title,
    entry.body, entry.visibility, entry.roll20_handout_id, entry.created_at, entry.updated_at
  from public.journal_entries entry
  where entry.user_id = owner_id
    and (filter_character_id is null or entry.character_id = filter_character_id)
  order by entry.updated_at desc;
end; $$;

create or replace function public.extension_save_journal(
  sync_token text, journal_entry_id uuid, character_id uuid, input_entry_type text,
  input_title text, input_body text, input_visibility text, input_roll20_handout_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid := public.sync_token_owner(sync_token); result jsonb;
  normalized_type text := case when input_entry_type in ('gm_note','location','quest','diary','deity','organization') then input_entry_type else 'diary' end;
  normalized_visibility text := case when input_visibility = 'players' then 'players' else 'private' end;
begin
  if owner_id is null then raise exception 'Invalid sync token'; end if;
  if character_id is not null and not exists (
    select 1 from public.characters character where character.id = character_id and character.user_id = owner_id
  ) then raise exception 'Character not found'; end if;
  if journal_entry_id is null then
    insert into public.journal_entries(user_id, character_id, entry_type, title, body, visibility, roll20_handout_id)
    values (owner_id, character_id, normalized_type,
      left(coalesce(nullif(btrim(input_title), ''), 'Без названия'), 160),
      left(coalesce(input_body, ''), 100000), normalized_visibility,
      nullif(left(coalesce(input_roll20_handout_id, ''), 160), ''))
    returning jsonb_build_object('id', id, 'updated_at', updated_at) into result;
  else
    update public.journal_entries entry
    set character_id = extension_save_journal.character_id,
      entry_type = normalized_type,
      title = left(coalesce(nullif(btrim(input_title), ''), 'Без названия'), 160),
      body = left(coalesce(input_body, ''), 100000), visibility = normalized_visibility,
      roll20_handout_id = coalesce(nullif(left(coalesce(input_roll20_handout_id, ''), 160), ''), entry.roll20_handout_id)
    where entry.id = journal_entry_id and entry.user_id = owner_id
    returning jsonb_build_object('id', entry.id, 'updated_at', entry.updated_at) into result;
    if result is null then raise exception 'Journal entry not found'; end if;
  end if;
  return result;
end; $$;

create or replace function public.extension_delete_journal(sync_token text, journal_entry_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare owner_id uuid := public.sync_token_owner(sync_token);
begin
  if owner_id is null then raise exception 'Invalid sync token'; end if;
  delete from public.journal_entries entry where entry.id = journal_entry_id and entry.user_id = owner_id;
  return found;
end; $$;

revoke all on function public.extension_list_journal(text, uuid) from public;
revoke all on function public.extension_save_journal(text, uuid, uuid, text, text, text, text, text) from public;
revoke all on function public.extension_delete_journal(text, uuid) from public;
grant execute on function public.extension_list_journal(text, uuid) to anon, authenticated;
grant execute on function public.extension_save_journal(text, uuid, uuid, text, text, text, text, text) to anon, authenticated;
grant execute on function public.extension_delete_journal(text, uuid) to anon, authenticated;

-- Заменяем whitelist, чтобы текущая инициатива могла храниться в play_state.
create or replace function public.extension_update_character(
  sync_token text, character_id uuid, expected_revision integer, updates jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid := public.sync_token_owner(sync_token); allowed jsonb := '{}'::jsonb;
  allowed_keys text[] := array['hp','hp_max','hp_temp','inspiration','experience','death_saves',
    'spell_slots','class_resource','other_resource','currencies','initiative'];
  key text; attribute_key text; attribute_value jsonb; allowed_attributes jsonb := '{}'::jsonb; result jsonb;
begin
  if owner_id is null then raise exception 'Invalid sync token'; end if;
  if jsonb_typeof(coalesce(updates, '{}'::jsonb)) <> 'object' then raise exception 'Updates must be an object'; end if;
  foreach key in array allowed_keys loop
    if updates ? key then allowed := allowed || jsonb_build_object(key, updates -> key); end if;
  end loop;
  if jsonb_typeof(updates -> 'roll20_attributes') = 'object' then
    for attribute_key, attribute_value in select entry.key, entry.value from jsonb_each(updates -> 'roll20_attributes') entry loop
      if attribute_key ~ '^(hp|inspiration|experience|deathsave_(fail|succ)[123]|lvl[1-9]_slots_(total|expended)|class_resource|other_resource|cp|sp|ep|gp|pp)$'
        and jsonb_typeof(attribute_value) = 'object' then
        allowed_attributes := allowed_attributes || jsonb_build_object(attribute_key,
          jsonb_build_object('current', left(coalesce(attribute_value ->> 'current', ''), 120),
            'max', left(coalesce(attribute_value ->> 'max', ''), 120)));
      end if;
    end loop;
  end if;
  if allowed_attributes <> '{}'::jsonb then allowed := allowed || jsonb_build_object('roll20_attributes', allowed_attributes); end if;
  update public.characters character set play_state = character.play_state || allowed,
    revision = character.revision + 1, updated_at = now()
  where character.id = character_id and character.user_id = owner_id and character.revision = expected_revision
  returning jsonb_build_object('id', character.id, 'revision', character.revision,
    'updated_at', character.updated_at, 'play_state', character.play_state) into result;
  if result is null then raise exception 'Character changed on the site. Load it again.'; end if;
  return result;
end; $$;

revoke all on function public.extension_update_character(text, uuid, integer, jsonb) from public;
grant execute on function public.extension_update_character(text, uuid, integer, jsonb) to anon, authenticated;
