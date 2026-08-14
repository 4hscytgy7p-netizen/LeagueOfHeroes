// src/utils/supabase.ts
// Клиентский и серверный инстансы Supabase
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const CLIENT_URL = import.meta.env.PUBLIC_SUPABASE_URL as string;
const CLIENT_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;

if (!CLIENT_URL || !CLIENT_ANON_KEY) {
  // Не выбрасываем — это облегчает сборку во время разработки, но логируем проблему
  console.warn('PUBLIC_SUPABASE_URL или PUBLIC_SUPABASE_ANON_KEY не установлены.');
}

export const supabase = createClient(CLIENT_URL ?? '', CLIENT_ANON_KEY ?? '');

/**
 * Создаёт серверный Supabase-клиент, использующий Service Role Key.
 * На сервере ожидается наличие переменных окружения `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`.
 */
export function createServerSupabase(serviceRoleKey?: string): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? CLIENT_URL;
  const key = serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for server client');
  }
  return createClient(url, key as string);
}

export default supabase;
