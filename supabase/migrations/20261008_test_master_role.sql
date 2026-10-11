-- Добавляет роль тестового мастера, сохраняя роли и данные пользователей.
-- Назначение ролей по-прежнему доступно только администратору.
begin;
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('player', 'test_master', 'master', 'admin'));
commit;
