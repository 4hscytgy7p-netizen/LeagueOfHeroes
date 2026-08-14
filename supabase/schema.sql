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
update public.user_profiles set role = 'player' where role not in ('player', 'master', 'admin');
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check check (role in ('player', 'master', 'admin'));
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
