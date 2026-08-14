-- PostgREST requires table-level privileges in addition to row-level policies.
-- RLS remains the source of truth for which rows each signed-in user may access.
grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.user_profiles,
  public.invites,
  public.bookmarks,
  public.characters,
  public.character_sync_tokens,
  public.journal_entries
to authenticated;
