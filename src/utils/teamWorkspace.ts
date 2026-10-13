export interface TeamWorkspace {
  id: string;
  title: string;
  description: string;
  created_by: string;
}
export interface TeamMember {
  user_id: string;
  display_name: string;
  discord_id: string | null;
  role: "manager" | "editor" | "observer";
  notify_discord: boolean;
  notify_email: boolean;
}
export interface TeamList {
  id: string;
  workspace_id: string;
  title: string;
  position: number;
}
export interface CheckItem {
  text: string;
  done: boolean;
}
export interface TeamCard {
  id: string;
  workspace_id: string;
  list_id: string;
  title: string;
  description: string;
  kind: "task" | "event";
  assignees: string[];
  labels: string[];
  checklist: CheckItem[];
  starts_at: string | null;
  due_at: string | null;
  reminder_minutes: number | null;
  completed: boolean;
  archived: boolean;
  position: number;
  revision: number;
  created_by: string;
  updated_at: string;
}
export function escapeTeamText(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function toLocalDateInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return `${localDateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
export function cardOnDay(card: TeamCard, day: Date): boolean {
  if (!card.due_at && !card.starts_at) return false;
  const end = localDateKey(new Date(card.due_at || card.starts_at!));
  const start =
    card.kind === "event"
      ? localDateKey(new Date(card.starts_at || card.due_at!))
      : end;
  const key = localDateKey(day);
  return key >= start && key <= end;
}
export function filterTeamCards(
  cards: TeamCard[],
  query: string,
  assignee: string,
  status: string,
  now = Date.now(),
): TeamCard[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  return cards.filter(
    (c) =>
      (status === "archived" ? c.archived : !c.archived) &&
      (!needle ||
        [c.title, c.description, ...c.labels]
          .join(" ")
          .toLocaleLowerCase("ru")
          .includes(needle)) &&
      (!assignee || c.assignees.includes(assignee)) &&
      (status !== "completed" || c.completed) &&
      (status !== "active" || !c.completed) &&
      (status !== "overdue" ||
        (!c.completed &&
          Boolean(c.due_at) &&
          new Date(c.due_at!).getTime() < now)),
  );
}
export function validateTeamCard(
  card: Pick<
    TeamCard,
    | "title"
    | "labels"
    | "checklist"
    | "starts_at"
    | "due_at"
    | "reminder_minutes"
  >,
): void {
  if (!card.title.trim() || card.title.trim().length > 180)
    throw new Error("Название: от 1 до 180 символов.");
  if (card.labels.length > 10 || card.labels.some((l) => !l || l.length > 40))
    throw new Error("До 10 меток, каждая — до 40 символов.");
  if (
    card.checklist.length > 100 ||
    card.checklist.some((i) => !i.text.trim() || i.text.length > 500)
  )
    throw new Error("До 100 пунктов чек-листа, каждый — до 500 символов.");
  if (
    [card.starts_at, card.due_at].some(
      (d) => d !== null && !Number.isFinite(Date.parse(d)),
    )
  )
    throw new Error("Проверьте дату и время.");
  if (
    card.starts_at &&
    card.due_at &&
    Date.parse(card.starts_at) > Date.parse(card.due_at)
  )
    throw new Error("Окончание должно быть после начала.");
  if (card.reminder_minutes !== null && !card.due_at)
    throw new Error("Для напоминания укажите срок / окончание.");
}

export function notificationErrorLabel(code: string | null): string {
  if (!code) return "";
  const labels: Record<string, string> = {
    discord_not_configured: "Бот ещё не подключён",
    email_not_configured: "Почта ещё не подключена",
    site_url_not_configured: "Администратор ещё не настроил адрес сайта",
    verified_email_missing: "Нужен подтверждённый email аккаунта",
    discord_id_missing: "Нет Discord-входа",
    provider_discord_403:
      "Получатель должен разрешить личные сообщения от бота",
    provider_discord_429: "Discord временно ограничил отправку",
    provider_email_429: "Почтовый сервис временно ограничил отправку",
    recipient_unavailable: "Нет доступа, назначения или подписки на этот канал",
    schedule_changed: "Дата или состояние карточки изменились",
    worker_timeout: "Отправка прервалась",
  };
  return labels[code] || "Не удалось отправить сообщение";
}
