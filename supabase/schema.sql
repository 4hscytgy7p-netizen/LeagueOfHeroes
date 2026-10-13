-- supabase/schema.sql
-- ЕДИНЫЙ ИСХОДНИК СХЕМЫ для новой пустой базы Supabase.
-- Содержит Discord Auth, роли, персонажей и синхронизацию Roll20.
--
-- НОВАЯ БАЗА: выполните этот файл целиком один раз.
-- РАБОТАЮЩАЯ БАЗА: не запускайте schema.sql повторно; применяйте только новые
-- файлы из supabase/migrations/ по порядку их дат.
-- Подробный порядок описан в supabase/README.md.

-- Расширение для gen_random_uuid()
create extension if not exists "pgcrypto";

-- Таблица профилей пользователей (связь с auth.users)
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  discord_id text unique,
  display_name text,
  avatar_url text,
  role text not null default 'player',
  character_slots integer not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Совместимое обновление ранней версии схемы.
alter table public.user_profiles add column if not exists display_name text;
alter table public.user_profiles add column if not exists avatar_url text;
alter table public.user_profiles add column if not exists character_slots integer not null default 1;
alter table public.user_profiles alter column role set default 'player';
update public.user_profiles set role = 'player' where role = 'user';
update public.user_profiles set role = 'master' where role = 'gm';
update public.user_profiles set role = 'player' where role not in ('player', 'test_master', 'master', 'admin');
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check check (role in ('player', 'test_master', 'master', 'admin'));
alter table public.user_profiles drop constraint if exists user_profiles_character_slots_check;
alter table public.user_profiles
  add constraint user_profiles_character_slots_check check (character_slots between 1 and 100);

-- Таблица инвайтов
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  type text not null,
  created_by uuid references public.user_profiles(id),
  used_by uuid references public.user_profiles(id),
  max_uses int default 1,
  current_uses int default 0,
  expires_at timestamptz,
  created_at timestamptz default now(),
  used_at timestamptz
);

-- Таблица закладок
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  resource_type text not null,
  resource_id text not null,
  created_at timestamptz default now(),
  constraint bookmarks_unique unique(user_id, resource_type, resource_id)
);

-- Основное облачное хранилище персонажей. draft_data содержит состояние
-- конструктора, roll20_data — последний подготовленный экспорт, play_state —
-- только разрешённые изменяемые в игре значения.
create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null default 'Безымянный герой',
  draft_data jsonb not null default '{}'::jsonb,
  roll20_data jsonb not null default '{}'::jsonb,
  play_state jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists characters_user_updated_idx
  on public.characters(user_id, updated_at desc);

-- Не блокируем уже созданных героев при первом применении обновления.
update public.user_profiles profile
set character_slots = greatest(
  profile.character_slots,
  (select count(*)::integer from public.characters character where character.user_id = profile.id),
  1
);

-- Отдельные отзывные ключи для расширения. В базе хранится только SHA-256.
create table if not exists public.character_sync_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  label text not null default 'Roll20',
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- Журнал Лиги: личные заметки, дневники, квесты, локации и записи,
-- которые можно переносить в handout Roll20.
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

-- Включаем Row-Level Security
alter table public.user_profiles enable row level security;
alter table public.invites enable row level security;
alter table public.bookmarks enable row level security;
alter table public.characters enable row level security;
alter table public.character_sync_tokens enable row level security;
alter table public.journal_entries enable row level security;

-- Проверка администратора вынесена в security definer, чтобы политики профилей
-- не вызывали рекурсивную проверку RLS той же таблицы.
create or replace function public.is_account_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_account_admin() from public;
grant execute on function public.is_account_admin() to authenticated;

-- Автоматически создаём/обновляем профиль после Discord OAuth.
create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (
    id,
    email,
    discord_id,
    display_name,
    avatar_url,
    role
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'provider_id',
      new.raw_user_meta_data ->> 'sub'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'user_name',
      new.email
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    'player'
  )
  on conflict (id) do update set
    email = excluded.email,
    discord_id = coalesce(excluded.discord_id, public.user_profiles.discord_id),
    display_name = coalesce(excluded.display_name, public.user_profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.user_profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_changed on auth.users;
create trigger on_auth_user_profile_changed
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_auth_user_profile();

-- Создаём профили для уже существующих пользователей.
insert into public.user_profiles (id, email, discord_id, display_name, avatar_url, role)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'provider_id', raw_user_meta_data ->> 'sub'),
  coalesce(
    raw_user_meta_data ->> 'full_name',
    raw_user_meta_data ->> 'name',
    raw_user_meta_data ->> 'user_name',
    email
  ),
  raw_user_meta_data ->> 'avatar_url',
  'player'
from auth.users
on conflict (id) do nothing;

-- Политики доступа
drop policy if exists "users_can_view_own_profile" on public.user_profiles;
create policy "users_can_view_own_profile" on public.user_profiles
  for select using (auth.uid() = id);

drop policy if exists "admins_view_all_profiles" on public.user_profiles;
create policy "admins_view_all_profiles" on public.user_profiles
  for select using (public.is_account_admin());

drop policy if exists "admins_update_profiles" on public.user_profiles;
create policy "admins_update_profiles" on public.user_profiles
  for update
  using (public.is_account_admin())
  with check (public.is_account_admin());

drop policy if exists "users_view_own_bookmarks" on public.bookmarks;
create policy "users_view_own_bookmarks" on public.bookmarks
  for select using (auth.uid() = user_id);

drop policy if exists "users_manage_own_bookmarks" on public.bookmarks;
drop policy if exists "users_insert_own_bookmarks" on public.bookmarks;
create policy "users_insert_own_bookmarks" on public.bookmarks
  for insert with check (auth.uid() = user_id);

drop policy if exists "users_update_own_bookmarks" on public.bookmarks;
create policy "users_update_own_bookmarks" on public.bookmarks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users_delete_own_bookmarks" on public.bookmarks;
create policy "users_delete_own_bookmarks" on public.bookmarks
  for delete using (auth.uid() = user_id);

drop policy if exists "admins_manage_invites" on public.invites;
create policy "admins_manage_invites" on public.invites
  for all using (public.is_account_admin()) with check (public.is_account_admin());

drop policy if exists "users_view_own_characters" on public.characters;
create policy "users_view_own_characters" on public.characters
  for select using (auth.uid() = user_id);

drop policy if exists "users_insert_own_characters" on public.characters;

drop policy if exists "users_update_own_characters" on public.characters;
create policy "users_update_own_characters" on public.characters
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users_delete_own_characters" on public.characters;
create policy "users_delete_own_characters" on public.characters
  for delete using (auth.uid() = user_id);

drop policy if exists "users_view_own_sync_tokens" on public.character_sync_tokens;
create policy "users_view_own_sync_tokens" on public.character_sync_tokens
  for select using (auth.uid() = user_id);

drop policy if exists "users_revoke_own_sync_tokens" on public.character_sync_tokens;
create policy "users_revoke_own_sync_tokens" on public.character_sync_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users_delete_own_sync_tokens" on public.character_sync_tokens;
create policy "users_delete_own_sync_tokens" on public.character_sync_tokens
  for delete using (auth.uid() = user_id);

drop policy if exists "users_manage_own_journal" on public.journal_entries;
create policy "users_manage_own_journal" on public.journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Обновление updated_at при изменении профиля
create or replace function public.set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp on public.user_profiles;
create trigger set_timestamp
  before update on public.user_profiles
  for each row execute function public.set_timestamp();

drop trigger if exists set_timestamp on public.characters;
create trigger set_timestamp
  before update on public.characters
  for each row execute function public.set_timestamp();

drop trigger if exists set_timestamp on public.journal_entries;
create trigger set_timestamp
  before update on public.journal_entries
  for each row execute function public.set_timestamp();

-- Создание только через RPC делает лимит слотов серверным, а не декоративным.
create or replace function public.create_character(character_name text default 'Безымянный герой')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  available_slots integer;
  occupied_slots integer;
  created_id uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;

  perform pg_advisory_xact_lock(hashtext(owner_id::text));
  select character_slots into available_slots from public.user_profiles where id = owner_id;
  if available_slots is null then raise exception 'User profile not found'; end if;

  select count(*)::integer into occupied_slots from public.characters where user_id = owner_id;
  if occupied_slots >= available_slots then raise exception 'Character slot limit reached'; end if;

  insert into public.characters(user_id, name)
  values (owner_id, left(coalesce(nullif(trim(character_name), ''), 'Безымянный герой'), 120))
  returning id into created_id;
  return created_id;
end;
$$;

-- Создание ключа. Открытое значение возвращается только один раз.
create or replace function public.create_character_sync_token(token_label text default 'Roll20')
returns table(id uuid, token text, label text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  raw_token text := 'loh_' || encode(gen_random_bytes(32), 'hex');
  created public.character_sync_tokens%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.character_sync_tokens(user_id, label, token_hash)
  values (auth.uid(), left(coalesce(nullif(trim(token_label), ''), 'Roll20'), 80), encode(digest(raw_token, 'sha256'), 'hex'))
  returning * into created;

  return query select created.id, raw_token, created.label, created.created_at;
end;
$$;

create or replace function public.revoke_character_sync_token(sync_token_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.character_sync_tokens
  set revoked_at = now()
  where id = sync_token_id and user_id = auth.uid() and revoked_at is null;
  return found;
end;
$$;

create or replace function public.sync_token_owner(raw_token text)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select user_id
  from public.character_sync_tokens
  where token_hash = encode(digest(coalesce(raw_token, ''), 'sha256'), 'hex')
    and revoked_at is null
  limit 1;
$$;

create or replace function public.extension_list_characters(sync_token text)
returns table(id uuid, name text, revision integer, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare owner_id uuid := public.sync_token_owner(sync_token);
begin
  if owner_id is null then raise exception 'Invalid sync token'; end if;
  update public.character_sync_tokens set last_used_at = now()
    where token_hash = encode(digest(sync_token, 'sha256'), 'hex');
  return query
    select c.id, c.name, c.revision, c.updated_at
    from public.characters c where c.user_id = owner_id
    order by c.updated_at desc;
end;
$$;

create or replace function public.extension_get_character(sync_token text, character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare owner_id uuid := public.sync_token_owner(sync_token); result jsonb;
begin
  if owner_id is null then raise exception 'Invalid sync token'; end if;
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'revision', c.revision,
    'updated_at', c.updated_at, 'roll20_data', c.roll20_data,
    'play_state', c.play_state
  ) into result
  from public.characters c
  where c.id = character_id and c.user_id = owner_id;
  if result is null then raise exception 'Character not found'; end if;
  return result;
end;
$$;

create or replace function public.extension_list_journal(sync_token text, filter_character_id uuid)
returns table(
  id uuid,
  character_id uuid,
  entry_type text,
  title text,
  body text,
  visibility text,
  roll20_handout_id text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare owner_id uuid := public.sync_token_owner(sync_token);
begin
  if owner_id is null then raise exception 'Invalid sync token'; end if;
  return query
    select entry.id, entry.character_id, entry.entry_type, entry.title, entry.body,
           entry.visibility, entry.roll20_handout_id, entry.created_at, entry.updated_at
    from public.journal_entries entry
    where entry.user_id = owner_id
      and (filter_character_id is null or entry.character_id = filter_character_id)
    order by entry.updated_at desc;
end;
$$;

create or replace function public.extension_save_journal(
  sync_token text,
  journal_entry_id uuid,
  character_id uuid,
  input_entry_type text,
  input_title text,
  input_body text,
  input_visibility text,
  input_roll20_handout_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := public.sync_token_owner(sync_token);
  result jsonb;
  normalized_type text := case when input_entry_type in ('gm_note','location','quest','diary','deity','organization') then input_entry_type else 'diary' end;
  normalized_visibility text := case when input_visibility = 'players' then 'players' else 'private' end;
begin
  if owner_id is null then raise exception 'Invalid sync token'; end if;
  if character_id is not null and not exists (
    select 1 from public.characters character
    where character.id = character_id and character.user_id = owner_id
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
        body = left(coalesce(input_body, ''), 100000),
        visibility = normalized_visibility,
        roll20_handout_id = coalesce(nullif(left(coalesce(input_roll20_handout_id, ''), 160), ''), entry.roll20_handout_id)
    where entry.id = journal_entry_id and entry.user_id = owner_id
    returning jsonb_build_object('id', entry.id, 'updated_at', entry.updated_at) into result;
    if result is null then raise exception 'Journal entry not found'; end if;
  end if;
  return result;
end;
$$;

create or replace function public.extension_delete_journal(sync_token text, journal_entry_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare owner_id uuid := public.sync_token_owner(sync_token);
begin
  if owner_id is null then raise exception 'Invalid sync token'; end if;
  delete from public.journal_entries entry
  where entry.id = journal_entry_id and entry.user_id = owner_id;
  return found;
end;
$$;

-- Расширение может записывать только этот белый список игровых полей.
create or replace function public.extension_update_character(
  sync_token text,
  character_id uuid,
  expected_revision integer,
  updates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := public.sync_token_owner(sync_token);
  allowed jsonb := '{}'::jsonb;
  allowed_keys text[] := array[
    'hp','hp_max','hp_temp','inspiration','experience','death_saves',
    'spell_slots','class_resource','other_resource','currencies','initiative'
  ];
  key text;
  attribute_key text;
  attribute_value jsonb;
  allowed_attributes jsonb := '{}'::jsonb;
  result jsonb;
begin
  if owner_id is null then raise exception 'Invalid sync token'; end if;
  if jsonb_typeof(coalesce(updates, '{}'::jsonb)) <> 'object' then
    raise exception 'Updates must be an object';
  end if;
  foreach key in array allowed_keys loop
    if updates ? key then allowed := allowed || jsonb_build_object(key, updates -> key); end if;
  end loop;

  -- Значения листа Roll20 принимаются только для игровых полей. Структурные
  -- атрибуты расы, класса, заклинаний и особенностей расширение менять не может.
  if jsonb_typeof(updates -> 'roll20_attributes') = 'object' then
    for attribute_key, attribute_value in
      select entry.key, entry.value from jsonb_each(updates -> 'roll20_attributes') as entry
    loop
      if attribute_key ~ '^(hp|inspiration|experience|deathsave_(fail|succ)[123]|lvl[1-9]_slots_(total|expended)|class_resource|other_resource|cp|sp|ep|gp|pp)$'
         and jsonb_typeof(attribute_value) = 'object' then
        allowed_attributes := allowed_attributes || jsonb_build_object(
          attribute_key,
          jsonb_build_object(
            'current', left(coalesce(attribute_value ->> 'current', ''), 120),
            'max', left(coalesce(attribute_value ->> 'max', ''), 120)
          )
        );
      end if;
    end loop;
  end if;
  if allowed_attributes <> '{}'::jsonb then
    allowed := allowed || jsonb_build_object('roll20_attributes', allowed_attributes);
  end if;

  update public.characters c
  set play_state = c.play_state || allowed,
      revision = c.revision + 1,
      updated_at = now()
  where c.id = character_id and c.user_id = owner_id
    and c.revision = expected_revision
  returning jsonb_build_object('id', c.id, 'revision', c.revision, 'updated_at', c.updated_at, 'play_state', c.play_state)
  into result;
  if result is null then raise exception 'Character changed on the site. Load it again.'; end if;
  return result;
end;
$$;

-- Полный VTTES-экспорт открытого чарника Roll20. В отличие от
-- extension_update_character эта функция намеренно заменяет roll20_data целиком:
-- пользователь явно нажал «Сохранить в Лиге» и владеет личным sync token.
create or replace function public.extension_save_roll20_character(
  sync_token text,
  character_id uuid,
  expected_revision integer,
  roll20_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  owner_id uuid := public.sync_token_owner(sync_token);
  payload_character jsonb;
  character_name text;
  available_slots integer;
  occupied_slots integer;
  result jsonb;
begin
  if owner_id is null then raise exception 'Invalid sync token'; end if;
  if jsonb_typeof(roll20_data) <> 'object'
     or roll20_data ->> 'type' <> 'character'
     or coalesce((roll20_data ->> 'schema_version')::integer, 0) <> 3 then
    raise exception 'Unsupported VTTES character JSON';
  end if;
  payload_character := roll20_data -> 'character';
  if jsonb_typeof(payload_character) <> 'object'
     or jsonb_typeof(payload_character -> 'attribs') <> 'array'
     or jsonb_typeof(payload_character -> 'abilities') <> 'array' then
    raise exception 'Invalid VTTES character payload';
  end if;
  if pg_column_size(roll20_data) > 20 * 1024 * 1024 then
    raise exception 'Character JSON is larger than 20 MB';
  end if;
  character_name := left(nullif(btrim(payload_character ->> 'name'), ''), 160);
  if character_name is null then character_name := 'Безымянный герой'; end if;

  if character_id is null then
    select profile.character_slots into available_slots
    from public.user_profiles profile
    where profile.id = owner_id
    for update;
    if available_slots is null then raise exception 'User profile not found'; end if;
    select count(*)::integer into occupied_slots
    from public.characters character
    where character.user_id = owner_id;
    if occupied_slots >= available_slots then raise exception 'Character slot limit reached'; end if;

    insert into public.characters (user_id, name, roll20_data, summary)
    values (owner_id, character_name, roll20_data, jsonb_build_object('source', 'roll20'))
    returning jsonb_build_object(
      'id', id, 'name', name, 'revision', revision, 'updated_at', updated_at
    ) into result;
  else
    update public.characters character
    set name = character_name,
        roll20_data = extension_save_roll20_character.roll20_data,
        play_state = '{}'::jsonb,
        revision = character.revision + 1,
        updated_at = now()
    where character.id = character_id
      and character.user_id = owner_id
      and character.revision = expected_revision
    returning jsonb_build_object(
      'id', character.id, 'name', character.name, 'revision', character.revision,
      'updated_at', character.updated_at
    ) into result;
    if result is null then
      raise exception 'Character changed on the site. Load the character list again.';
    end if;
  end if;

  update public.character_sync_tokens
  set last_used_at = now()
  where token_hash = encode(extensions.digest(sync_token, 'sha256'), 'hex');
  return result;
end;
$$;

revoke all on function public.sync_token_owner(text) from public;
revoke all on function public.create_character(text) from public;
revoke all on function public.create_character_sync_token(text) from public;
revoke all on function public.revoke_character_sync_token(uuid) from public;
revoke all on function public.extension_list_characters(text) from public;
revoke all on function public.extension_get_character(text, uuid) from public;
revoke all on function public.extension_update_character(text, uuid, integer, jsonb) from public;
revoke all on function public.extension_save_roll20_character(text, uuid, integer, jsonb) from public;
revoke all on function public.extension_list_journal(text, uuid) from public;
revoke all on function public.extension_save_journal(text, uuid, uuid, text, text, text, text, text) from public;
revoke all on function public.extension_delete_journal(text, uuid) from public;
grant execute on function public.create_character_sync_token(text) to authenticated;
grant execute on function public.create_character(text) to authenticated;
grant execute on function public.revoke_character_sync_token(uuid) to authenticated;
grant execute on function public.extension_list_characters(text) to anon, authenticated;
grant execute on function public.extension_get_character(text, uuid) to anon, authenticated;
grant execute on function public.extension_update_character(text, uuid, integer, jsonb) to anon, authenticated;
grant execute on function public.extension_save_roll20_character(text, uuid, integer, jsonb) to anon, authenticated;
grant execute on function public.extension_list_journal(text, uuid) to anon, authenticated;
grant execute on function public.extension_save_journal(text, uuid, uuid, text, text, text, text, text) to anon, authenticated;
grant execute on function public.extension_delete_journal(text, uuid) to anon, authenticated;

-- Примечания:
-- 1) После применения миграции войдите через Discord, затем назначьте первого
--    администратора вручную:
--    update public.user_profiles set role = 'admin' where discord_id = 'DISCORD_USER_ID';
-- 2) Не храните SUPABASE_SERVICE_ROLE_KEY в клиентском коде.

-- Рабочие пространства (миграция 20261012_team_workspaces).
-- Рабочие пространства совета мастеров и администрации.
begin;
create table public.team_workspaces (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 120),
  description text not null default '' check (length(description) <= 4000),
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now()
);
create table public.team_members (
  workspace_id uuid not null references public.team_workspaces(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  role text not null check (role in ('manager','editor','observer')),
  notify_discord boolean not null default false,
  notify_email boolean not null default false,
  primary key (workspace_id, user_id)
);
create table public.team_lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.team_workspaces(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  position integer not null default 0,
  unique (workspace_id, id)
);
create table public.team_cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.team_workspaces(id) on delete cascade,
  list_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 180),
  description text not null default '' check (length(description) <= 20000),
  kind text not null default 'task' check (kind in ('task','event')),
  assignees uuid[] not null default '{}',
  labels text[] not null default '{}',
  checklist jsonb not null default '[]' check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 100),
  starts_at timestamptz,
  due_at timestamptz,
  reminder_minutes integer check (reminder_minutes in (0, 60, 1440)),
  completed boolean not null default false,
  archived boolean not null default false,
  position integer not null default 0,
  revision integer not null default 1,
  schedule_revision integer not null default 1,
  created_by uuid not null references public.user_profiles(id),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, list_id) references public.team_lists(workspace_id, id),
  check (starts_at is null or due_at is null or starts_at <= due_at),
  check (reminder_minutes is null or due_at is not null),
  check (cardinality(assignees) <= 100 and cardinality(labels) <= 10)
);
create index team_cards_board_idx on public.team_cards(workspace_id, position);
create table public.team_comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.team_cards(id) on delete cascade,
  author_id uuid not null references public.user_profiles(id),
  body text not null check (length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index team_comments_card_idx on public.team_comments(card_id, created_at);
create table public.team_activity (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.team_workspaces(id) on delete cascade,
  card_id uuid references public.team_cards(id) on delete cascade,
  actor_id uuid references public.user_profiles(id) on delete set null,
  detail text not null,
  created_at timestamptz not null default now()
);
create index team_activity_board_idx on public.team_activity(workspace_id, created_at desc);
create table public.team_notifications (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.team_cards(id) on delete cascade,
  recipient_id uuid not null references public.user_profiles(id) on delete cascade,
  channel text not null check (channel in ('discord','email')),
  reason text not null check (reason in ('reminder','message')),
  message text not null default '' check (length(message) <= 1500),
  scheduled_at timestamptz not null,
  dedupe_key text not null unique,
  state text not null default 'pending' check (state in ('pending','sending','sent','failed','cancelled')),
  attempts integer not null default 0,
  lease_id uuid,
  leased_at timestamptz,
  error_code text,
  created_at timestamptz not null default now()
);
create index team_notifications_pending_idx on public.team_notifications(state, scheduled_at);

create function public.team_access(p_workspace uuid, p_level text default 'read') returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (public.is_account_admin() or exists (
    select 1 from public.team_members where workspace_id = p_workspace and user_id = auth.uid()
      and (p_level = 'read' or role = 'manager' or (p_level = 'write' and role = 'editor'))
  ));
$$;
revoke all on function public.team_access(uuid,text) from public;
grant execute on function public.team_access(uuid,text) to authenticated;
alter table public.team_workspaces enable row level security;
alter table public.team_members enable row level security;
alter table public.team_lists enable row level security;
alter table public.team_cards enable row level security;
alter table public.team_comments enable row level security;
alter table public.team_activity enable row level security;
alter table public.team_notifications enable row level security;
create policy team_workspace_read on public.team_workspaces for select to authenticated using (public.team_access(id));
create policy team_workspace_edit on public.team_workspaces for update to authenticated using (public.team_access(id,'manage')) with check (public.team_access(id,'manage'));
create policy team_member_read on public.team_members for select to authenticated using (public.team_access(workspace_id));
create policy team_list_read on public.team_lists for select to authenticated using (public.team_access(workspace_id));
create policy team_list_insert on public.team_lists for insert to authenticated with check (public.team_access(workspace_id,'write'));
create policy team_list_update on public.team_lists for update to authenticated using (public.team_access(workspace_id,'write')) with check (public.team_access(workspace_id,'write'));
create policy team_card_read on public.team_cards for select to authenticated using (public.team_access(workspace_id));
create policy team_card_insert on public.team_cards for insert to authenticated with check (public.team_access(workspace_id,'write') and created_by = auth.uid());
create policy team_card_update on public.team_cards for update to authenticated using (public.team_access(workspace_id,'write')) with check (public.team_access(workspace_id,'write'));
create policy team_comment_read on public.team_comments for select to authenticated using (exists (select 1 from public.team_cards c where c.id = card_id and public.team_access(c.workspace_id)));
create policy team_comment_insert on public.team_comments for insert to authenticated with check (author_id = auth.uid() and exists (select 1 from public.team_cards c where c.id = card_id and public.team_access(c.workspace_id,'write')));
create policy team_activity_read on public.team_activity for select to authenticated using (public.team_access(workspace_id));
create policy team_notification_read on public.team_notifications for select to authenticated using (exists (select 1 from public.team_cards c where c.id = card_id and public.team_access(c.workspace_id)));
-- Участники/журнал/очередь изменяются только проверенными функциями.
revoke all on public.team_workspaces, public.team_members, public.team_lists, public.team_cards, public.team_comments, public.team_activity, public.team_notifications from anon, authenticated;
grant select on public.team_workspaces, public.team_members, public.team_lists, public.team_cards, public.team_comments, public.team_activity, public.team_notifications to authenticated;
grant update (title,description) on public.team_workspaces to authenticated;
grant insert on public.team_lists, public.team_cards, public.team_comments to authenticated;
grant update (title,position) on public.team_lists to authenticated;
grant update (list_id,title,description,kind,assignees,labels,checklist,starts_at,due_at,reminder_minutes,completed,archived,position) on public.team_cards to authenticated;
grant all on public.team_workspaces, public.team_members, public.team_lists, public.team_cards, public.team_comments, public.team_activity, public.team_notifications to service_role;

create function public.team_create_workspace(p_title text, p_description text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_account_admin() then raise exception 'Только администратор создаёт пространства'; end if;
  insert into public.team_workspaces(title,description,created_by) values(trim(p_title),p_description,auth.uid()) returning id into v_id;
  insert into public.team_members(workspace_id,user_id,role) values(v_id,auth.uid(),'manager');
  insert into public.team_lists(workspace_id,title,position) values(v_id,'Входящие',0),(v_id,'В работе',1),(v_id,'На проверке',2),(v_id,'Готово',3);
  return v_id;
end;
$$;
create function public.team_set_member(p_workspace uuid, p_discord_id text, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.team_access(p_workspace,'manage') then raise exception 'Нет права управлять участниками'; end if;
  select i.user_id into v_user from auth.identities i join public.user_profiles p on p.id=i.user_id
    where i.provider='discord' and coalesce(i.identity_data->>'provider_id',i.identity_data->>'sub')=trim(p_discord_id);
  if v_user is null then raise exception 'Пользователь должен сначала войти на сайт через Discord'; end if;
  if v_user = auth.uid() then raise exception 'Собственный доступ изменяет другой руководитель'; end if;
  if p_role is null then
    delete from public.team_members where workspace_id = p_workspace and user_id = v_user;
    update public.team_cards set assignees = array_remove(assignees,v_user) where workspace_id = p_workspace and v_user = any(assignees);
    update public.team_notifications n set state='cancelled',error_code='recipient_unavailable' where n.recipient_id=v_user and n.state in ('pending','sending') and exists (select 1 from public.team_cards c where c.id=n.card_id and c.workspace_id=p_workspace);
  else
    insert into public.team_members(workspace_id,user_id,role) values(p_workspace,v_user,p_role)
      on conflict(workspace_id,user_id) do update set role = excluded.role;
  end if;
  insert into public.team_activity(workspace_id,actor_id,detail) values(p_workspace,auth.uid(),case when p_role is null then 'Участник удалён из пространства' else 'Изменён доступ участника: ' || p_role end);
end;
$$;
create function public.team_directory(p_workspace uuid)
returns table(user_id uuid, display_name text, discord_id text, role text, notify_discord boolean, notify_email boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.team_access(p_workspace) then raise exception 'Нет доступа'; end if;
  return query select m.user_id, coalesce(p.display_name,'Участник'),coalesce(i.identity_data->>'provider_id',i.identity_data->>'sub'),m.role,m.notify_discord,m.notify_email
    from public.team_members m join public.user_profiles p on p.id = m.user_id
    left join auth.identities i on i.user_id=p.id and i.provider='discord'
    where m.workspace_id = p_workspace order by p.display_name;
end;
$$;
create function public.team_notification_preferences(p_workspace uuid, p_discord boolean, p_email boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.team_members set notify_discord = p_discord, notify_email = p_email where workspace_id = p_workspace and user_id = auth.uid();
  if not found then raise exception 'Вы не участник пространства'; end if;
  insert into public.team_notifications(card_id,recipient_id,channel,reason,scheduled_at,dedupe_key)
  select c.id,auth.uid(),ch,'reminder',c.due_at - make_interval(mins => c.reminder_minutes),c.id::text || ':' || c.schedule_revision || ':' || auth.uid() || ':' || ch
  from public.team_cards c cross join unnest(array['discord','email']) ch
  where c.workspace_id = p_workspace and auth.uid() = any(c.assignees) and not c.completed and not c.archived
    and c.due_at >= now() and c.reminder_minutes is not null
    and ((ch = 'discord' and p_discord) or (ch = 'email' and p_email))
  on conflict(dedupe_key) do update set state = 'pending',error_code = null,attempts = 0
    where team_notifications.state = 'cancelled' and team_notifications.error_code = 'recipient_unavailable';
end;
$$;
create function public.team_validate_card() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from unnest(new.assignees) u where not exists (select 1 from public.team_members m where m.workspace_id = new.workspace_id and m.user_id = u)) then raise exception 'Исполнители должны быть участниками пространства'; end if;
  if exists (select 1 from jsonb_array_elements(new.checklist) i where jsonb_typeof(i) <> 'object' or jsonb_typeof(i->'text') is distinct from 'string' or length(trim(i->>'text')) not between 1 and 500 or jsonb_typeof(i->'done') is distinct from 'boolean') then raise exception 'Неверный чек-лист'; end if;
  if exists (select 1 from unnest(new.labels) l where l is null or length(l) not between 1 and 40) then raise exception 'Метка должна содержать от 1 до 40 символов'; end if;
  if tg_op = 'UPDATE' then
    new.revision := old.revision + 1;
    new.schedule_revision := old.schedule_revision + case when (new.due_at,new.reminder_minutes,new.completed,new.archived) is distinct from (old.due_at,old.reminder_minutes,old.completed,old.archived) then 1 else 0 end;
  else new.revision := 1; new.schedule_revision := 1; end if;
  new.updated_at := now(); return new;
end;
$$;
create trigger team_card_validate before insert or update on public.team_cards for each row execute function public.team_validate_card();
create function public.team_card_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.team_activity(workspace_id,card_id,actor_id,detail) values(new.workspace_id,new.id,auth.uid(),
    case when tg_op = 'INSERT' then 'Создана карточка: ' when new.archived and not old.archived then 'Архивирована карточка: '
      when new.completed and not old.completed then 'Завершена карточка: ' when not new.completed and old.completed then 'Возобновлена карточка: '
      when new.list_id <> old.list_id then 'Перемещена карточка: ' else 'Обновлена карточка: ' end || new.title);
  if tg_op = 'UPDATE' then
    if (new.due_at,new.reminder_minutes,new.assignees,new.completed,new.archived) is not distinct from (old.due_at,old.reminder_minutes,old.assignees,old.completed,old.archived) then return new; end if;
    update public.team_notifications set state = 'cancelled',error_code='schedule_changed' where card_id = new.id and reason = 'reminder' and state in ('pending','sending');
  end if;
  if new.due_at is not null and new.reminder_minutes is not null and not new.completed and not new.archived then
    insert into public.team_notifications(card_id,recipient_id,channel,reason,scheduled_at,dedupe_key)
    select new.id,m.user_id,ch,'reminder',new.due_at - make_interval(mins => new.reminder_minutes),new.id::text || ':' || new.schedule_revision || ':' || m.user_id || ':' || ch
    from public.team_members m cross join unnest(array['discord','email']) ch where m.workspace_id = new.workspace_id and m.user_id = any(new.assignees)
    on conflict(dedupe_key) do update set state='pending',error_code=null
      where team_notifications.state='cancelled' and team_notifications.error_code in ('schedule_changed','recipient_unavailable');
  end if;
  return new;
end;
$$;
create trigger team_card_audit after insert or update on public.team_cards for each row execute function public.team_card_changed();
create function public.team_comment_added() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.team_activity(workspace_id,card_id,actor_id,detail) select workspace_id,id,new.author_id,'Добавлен комментарий: ' || title from public.team_cards where id = new.card_id;
  return new;
end;
$$;
create trigger team_comment_audit after insert on public.team_comments for each row execute function public.team_comment_added();
create function public.team_queue_message(p_card uuid, p_message text) returns integer
language plpgsql security definer set search_path = public as $$
declare v_card public.team_cards; v_count integer; v_batch uuid := gen_random_uuid();
begin
  select * into v_card from public.team_cards where id = p_card for update;
  if not found or not public.team_access(v_card.workspace_id,'write') then raise exception 'Нет доступа'; end if;
  if v_card.archived then raise exception 'Карточка в архиве'; end if;
  if length(trim(p_message)) not between 1 and 1500 then raise exception 'Сообщение: от 1 до 1500 символов'; end if;
  if exists (select 1 from public.team_notifications where card_id = p_card and reason = 'message' and created_at > now() - interval '1 minute') then raise exception 'Повторная рассылка доступна через минуту'; end if;
  insert into public.team_notifications(card_id,recipient_id,channel,reason,message,scheduled_at,dedupe_key)
    select p_card,m.user_id,ch,'message',trim(p_message),now(),v_batch || ':' || m.user_id || ':' || ch
    from public.team_members m cross join unnest(array['discord','email']) ch where m.workspace_id = v_card.workspace_id and m.user_id = any(v_card.assignees)
      and ((ch = 'discord' and m.notify_discord) or (ch = 'email' and m.notify_email));
  get diagnostics v_count = row_count;
  if v_count > 0 then insert into public.team_activity(workspace_id,card_id,actor_id,detail) values(v_card.workspace_id,p_card,auth.uid(),'Сообщение поставлено в очередь исполнителям карточки'); end if;
  return v_count;
end;
$$;
-- Только worker; lease защищает от одновременного получения одной записи.
create function public.team_claim_notifications()
returns table(id uuid, lease_id uuid, channel text, discord_id text, email text, title text, message text, card_id uuid, workspace_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  update public.team_notifications n set state = 'failed',error_code = 'worker_timeout' where n.state = 'sending' and n.leased_at < now() - interval '5 minutes' and n.attempts >= 5;
  update public.team_notifications n set state = 'cancelled',error_code = 'recipient_unavailable'
  where n.state in ('pending','sending') and not exists (
    select 1 from public.team_cards c join public.team_members m on m.workspace_id = c.workspace_id and m.user_id = n.recipient_id
    where c.id = n.card_id and not c.archived and m.user_id = any(c.assignees) and (n.reason <> 'reminder' or not c.completed)
      and ((n.channel = 'discord' and m.notify_discord) or (n.channel = 'email' and m.notify_email))
  );
  return query with picked as (
    select n.id from public.team_notifications n where (n.state = 'pending' or (n.state = 'sending' and n.leased_at < now() - interval '5 minutes')) and n.scheduled_at <= now() and n.attempts < 5
    order by n.scheduled_at limit 5 for update skip locked
  ), claimed as (
    update public.team_notifications n set state = 'sending',lease_id = gen_random_uuid(),leased_at = now(),attempts = n.attempts + 1 from picked where n.id = picked.id returning n.*
  ) select n.id,n.lease_id,n.channel,coalesce(i.identity_data->>'provider_id',i.identity_data->>'sub'),case when u.email_confirmed_at is not null then u.email else null end,
      c.title,case when n.reason = 'reminder' then 'Напоминание о сроке: ' || to_char(c.due_at at time zone 'UTC','YYYY-MM-DD HH24:MI') || ' UTC' else n.message end,c.id,c.workspace_id
    from claimed n join public.team_cards c on c.id = n.card_id join auth.users u on u.id = n.recipient_id
    left join auth.identities i on i.user_id=u.id and i.provider='discord';
end;
$$;
create function public.team_finish_notification(p_id uuid, p_lease uuid, p_error text default null) returns void
language sql security definer set search_path = public as $$
  update public.team_notifications set state = case when p_error is null then 'sent' when attempts >= 5 then 'failed' else 'pending' end,
    error_code = left(p_error,80),scheduled_at = case when p_error is not null then now() + interval '5 minutes' else scheduled_at end
  where id = p_id and lease_id = p_lease and state = 'sending';
$$;
revoke all on function public.team_create_workspace(text,text), public.team_set_member(uuid,text,text), public.team_directory(uuid), public.team_notification_preferences(uuid,boolean,boolean), public.team_queue_message(uuid,text) from public;
grant execute on function public.team_create_workspace(text,text), public.team_set_member(uuid,text,text), public.team_directory(uuid), public.team_notification_preferences(uuid,boolean,boolean), public.team_queue_message(uuid,text) to authenticated;
revoke all on function public.team_claim_notifications(), public.team_finish_notification(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.team_claim_notifications(), public.team_finish_notification(uuid,uuid,text) to service_role;
revoke all on function public.team_validate_card(), public.team_card_changed(), public.team_comment_added() from public;
commit;
