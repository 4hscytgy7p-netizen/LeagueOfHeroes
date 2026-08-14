-- Необязательный файл. Сначала войдите на сайт через Discord.
-- Затем замените YOUR_DISCORD_USER_ID на свой числовой Discord ID и запустите.

update public.user_profiles
set role = 'admin',
    updated_at = now()
where discord_id = 'YOUR_DISCORD_USER_ID'
returning id, display_name, email, discord_id, role;

-- Если результат пустой, профиль ещё не создан либо Discord ID указан неверно.
