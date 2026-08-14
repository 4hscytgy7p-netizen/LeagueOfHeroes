-- Исправляет ошибку:
--   function digest(text, unknown) does not exist
--
-- В Supabase функции pgcrypto находятся в схеме extensions. Полная функция
-- сохранения Roll20 была создана с search_path только public, поэтому не могла
-- найти digest() во время выполнения. Миграция безопасна для повторного запуска.

alter function public.extension_save_roll20_character(text, uuid, integer, jsonb)
  set search_path = public, extensions;
