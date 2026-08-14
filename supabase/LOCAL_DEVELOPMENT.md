# Local Supabase development

The production website and its Supabase project must remain connected only
through the environment variables configured by the hosting provider. Local
Astro development uses `.env.local`, which is ignored by Git.

## Prerequisites

- Docker Desktop running with Linux containers.
- Node.js 20 or newer.
- Project dependencies installed.

## First local start

1. Start the local stack:

   ```powershell
   pnpm supabase:start
   ```

2. Read the local URLs and keys:

   ```powershell
   pnpm supabase:status
   ```

3. Copy `.env.example` to `.env.local` and replace the two key placeholders
   with the local anon and service-role keys printed by `supabase:status`.

4. Recreate and verify the local database:

   ```powershell
   pnpm supabase:reset
   pnpm dev
   ```

`supabase:reset` without `--linked` affects only the Docker database. Never run
`db reset --linked` against production.

## Existing production database

The repository originally contained a complete `schema.sql` plus legacy SQL
patches that were run manually. The full schema is now mirrored as
`migrations/20260814000000_initial_schema.sql`; the old patches are preserved
under `legacy_migrations/` and are not replayed by the CLI.

Before the first production-linked workflow:

1. Authenticate with `pnpm supabase login`.
2. Link using `pnpm supabase link --project-ref <project-ref>`.
3. Compare the production schema to the baseline before applying anything.
4. If the schemas match, reconcile the baseline migration as already applied
   in production; do not execute the baseline against the live database.
5. Pull and review any remaining remote-only differences.
6. Verify a clean local rebuild with `pnpm supabase:reset`.

Do not run `db push` until the pulled baseline has been reviewed and the
production migration history has been reconciled.

## Daily workflow

```powershell
pnpm supabase migration new describe_change
pnpm supabase:reset
pnpm dev
```

After review, preview a future production deployment with:

```powershell
pnpm supabase db push --dry-run
```

Prefer deploying approved migrations through CI. Use a separate hosted
Supabase project for staging when end-to-end Discord OAuth testing is needed.

## Local Discord OAuth

Use a separate Discord application for development. Its Supabase callback is:

```text
http://127.0.0.1:54321/auth/v1/callback
```

Store the Discord client ID and secret in an ignored local env file and refer
to them from `supabase/config.toml` with `env(...)`. Never commit the secret.
