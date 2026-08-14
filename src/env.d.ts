/// <reference path="../.astro/types.d.ts" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __LOH_TEST_ACCOUNT_CONFIG__?: {
    supabaseUrl?: string;
    supabaseAnonKey?: string;
  };
  speciesVariants?: Record<string, import('./types/species').SpeciesVariant>;
  ItemTooltip?: {
    new (): {
      init(element: HTMLElement, items?: unknown[]): void;
    };
  };
}
