import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const accountRoles = ['player', 'test_master', 'master', 'admin'] as const;
export type AccountRole = typeof accountRoles[number];
export type AccountMode = AccountRole;
export const accountRoleLabels: Record<AccountRole, string> = {
  player: 'Игрок', test_master: 'Тестовый мастер', master: 'Мастер', admin: 'Администратор'
};

const pageConfig =
  typeof window !== 'undefined' ? window.__LOH_TEST_ACCOUNT_CONFIG__ : undefined;

const supabaseUrl =
  (import.meta.env.PUBLIC_SUPABASE_URL as string | undefined) || pageConfig?.supabaseUrl;
const supabaseAnonKey =
  (import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined) ||
  pageConfig?.supabaseAnonKey;

export const isTestAccountConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Разрешает проверять закрытые инструменты без Discord только на dev-сервере.
 * `import.meta.env.DEV` становится false в Netlify-сборке, поэтому одного
 * подменённого hostname недостаточно, чтобы включить обход в продакшене.
 */
export const isLocalAuthBypassEnabled = (() => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLocaleLowerCase('en');
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '[::1]'
    || hostname.endsWith('.webcontainer.io');
})();

// A bypassed session uses local data even if the developer configured Supabase.
export const testAccountSupabase: SupabaseClient | null = isTestAccountConfigured && !isLocalAuthBypassEnabled
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export const localAccountPreviewProfile = {
  // Keep the previous preview ID so existing local rule edits remain available.
  id: 'local-master-preview',
  display_name: 'Локальный администратор',
  role: 'admin' as const,
  character_slots: 1,
  email: null,
  discord_id: null,
  avatar_url: null,
  created_at: null
};

export const accountModeStorageKey = isLocalAuthBypassEnabled
  ? 'loh-test-account-dev-mode'
  : 'loh-test-account-mode';

export function normalizeAccountRole(value: unknown): AccountRole {
  if (value === 'admin') return 'admin';
  if (value === 'master' || value === 'gm') return 'master';
  if (value === 'test_master') return 'test_master';
  return 'player';
}

export function availableAccountModes(role: AccountRole): AccountMode[] {
  if (role === 'admin') return [...accountRoles];
  if (role === 'master') return ['player', 'test_master', 'master'];
  if (role === 'test_master') return ['player', 'test_master'];
  return ['player'];
}

export function defaultAccountMode(role: AccountRole): AccountMode {
  const saved = window.localStorage.getItem(accountModeStorageKey) as AccountMode | null;
  return saved && availableAccountModes(role).includes(saved) ? saved : role;
}

export function accountModePath(mode: AccountMode): string {
  return `/test/cabinet/${mode === 'test_master' ? 'test-master' : mode}/`;
}
