# Supabase: какие SQL-файлы выполнять

SQL-файлы остаются в репозитории как исходный код базы. Их не нужно загружать в Storage: содержимое выполняется в **Supabase → SQL Editor**.

## Новая пустая база

Выполните по порядку:

1. `schema.sql` — один раз и целиком.
2. Войдите на сайт через Discord, чтобы появилась строка в `public.user_profiles`.
3. При необходимости выполните `admin-role.example.sql`, предварительно заменив Discord ID.
4. Выполните `verify-installation.sql` — он ничего не изменяет, а только проверяет установку.

Миграции из папки `migrations/` после актуальной `schema.sql` запускать не нужно: они уже включены в основную схему.

## Уже работающая база

Не запускайте `schema.sql` заново. Выполняйте только ещё не применённые файлы из `migrations/` в порядке даты в имени:

1. `migrations/20260803_full_roll20_sync.sql`
2. `migrations/20260803_02_fix_pgcrypto_search_path.sql`
3. `migrations/20260803_03_roll20_tools_and_journal.sql`
4. `verify-installation.sql`

Миграции от 2026-08-03 безопасно выполнять повторно. Вторая исправляет поиск
`pgcrypto.digest()` в схеме `extensions`.

## Что сейчас обязательно для сайта и расширения

- `public.user_profiles` — аккаунты, роли и число слотов персонажей;
- `public.characters` — черновик, JSON Roll20 и игровое состояние;
- `public.character_sync_tokens` — отзывные ключи синхронизации;
- `public.journal_entries` — журнал, квесты, локации и связанные handout;
- `public.extension_list_characters(...)` — список персонажей;
- `public.extension_get_character(...)` — загрузка персонажа в Roll20;
- `public.extension_update_character(...)` — ограниченное обновление игровых значений;
- `public.extension_save_roll20_character(...)` — полное сохранение открытого чарника Roll20 в Лигу.
- `public.extension_list_journal(...)`, `extension_save_journal(...)`, `extension_delete_journal(...)` — журнал Лиги и обмен с handout Roll20.

## Что не нужно выполнять повторно

- старые копии `schema.sql`;
- одинаковые схемы из нескольких вкладок SQL Editor;
- `admin-role.example.sql` после того, как администратор уже назначен;
- миграции, уже включённые в `schema.sql`, при создании новой базы.

Открытые вкладки `Untitled query` в SQL Editor не создают отдельные базы. Значение имеет только SQL, который вы действительно запустили кнопкой **Run**.

Никогда не вставляйте `service_role` в сайт, расширение или SQL-файлы репозитория. Клиенту нужен только публичный `anon/publishable` key.
