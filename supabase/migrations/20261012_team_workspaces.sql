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
