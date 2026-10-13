import {
  testAccountSupabase as client,
  isLocalAuthBypassEnabled,
  localAccountPreviewProfile,
  type AccountRole,
} from "../../utils/testAccount";
import {
  escapeTeamText as esc,
  filterTeamCards,
  cardOnDay,
  localDateKey,
  toLocalDateInput,
  validateTeamCard,
  notificationErrorLabel,
  type TeamWorkspace,
  type TeamMember,
  type TeamList,
  type TeamCard,
  type CheckItem,
} from "../../utils/teamWorkspace";

interface Comment {
  id: string;
  card_id: string;
  author_id: string;
  body: string;
  created_at: string;
}
interface Activity {
  workspace_id: string;
  card_id: string | null;
  actor_id: string;
  detail: string;
  created_at: string;
}
interface LocalData {
  workspaces: TeamWorkspace[];
  members: (TeamMember & { workspace_id: string })[];
  lists: TeamList[];
  cards: TeamCard[];
  comments: Comment[];
  activity: Activity[];
}
const roleLabels = {
  manager: "Руководитель",
  editor: "Редактор",
  observer: "Наблюдатель",
};

export async function initializeTeamWorkspace(
  userId: string,
  accountRole: AccountRole,
) {
  const root = document.querySelector<HTMLElement>("#team-workspace");
  const local =
    isLocalAuthBypassEnabled && userId === localAccountPreviewProfile.id;
  if (!root || root.dataset.initialized || (!client && !local)) return;
  root.dataset.initialized = "true";
  root.hidden = false;
  function el<T extends HTMLElement = HTMLElement>(id: string): T {
    return root!.querySelector<T>(`#${id}`)!;
  }
  const localKey = `loh-team-preview:${userId}`;
  let store: LocalData = {
    workspaces: [],
    members: [],
    lists: [],
    cards: [],
    comments: [],
    activity: [],
  };
  let workspaces: TeamWorkspace[] = [],
    members: TeamMember[] = [],
    lists: TeamList[] = [],
    cards: TeamCard[] = [];
  let workspaceId = "",
    view = "board",
    selected: TeamCard | null = null,
    checklist: CheckItem[] = [],
    busy = false,
    loading = false;
  let month = new Date();
  month.setDate(1);
  const dialog = el<HTMLDialogElement>("tw-card-dialog");
  const form = el<HTMLFormElement>("tw-card-form");
  const createDialog = el<HTMLDialogElement>("tw-create-dialog");
  const input = (name: string) =>
    form.elements.namedItem(name) as
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  function message(text: string, error = false) {
    const target = el("tw-status");
    target.hidden = !text;
    target.textContent = text;
    target.dataset.error = String(error);
  }
  function showError(target: string, error: unknown) {
    el(target).textContent =
      error instanceof Error
        ? error.message
        : String((error as { message?: string })?.message || error);
    el(target).hidden = false;
  }
  function check(result: { error?: unknown }) {
    if (result.error) throw result.error;
  }
  function persist() {
    window.localStorage.setItem(localKey, JSON.stringify(store));
  }
  function audit(detail: string, cardId: string | null = null) {
    store.activity.unshift({
      workspace_id: workspaceId,
      actor_id: userId,
      card_id: cardId,
      detail,
      created_at: new Date().toISOString(),
    });
  }
  function canManage() {
    return (
      accountRole === "admin" ||
      members.some((m) => m.user_id === userId && m.role === "manager")
    );
  }
  function canWrite() {
    return (
      canManage() ||
      members.some((m) => m.user_id === userId && m.role === "editor")
    );
  }
  function name(id: string) {
    return (
      members.find((m) => m.user_id === id)?.display_name || "Бывший участник"
    );
  }
  function date(value: string) {
    return new Date(value).toLocaleString("ru-RU", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }
  el("tw-storage").textContent = local
    ? "Локальный просмотр: данные сохраняются в этом браузере. Настоящие участники и отправка уведомлений доступны после входа на сайте."
    : "Общее пространство команды. Данные хранятся в облаке; доступ проверяется сервером. Обновите доску, чтобы увидеть последние изменения коллег.";
  el("tw-create").hidden = accountRole !== "admin";
  if (local) {
    try {
      const saved = JSON.parse(window.localStorage.getItem(localKey) || "null");
      if (saved) {
        for (const k of Object.keys(store))
          if (!Array.isArray(saved[k]))
            throw new Error("Неверные данные локального просмотра");
        store = saved;
      }
    } catch (error) {
      message(
        "Не удалось прочитать локальные данные. Перезагрузите страницу или освободите хранилище браузера.",
        true,
      );
      return;
    }
  }
  function cardHtml(card: TeamCard) {
    const overdue =
      !card.completed && card.due_at && Date.parse(card.due_at) < Date.now();
    return `<button type="button" class="tw-card ${card.completed ? "is-completed" : ""}" data-card="${esc(card.id)}" draggable="${canWrite() && !card.archived}">${card.labels.map((l) => `<span class="tw-tag">${esc(l)}</span>`).join("")}<strong>${card.kind === "event" ? "◷ " : card.completed ? "✓ " : ""}${esc(card.title)}</strong>${card.due_at ? `<small class="${overdue ? "tw-overdue" : ""}">${overdue ? "Просрочено · " : ""}${esc(date(card.due_at))}</small>` : ""}${card.assignees.length ? `<small>${card.assignees.map((id) => esc(name(id))).join(", ")}</small>` : ""}${card.checklist.length ? `<small>☑ ${card.checklist.filter((i) => i.done).length}/${card.checklist.length}</small>` : ""}</button>`;
  }
  function render() {
    const exists = Boolean(workspaceId);
    el("tw-empty").hidden = exists;
    el("tw-content").hidden = !exists;
    if (!exists) return;
    el("tw-description").textContent =
      workspaces.find((w) => w.id === workspaceId)?.description || "";
    for (const id of ["board", "calendar", "members", "activity"])
      el(`tw-${id}`).hidden = view !== id;
    root!
      .querySelectorAll<HTMLButtonElement>("[data-tw-view]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.twView === view)),
      );
    el("tw-filters").hidden = view !== "board" && view !== "calendar";
    el("tw-add-card").hidden = !canWrite();
    el("tw-add-list").hidden = !canWrite() || view !== "board";
    const filtered = filterTeamCards(
      cards,
      el<HTMLInputElement>("tw-search").value,
      el<HTMLSelectElement>("tw-assignee").value,
      el<HTMLSelectElement>("tw-filter").value,
    );
    el("tw-board").innerHTML = lists
      .map(
        (l) =>
          `<div class="tw-column" data-list="${esc(l.id)}"><h3><span>${esc(l.title)} <small>${filtered.filter((c) => c.list_id === l.id).length}</small></span>${canWrite() ? `<button type="button" data-rename-list="${esc(l.id)}" aria-label="Переименовать список ${esc(l.title)}">✎</button>` : ""}</h3>${filtered
            .filter((c) => c.list_id === l.id)
            .map(cardHtml)
            .join(
              "",
            )}${canWrite() ? `<button type="button" data-add-to="${esc(l.id)}">＋ Карточка</button>` : ""}</div>`,
      )
      .join("");
    el("tw-month").textContent = month.toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric",
    });
    const start = new Date(month);
    start.setDate(1 - ((start.getDay() + 6) % 7));
    let html = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
      .map((d) => `<div class="tw-weekday">${d}</div>`)
      .join("");
    for (let i = 0; i < 42; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      html += `<div class="tw-day ${day.getMonth() !== month.getMonth() ? "is-outside" : ""} ${localDateKey(day) === localDateKey(new Date()) ? "is-today" : ""}"><time datetime="${localDateKey(day)}">${day.getDate()}</time>${filtered
        .filter((c) => cardOnDay(c, day))
        .map(cardHtml)
        .join("")}</div>`;
    }
    el("tw-calendar-grid").innerHTML = html;
    el("tw-unscheduled").innerHTML =
      filtered
        .filter((c) => !c.due_at && !c.starts_at)
        .map(cardHtml)
        .join("") || '<p class="tw-muted">Все карточки имеют дату.</p>';
    renderMembers();
  }
  function renderMembers() {
    el("tw-member-form").hidden = !canManage();
    el("tw-member-list").innerHTML = members
      .map(
        (m) =>
          `<div class="tw-member"><div><strong>${esc(m.display_name)}</strong><small> · ${roleLabels[m.role]}</small><div class="tw-muted">Discord ID: ${esc(m.discord_id || "локальный профиль")} · Уведомления: ${[m.notify_discord ? "Discord" : "", m.notify_email ? "email" : ""].filter(Boolean).join(", ") || "выключены"}</div></div>${
            canManage() && m.user_id !== userId
              ? `<div class="tw-actions"><select data-member-role="${esc(m.discord_id)}" aria-label="Права ${esc(m.display_name)}">${Object.entries(
                  roleLabels,
                )
                  .map(
                    ([value, label]) =>
                      `<option value="${value}" ${m.role === value ? "selected" : ""}>${label}</option>`,
                  )
                  .join(
                    "",
                  )}</select><button type="button" data-remove-member="${esc(m.discord_id)}">Убрать доступ</button></div>`
              : ""
          }</div>`,
      )
      .join("");
    const own = members.find((m) => m.user_id === userId);
    const preferences = el<HTMLFormElement>("tw-preferences");
    preferences.hidden = !own;
    if (own) {
      (preferences.elements.namedItem("discord") as HTMLInputElement).checked =
        own.notify_discord;
      (preferences.elements.namedItem("email") as HTMLInputElement).checked =
        own.notify_email;
    }
  }
  async function loadWorkspace() {
    if (!workspaceId) {
      members = [];
      lists = [];
      cards = [];
      render();
      return;
    }
    if (local) {
      members = store.members.filter((m) => m.workspace_id === workspaceId);
      lists = store.lists.filter((l) => l.workspace_id === workspaceId);
      cards = store.cards.filter((c) => c.workspace_id === workspaceId);
    } else {
      const results = await Promise.all([
        client!.rpc("team_directory", { p_workspace: workspaceId }),
        client!
          .from("team_lists")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("position"),
        client!
          .from("team_cards")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("position"),
      ]);
      results.forEach(check);
      members = results[0].data || [];
      lists = results[1].data || [];
      cards = results[2].data || [];
    }
    lists.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    cards.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    const assignee = el<HTMLSelectElement>("tw-assignee"),
      previous = assignee.value;
    assignee.innerHTML =
      '<option value="">Все участники</option>' +
      members
        .map(
          (m) =>
            `<option value="${esc(m.user_id)}">${esc(m.display_name)}${m.user_id === userId ? " (я)" : ""}</option>`,
        )
        .join("");
    assignee.value = previous;
    render();
    let activity: Activity[];
    if (local)
      activity = store.activity
        .filter((a) => a.workspace_id === workspaceId)
        .slice(0, 100);
    else {
      const result = await client!
        .from("team_activity")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(100);
      check(result);
      activity = result.data || [];
    }
    el("tw-activity-list").innerHTML =
      activity
        .map(
          (a) =>
            `<div class="tw-log"><time>${esc(date(a.created_at))}</time> · ${esc(name(a.actor_id))}<p>${esc(a.detail)}</p>${a.card_id ? `<button type="button" data-card="${esc(a.card_id)}">Открыть карточку</button>` : ""}</div>`,
        )
        .join("") || '<p class="tw-muted">Изменений пока нет.</p>';
  }
  async function refresh() {
    if (loading || busy || dialog.open) return;
    loading = true;
    root!.setAttribute("aria-busy", "true");
    try {
      if (local) workspaces = store.workspaces;
      else {
        const result = await client!
          .from("team_workspaces")
          .select("*")
          .order("created_at");
        check(result);
        workspaces = result.data || [];
      }
      const requested = new URL(window.location.href).searchParams.get(
        "workspace",
      );
      workspaceId =
        workspaces.find((w) => w.id === workspaceId)?.id ||
        workspaces.find((w) => w.id === requested)?.id ||
        workspaces[0]?.id ||
        "";
      el<HTMLSelectElement>("tw-workspace").innerHTML = workspaces
        .map((w) => `<option value="${esc(w.id)}">${esc(w.title)}</option>`)
        .join("");
      el<HTMLSelectElement>("tw-workspace").value = workspaceId;
      await loadWorkspace();
      message("");
    } catch (error) {
      message(
        "Не удалось загрузить рабочие пространства. " +
          String((error as Error).message || error) +
          " Проверьте подключение и применение миграции 20261012_team_workspaces.sql.",
        true,
      );
    } finally {
      loading = false;
      root!.setAttribute("aria-busy", "false");
    }
  }
  function renderChecklist() {
    el("tw-checklist").innerHTML = checklist
      .map(
        (item, i) =>
          `<div class="tw-check-row"><label class="tw-check"><input type="checkbox" data-check="${i}" ${item.done ? "checked" : ""} ${!canWrite() ? "disabled" : ""} />${esc(item.text)}</label>${canWrite() ? `<button type="button" data-remove-check="${i}" aria-label="Удалить пункт">✕</button>` : ""}</div>`,
      )
      .join("");
  }
  async function openCard(card: TeamCard | null, listId = lists[0]?.id) {
    if (busy || loading || !workspaceId || !listId) return;
    selected = card ? structuredClone(card) : null;
    checklist = structuredClone(card?.checklist || []);
    form.reset();
    el("tw-card-error").hidden = true;
    el("tw-card-notice").hidden = true;
    el("tw-card-heading").textContent = card
      ? card.kind === "event"
        ? "Встреча"
        : "Задача"
      : "Новая карточка";
    input("list_id").innerHTML = lists
      .map((l) => `<option value="${esc(l.id)}">${esc(l.title)}</option>`)
      .join("");
    for (const key of ["title", "description", "kind", "list_id"])
      input(key).value =
        card?.[key] ||
        (key === "list_id" ? listId : key === "kind" ? "task" : "");
    input("starts_at").value = toLocalDateInput(card?.starts_at || null);
    input("due_at").value = toLocalDateInput(card?.due_at || null);
    input("reminder_minutes").value =
      card?.reminder_minutes == null ? "" : String(card.reminder_minutes);
    input("labels").value = card?.labels.join(", ") || "";
    (input("completed") as HTMLInputElement).checked = card?.completed || false;
    (input("archived") as HTMLInputElement).checked = card?.archived || false;
    el("tw-card-assignees").innerHTML = members
      .map(
        (m) =>
          `<label class="tw-check"><input type="checkbox" name="assignee" value="${esc(m.user_id)}" ${card?.assignees.includes(m.user_id) ? "checked" : ""} />${esc(m.display_name)}</label>`,
      )
      .join("");
    el<HTMLFieldSetElement>("tw-card-fields").disabled = !canWrite();
    el("tw-save-card").hidden = !canWrite();
    el("tw-copy-card").hidden = !card;
    el("tw-card-discussion").hidden = !card;
    el("tw-comment-form").hidden = !canWrite();
    el("tw-message-form").hidden =
      !canWrite() || local || Boolean(card?.archived);
    renderChecklist();
    dialog.showModal();
    if (card) await loadDiscussion(card.id);
  }
  async function loadDiscussion(cardId: string) {
    try {
      let comments: Comment[];
      if (local) comments = store.comments.filter((c) => c.card_id === cardId);
      else {
        const result = await client!
          .from("team_comments")
          .select("*")
          .eq("card_id", cardId)
          .order("created_at");
        check(result);
        comments = result.data || [];
      }
      if (selected?.id !== cardId) return;
      el("tw-comments").innerHTML =
        comments
          .map(
            (c) =>
              `<div class="tw-comment"><strong>${esc(name(c.author_id))}</strong> <small>${esc(date(c.created_at))}</small><p>${esc(c.body)}</p></div>`,
          )
          .join("") || '<p class="tw-muted">Начните обсуждение.</p>';
      el("tw-deliveries").textContent = "";
      if (!local) {
        const result = await client!
          .from("team_notifications")
          .select("state,channel,error_code,recipient_id")
          .eq("card_id", cardId)
          .order("created_at", { ascending: false })
          .limit(50);
        check(result);
        const states = {
          pending: "В очереди",
          sending: "Отправляется",
          sent: "Отправлено",
          failed: "Ошибка",
          cancelled: "Отменено",
        };
        el("tw-deliveries").innerHTML =
          "<h4>Последние уведомления</h4>" +
          ((result.data || [])
            .map(
              (n) =>
                `<p>${esc(name(n.recipient_id))} · ${n.channel === "discord" ? "Discord" : "Email"}: ${esc(states[n.state] || n.state)}${n.error_code ? ` — ${esc(notificationErrorLabel(n.error_code))}` : ""}</p>`,
            )
            .join("") || "<p>Пока нет уведомлений.</p>");
      }
    } catch (error) {
      showError("tw-card-error", error);
    }
  }
  async function updateCard(card: TeamCard, changes: Partial<TeamCard>) {
    if (local) {
      const actual = store.cards.find((c) => c.id === card.id);
      if (!actual || actual.revision !== card.revision)
        throw new Error("Карточку изменили. Закройте её и обновите доску.");
      Object.assign(actual, changes, {
        revision: actual.revision + 1,
        updated_at: new Date().toISOString(),
      });
      audit(`Обновлена карточка: ${actual.title}`, actual.id);
      persist();
      return structuredClone(actual);
    }
    const result = await client!
      .from("team_cards")
      .update(changes)
      .eq("id", card.id)
      .eq("revision", card.revision)
      .select()
      .maybeSingle();
    check(result);
    if (!result.data)
      throw new Error(
        "Карточку изменили или доступ отозван. Скопируйте свой текст, закройте карточку и обновите доску.",
      );
    return result.data as TeamCard;
  }
  async function action(task: () => Promise<void>, target = "tw-status") {
    if (busy) return;
    busy = true;
    root!
      .querySelectorAll<HTMLButtonElement>("button[type=submit]")
      .forEach((b) => (b.disabled = true));
    try {
      await task();
    } catch (error) {
      showError(target, error);
    } finally {
      busy = false;
      root!
        .querySelectorAll<HTMLButtonElement>("button[type=submit]")
        .forEach((b) => (b.disabled = false));
    }
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void action(async () => {
      if (!canWrite()) throw new Error("Только чтение");
      const changes = {
        title: input("title").value.trim(),
        description: input("description").value,
        kind: input("kind").value as "task" | "event",
        list_id: input("list_id").value,
        starts_at: input("starts_at").value
          ? new Date(input("starts_at").value).toISOString()
          : null,
        due_at: input("due_at").value
          ? new Date(input("due_at").value).toISOString()
          : null,
        reminder_minutes:
          input("reminder_minutes").value === ""
            ? null
            : Number(input("reminder_minutes").value),
        labels: [
          ...new Set(
            input("labels")
              .value.split(",")
              .map((l) => l.trim())
              .filter(Boolean),
          ),
        ],
        checklist: structuredClone(checklist),
        assignees: Array.from(
          form.querySelectorAll<HTMLInputElement>("[name=assignee]:checked"),
        ).map((i) => i.value),
        completed: (input("completed") as HTMLInputElement).checked,
        archived: (input("archived") as HTMLInputElement).checked,
      };
      validateTeamCard(changes);
      if (selected) await updateCard(selected, changes);
      else {
        const card: TeamCard = {
          id: crypto.randomUUID(),
          workspace_id: workspaceId,
          created_by: userId,
          position: cards.length,
          revision: 1,
          updated_at: new Date().toISOString(),
          ...changes,
        };
        if (local) {
          store.cards.push(card);
          audit(`Создана карточка: ${card.title}`, card.id);
          persist();
        } else check(await client!.from("team_cards").insert(card));
      }
      dialog.close();
      await loadWorkspace();
      message("Карточка сохранена.");
    }, "tw-card-error");
  });
  el("tw-add-check").addEventListener("click", () => {
    const field = el<HTMLInputElement>("tw-check-item");
    if (!field.value.trim() || !canWrite()) return;
    if (checklist.length >= 100) {
      showError("tw-card-error", new Error("Не более 100 пунктов."));
      return;
    }
    checklist.push({ text: field.value.trim(), done: false });
    field.value = "";
    renderChecklist();
  });
  el("tw-checklist").addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement;
    if (target.dataset.check !== undefined && canWrite())
      checklist[Number(target.dataset.check)].done = target.checked;
  });
  el("tw-checklist").addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-remove-check]",
    );
    if (target && canWrite()) {
      checklist.splice(Number(target.dataset.removeCheck), 1);
      renderChecklist();
    }
  });
  el("tw-close-card").addEventListener("click", () => dialog.close());
  el("tw-copy-card").addEventListener(
    "click",
    () =>
      void action(async () => {
        const url = new URL(window.location.href);
        url.searchParams.set("workspace", workspaceId);
        url.searchParams.set("card", selected!.id);
        await navigator.clipboard.writeText(url.href);
        el("tw-card-notice").hidden = false;
        el("tw-card-notice").textContent = "Ссылка скопирована.";
      }, "tw-card-error"),
  );
  el("tw-comment-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void action(async () => {
      if (!selected || !canWrite()) return;
      const commentForm = el<HTMLFormElement>("tw-comment-form"),
        field = commentForm.elements.namedItem("body") as HTMLTextAreaElement;
      const body = field.value.trim();
      if (!body) return;
      const comment = {
        id: crypto.randomUUID(),
        card_id: selected.id,
        author_id: userId,
        body,
        created_at: new Date().toISOString(),
      };
      if (local) {
        store.comments.push(comment);
        audit("Добавлен комментарий", selected.id);
        persist();
      } else check(await client!.from("team_comments").insert(comment));
      field.value = "";
      await loadDiscussion(selected.id);
    }, "tw-card-error");
  });
  el("tw-message-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void action(async () => {
      if (!selected || !client || local || !canWrite()) return;
      const field = (event.target as HTMLFormElement).elements.namedItem(
        "message",
      ) as HTMLTextAreaElement;
      const result = await client.rpc("team_queue_message", {
        p_card: selected.id,
        p_message: field.value,
      });
      check(result);
      el("tw-card-error").hidden = true;
      el("tw-card-notice").hidden = false;
      el("tw-card-notice").textContent = result.data
        ? `В очередь добавлено уведомлений: ${result.data}. Это ещё не подтверждение доставки.`
        : "Нет получателей: назначьте участников карточки и попросите их включить уведомления.";
      if (result.data) field.value = "";
      await loadDiscussion(selected.id);
    }, "tw-card-error");
  });
  el("tw-refresh").addEventListener("click", () => void refresh());
  el("tw-workspace").addEventListener(
    "change",
    (event) =>
      void action(async () => {
        workspaceId = (event.target as HTMLSelectElement).value;
        await loadWorkspace();
      }),
  );
  for (const id of ["tw-search", "tw-assignee", "tw-filter"])
    el(id).addEventListener(id === "tw-search" ? "input" : "change", render);
  root.querySelectorAll<HTMLElement>("[data-tw-view]").forEach((b) =>
    b.addEventListener("click", () => {
      view = b.dataset.twView!;
      render();
    }),
  );
  el("tw-add-card").addEventListener("click", () => void openCard(null));
  for (const [id, offset] of [
    ["tw-month-prev", -1],
    ["tw-month-next", 1],
    ["tw-month-today", 0],
  ] as const)
    el(id).addEventListener("click", () => {
      if (offset) month.setMonth(month.getMonth() + offset);
      else {
        month = new Date();
        month.setDate(1);
      }
      render();
    });
  async function addList() {
    if (!canWrite()) return;
    const title = window.prompt("Название списка (до 120 символов)")?.trim();
    if (!title) return;
    if (title.length > 120) throw new Error("Название списка слишком длинное");
    const list = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      title,
      position: lists.length,
    };
    if (local) {
      store.lists.push(list);
      persist();
    } else check(await client!.from("team_lists").insert(list));
    await loadWorkspace();
  }
  el("tw-add-list").addEventListener("click", () => void action(addList));
  root.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-card],[data-add-to],[data-rename-list],[data-remove-member]",
    );
    if (!target) return;
    if (target.dataset.card) {
      const card = cards.find((c) => c.id === target.dataset.card);
      if (card) void openCard(card);
    }
    if (target.dataset.addTo) void openCard(null, target.dataset.addTo);
    if (target.dataset.renameList)
      void action(async () => {
        if (!canWrite()) return;
        const list = lists.find((l) => l.id === target.dataset.renameList)!;
        const title = window.prompt("Название списка", list.title)?.trim();
        if (!title) return;
        if (title.length > 120) throw new Error("До 120 символов");
        if (local) {
          list.title = title;
          persist();
        } else
          check(
            await client!
              .from("team_lists")
              .update({ title })
              .eq("id", list.id),
          );
        await loadWorkspace();
      });
    if (
      target.dataset.removeMember &&
      window.confirm("Убрать доступ участника к этому пространству?")
    )
      void action(() => setMember(target.dataset.removeMember!, null));
  });
  root.addEventListener("dragstart", (event) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-card]",
    );
    if (card && canWrite())
      event.dataTransfer?.setData("text/plain", card.dataset.card!);
  });
  el("tw-board").addEventListener("dragover", (event) => {
    if (canWrite()) event.preventDefault();
  });
  el("tw-board").addEventListener("drop", (event) => {
    event.preventDefault();
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-list]",
    );
    const card = cards.find(
      (c) => c.id === event.dataTransfer?.getData("text/plain"),
    );
    if (
      target &&
      card &&
      canWrite() &&
      !card.archived &&
      target.dataset.list !== card.list_id
    )
      void action(async () => {
        await updateCard(card, {
          list_id: target.dataset.list,
          position: cards.length,
        });
        await loadWorkspace();
      });
  });
  async function setMember(discord: string, role: string | null) {
    if (!canManage()) return;
    if (local)
      throw new Error(
        "Назначение настоящих пользователей доступно после Discord-входа на сайте.",
      );
    check(
      await client!.rpc("team_set_member", {
        p_workspace: workspaceId,
        p_discord_id: discord,
        p_role: role,
      }),
    );
    await loadWorkspace();
    message("Доступ обновлён.");
  }
  el("tw-member-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    void action(() =>
      setMember(String(data.get("discord")), String(data.get("role"))),
    );
  });
  el("tw-member-list").addEventListener("change", (event) => {
    const target = event.target as HTMLSelectElement;
    if (target.dataset.memberRole)
      void action(() => setMember(target.dataset.memberRole!, target.value));
  });
  el("tw-preferences").addEventListener("submit", (event) => {
    event.preventDefault();
    void action(async () => {
      const data = new FormData(event.target as HTMLFormElement);
      if (local) {
        const own = store.members.find(
          (m) => m.workspace_id === workspaceId && m.user_id === userId,
        )!;
        own.notify_discord = data.has("discord");
        own.notify_email = data.has("email");
        persist();
      } else
        check(
          await client!.rpc("team_notification_preferences", {
            p_workspace: workspaceId,
            p_discord: data.has("discord"),
            p_email: data.has("email"),
          }),
        );
      await loadWorkspace();
      message("Предпочтения уведомлений сохранены.");
    });
  });
  el("tw-create").addEventListener("click", () => {
    el("tw-create-error").hidden = true;
    createDialog.showModal();
  });
  el("tw-cancel-create").addEventListener("click", () => createDialog.close());
  el("tw-create-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void action(async () => {
      if (accountRole !== "admin") return;
      const data = new FormData(event.target as HTMLFormElement),
        title = String(data.get("title")).trim(),
        description = String(data.get("description"));
      if (!title) throw new Error("Введите название");
      if (local) {
        workspaceId = crypto.randomUUID();
        store.workspaces.push({
          id: workspaceId,
          title,
          description,
          created_by: userId,
        });
        store.members.push({
          workspace_id: workspaceId,
          user_id: userId,
          display_name: localAccountPreviewProfile.display_name,
          discord_id: null,
          role: "manager",
          notify_discord: false,
          notify_email: false,
        });
        ["Входящие", "В работе", "На проверке", "Готово"].forEach(
          (title, position) =>
            store.lists.push({
              id: crypto.randomUUID(),
              workspace_id: workspaceId,
              title,
              position,
            }),
        );
        persist();
      } else {
        const result = await client!.rpc("team_create_workspace", {
          p_title: title,
          p_description: description,
        });
        check(result);
        workspaceId = result.data;
      }
      createDialog.close();
    }, "tw-create-error").then(() => refresh());
  });
  await refresh();
  const requestedCard = new URL(window.location.href).searchParams.get("card");
  const card = cards.find((c) => c.id === requestedCard);
  if (card) await openCard(card);
}
