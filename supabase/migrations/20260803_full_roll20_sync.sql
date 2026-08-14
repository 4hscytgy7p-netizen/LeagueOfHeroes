-- Миграция 2026-08-03: полное сохранение VTTES JSON из Roll20 в Лигу.
--
-- Выполняйте только в уже работающей базе, где schema.sql запускалась раньше.
-- В актуальную schema.sql эта функция уже включена, поэтому для новой базы
-- данный файл запускать не нужно. Миграцию безопасно выполнить повторно:
-- функция будет заменена через create or replace.

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

revoke all on function public.extension_save_roll20_character(text, uuid, integer, jsonb) from public;
grant execute on function public.extension_save_roll20_character(text, uuid, integer, jsonb) to anon, authenticated;
