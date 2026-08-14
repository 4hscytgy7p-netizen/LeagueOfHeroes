-- Безопасная проверка установки: этот файл только читает системный каталог.
-- Все значения в единственной строке результата должны быть true.

select
  to_regclass('public.user_profiles') is not null as has_user_profiles,
  to_regclass('public.characters') is not null as has_characters,
  to_regclass('public.character_sync_tokens') is not null as has_sync_tokens,
  to_regclass('public.journal_entries') is not null as has_journal_entries,
  to_regprocedure('extensions.digest(text,text)') is not null as has_pgcrypto_digest,
  to_regprocedure('public.create_character_sync_token(text)') is not null
    as has_create_sync_token,
  to_regprocedure('public.extension_list_characters(text)') is not null
    as has_extension_list,
  to_regprocedure('public.extension_get_character(text,uuid)') is not null
    as has_extension_get,
  to_regprocedure('public.extension_update_character(text,uuid,integer,jsonb)') is not null
    as has_extension_update,
  to_regprocedure('public.extension_save_roll20_character(text,uuid,integer,jsonb)') is not null
    as has_full_roll20_save,
  to_regprocedure('public.extension_list_journal(text,uuid)') is not null
    as has_extension_list_journal,
  to_regprocedure('public.extension_save_journal(text,uuid,uuid,text,text,text,text,text)') is not null
    as has_extension_save_journal,
  to_regprocedure('public.extension_delete_journal(text,uuid)') is not null
    as has_extension_delete_journal,
  coalesce(has_function_privilege(
    'anon',
    to_regprocedure('public.extension_save_roll20_character(text,uuid,integer,jsonb)'),
    'EXECUTE'
  ), false) as anon_can_save_roll20,
  coalesce(has_function_privilege(
    'authenticated',
    to_regprocedure('public.create_character_sync_token(text)'),
    'EXECUTE'
  ), false) as user_can_create_sync_token,
  exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'extension_save_roll20_character'
      and coalesce(array_to_string(procedure.proconfig, ','), '') like '%extensions%'
  ) as roll20_save_can_find_pgcrypto;
