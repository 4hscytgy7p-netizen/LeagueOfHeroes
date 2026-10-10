import { glossary } from "../data/glossary";
import { findGlossaryRules, glossaryExcerpt, normalizeGlossaryText } from "../utils/glossarySearch";

function element<T extends HTMLElement = HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}

const page = element("glossary-page");
const search = element<HTMLInputElement>("glossary-search");
const list = element("rules-list");
const details = element("details-area");
const welcome = details.innerHTML;
const status = element("glossary-status");
const dialog = element<HTMLDialogElement>("pin-dialog");
const categoryPanel = element<HTMLDialogElement>("category-panel");
const filterButton = element<HTMLButtonElement>("filter-button");
const checkboxes = Array.from(page.querySelectorAll<HTMLInputElement>('input[name="glossary-category"]'));
const mobile = window.matchMedia("(max-width: 767px)");
const rules = glossary.map((rule) => {
    const container = document.createElement("div");
    // Separate block boundaries before extracting plain text; never search HTML tags.
    container.innerHTML = rule.html.replace(/<\/(p|li|td|th|div|h[1-6])>|<br\s*\/?\s*>/gi, "$& ");
    return { ...rule, text: (container.textContent || "").replace(/\s+/g, " ").trim() };
});
const byId = new Map(rules.map((rule) => [rule.id, rule]));
type Rule = (typeof rules)[number];
let selectedId: string | null = null;
let lastSelectedId: string | null = null;
let listWindowScroll = 0;
let listScroll = 0;
let pendingPinId: string | null = null;
let pinTrigger: HTMLElement | null = null;
let pinned: string[] = [];
try {
    const stored: unknown = JSON.parse(localStorage.getItem("glossaryPinned") || "[]");
    if (Array.isArray(stored)) pinned = [...new Set(stored.filter((id): id is string => typeof id === "string" && byId.has(id)))].slice(0, 2);
} catch { /* An unavailable store or old malformed value must not disable the glossary. */ }

function announce(message: string) {
    status.textContent = message;
}

function highlight(target: HTMLElement, text: string, query = search.value.trim()) {
    target.replaceChildren();
    const needle = normalizeGlossaryText(query);
    if (!needle) {
        target.textContent = text;
        return;
    }
    const normalized = normalizeGlossaryText(text);
    let offset = 0;
    let position = normalized.indexOf(needle);
    while (position !== -1) {
        target.append(document.createTextNode(text.slice(offset, position)));
        const mark = document.createElement("mark");
        mark.dataset.glossaryHighlight = "";
        mark.textContent = text.slice(position, position + needle.length);
        target.append(mark);
        offset = position + needle.length;
        position = normalized.indexOf(needle, offset);
    }
    target.append(document.createTextNode(text.slice(offset)));
}

function highlightDescription() {
    const description = details.querySelector<HTMLElement>(".glossary-description");
    if (!description) return;
    description.querySelectorAll("mark[data-glossary-highlight]").forEach((mark) => mark.replaceWith(document.createTextNode(mark.textContent || "")));
    description.normalize();
    if (!search.value.trim()) return;
    const walker = document.createTreeWalker(description, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (!node.parentElement?.closest("script, style, code, pre")) nodes.push(node);
    }
    nodes.forEach((node) => {
        const wrapper = document.createElement("span");
        highlight(wrapper, node.textContent || "");
        node.replaceWith(...Array.from(wrapper.childNodes));
    });
}

function selectedCategories() {
    return checkboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
}

function markSelection() {
    list.querySelectorAll<HTMLAnchorElement>(".glossary-rule").forEach((link) => {
        const active = link.dataset.id === (selectedId || lastSelectedId);
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
    });
}

function renderList() {
    const query = search.value.trim();
    const categories = selectedCategories();
    const matches = findGlossaryRules(rules, query, categories);
    const fragment = document.createDocumentFragment();
    matches.forEach((rule) => {
        const link = document.createElement("a");
        link.className = "glossary-rule";
        link.href = `#${encodeURIComponent(rule.id)}`;
        link.dataset.id = rule.id;
        const name = document.createElement("span");
        name.className = "glossary-rule-name";
        highlight(name, rule.name);
        const english = document.createElement("span");
        english.className = "glossary-rule-english";
        english.lang = "en";
        highlight(english, rule.nameEn);
        const category = document.createElement("span");
        category.className = "glossary-rule-category";
        category.textContent = rule.category;
        link.append(name, english, category);
        if (query && !normalizeGlossaryText(`${rule.name} ${rule.nameEn}`).includes(normalizeGlossaryText(query))) {
            const excerpt = document.createElement("span");
            excerpt.className = "glossary-rule-excerpt";
            highlight(excerpt, glossaryExcerpt(rule.text, query));
            link.append(excerpt);
        }
        fragment.append(link);
    });
    list.replaceChildren(fragment);
    list.hidden = matches.length === 0;
    markSelection();
    element("result-count").textContent = query || categories.length ? `Найдено: ${matches.length} из ${rules.length}` : `Терминов: ${rules.length}`;
    element("category-result-count").textContent = element("result-count").textContent;
    element("no-results").hidden = matches.length !== 0;
    element("clear-search").hidden = !search.value;
    element("reset-all").hidden = !query && !categories.length;
    element("filter-count").textContent = String(categories.length);
    element("filter-count").hidden = !categories.length;
    filterButton.setAttribute("aria-label", categories.length ? `Категории, выбрано: ${categories.length}` : "Категории");
    filterButton.title = categories.length ? categories.join(", ") : "Выбрать категории правил";
    element<HTMLButtonElement>("reset-categories").disabled = !categories.length;
    const chips = element("selected-categories");
    chips.replaceChildren();
    chips.hidden = !categories.length;
    categories.forEach((category) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "glossary-chip";
        chip.textContent = `${category} ×`;
        chip.setAttribute("aria-label", `Убрать категорию «${category}»`);
        chip.addEventListener("click", () => {
            const previousIndex = Array.from(chips.children).indexOf(chip);
            checkboxes.find((checkbox) => checkbox.value === category)!.checked = false;
            renderList();
            ((chips.children[Math.min(previousIndex, chips.children.length - 1)] as HTMLElement) || checkboxes[0]).focus();
        });
        chips.append(chip);
    });
    highlightDescription();
}

function button(label: string, action: () => void, className = "glossary-button") {
    const control = document.createElement("button");
    control.type = "button";
    control.className = className;
    control.textContent = label;
    control.addEventListener("click", action);
    return control;
}

function updatePinButtons() {
    page.querySelectorAll<HTMLButtonElement>(".glossary-pin-button").forEach((control) => {
        const isPinned = pinned.includes(control.dataset.id!);
        control.textContent = isPinned ? "Открепить" : "Закрепить";
        control.setAttribute("aria-pressed", String(isPinned));
        control.setAttribute("aria-label", `${isPinned ? "Открепить" : "Закрепить"} «${byId.get(control.dataset.id!)!.name}»`);
    });
}

function savePins() {
    let persisted = true;
    try { localStorage.setItem("glossaryPinned", JSON.stringify(pinned)); }
    catch { persisted = false; }
    renderPinned();
    updatePinButtons();
    announce(persisted ? "Закреплённые правила обновлены." : "Правила закреплены на эту сессию. Браузер не разрешил сохранить их.");
}

function togglePin(id: string, trigger: HTMLElement) {
    if (pinned.includes(id)) {
        pinned = pinned.filter((pin) => pin !== id);
        savePins();
    } else if (pinned.length < 2) {
        pinned.push(id);
        savePins();
    } else {
        pendingPinId = id;
        pinTrigger = trigger;
        element("pin-dialog-description").textContent = `Чтобы закрепить «${byId.get(id)!.name}», выберите правило для замены.`;
        const replacements = element("pin-replacements");
        replacements.replaceChildren();
        pinned.forEach((oldId) => replacements.append(button(`Заменить «${byId.get(oldId)!.name}»`, () => {
            const replacement = pendingPinId;
            if (!replacement) return;
            pinned = pinned.map((pin) => pin === oldId ? replacement : pin);
            dialog.close();
            savePins();
        })));
        dialog.showModal();
    }
}

function renderPinned() {
    element("pinned-section").hidden = !pinned.length;
    element("pinned-count").textContent = `${pinned.length}/2`;
    const target = element("pinned-list");
    target.replaceChildren();
    pinned.forEach((id) => {
        const rule = byId.get(id)!;
        const card = document.createElement("div");
        card.className = "glossary-pinned-card";
        const link = document.createElement("a");
        link.className = "glossary-pinned-link";
        link.href = `#${encodeURIComponent(id)}`;
        link.dataset.id = id;
        const name = document.createElement("strong");
        name.textContent = rule.name;
        const category = document.createElement("span");
        category.textContent = rule.category;
        link.append(name, category);
        const remove = button("×", () => {
            pinned = pinned.filter((pin) => pin !== id);
            savePins();
            const nextLink = target.querySelector<HTMLAnchorElement>("a");
            (nextLink || details.querySelector<HTMLElement>(".glossary-pin-button") || search).focus();
        }, "glossary-icon-button");
        remove.setAttribute("aria-label", `Открепить «${rule.name}»`);
        card.append(link, remove);
        target.append(card);
    });
}

async function copyLink(rule: Rule) {
    const url = new URL(window.location.href);
    url.hash = encodeURIComponent(rule.id);
    try {
        await navigator.clipboard.writeText(url.href);
        announce("Ссылка скопирована.");
    } catch {
        announce("Скопируйте ссылку из поля:");
        const input = document.createElement("input");
        input.className = "glossary-copy-fallback";
        input.readOnly = true;
        input.value = url.href;
        input.setAttribute("aria-label", "Ссылка на правило");
        status.append(input);
        input.focus();
        input.select();
    }
}

function renderDetails(rule: Rule) {
    details.replaceChildren();
    const header = document.createElement("header");
    header.className = "glossary-detail-header";
    const category = document.createElement("span");
    category.className = "glossary-detail-category";
    category.textContent = rule.category;
    const title = document.createElement("h2");
    title.id = "rule-title";
    title.tabIndex = -1;
    title.textContent = rule.name;
    const english = document.createElement("p");
    english.className = "glossary-detail-english";
    english.lang = "en";
    english.textContent = rule.nameEn;
    const actions = document.createElement("div");
    actions.className = "glossary-detail-actions";
    const pin = button("Закрепить", () => togglePin(rule.id, pin));
    pin.classList.add("glossary-pin-button");
    pin.dataset.id = rule.id;
    actions.append(pin, button("Скопировать ссылку", () => { void copyLink(rule); }));
    header.append(category, title, english, actions);
    const description = document.createElement("div");
    description.className = "glossary-description";
    // Descriptions are trusted, repository-owned content, not user HTML.
    description.innerHTML = rule.html;
    description.querySelectorAll("table").forEach((table, index) => {
        const scroll = document.createElement("div");
        scroll.className = "glossary-table-scroll";
        scroll.tabIndex = 0;
        scroll.setAttribute("role", "region");
        scroll.setAttribute("aria-label", `Таблица ${index + 1}: ${rule.name}`);
        table.replaceWith(scroll);
        scroll.append(table);
    });
    details.append(header, description);
    details.setAttribute("aria-labelledby", "rule-title");
    updatePinButtons();
    highlightDescription();
}

function currentHash() {
    try { return decodeURIComponent(window.location.hash.slice(1)); }
    catch { return ""; }
}

function syncLocation(focus = false) {
    const id = currentHash();
    const rule = byId.get(id);
    const previousId = selectedId;
    if (dialog.open) dialog.close();
    if (categoryPanel.open) categoryPanel.close();
    selectedId = rule?.id || null;
    if (rule) {
        lastSelectedId = rule.id;
        // Back/Forward can emit both popstate and hashchange for the same URL.
        if (previousId !== rule.id) renderDetails(rule);
    } else {
        details.innerHTML = welcome;
        details.removeAttribute("aria-labelledby");
        if (id) announce("Такого термина нет в глоссарии. Выберите правило из списка.");
    }
    page.classList.toggle("is-reading", !!rule);
    markSelection();
    if (focus && rule) {
        element("rule-title").focus({ preventScroll: true });
        if (mobile.matches) window.scrollTo({ top: 0, behavior: "instant" });
        else {
            // Scroll the sidebar only; never move the page to the selected tile.
            const active = Array.from(list.querySelectorAll<HTMLAnchorElement>("a")).find((link) => link.dataset.id === id);
            if (active) {
                const itemRect = active.getBoundingClientRect();
                const listRect = list.getBoundingClientRect();
                if (itemRect.top < listRect.top) list.scrollTop -= listRect.top - itemRect.top;
                else if (itemRect.bottom > listRect.bottom) list.scrollTop += itemRect.bottom - listRect.bottom;
            }
            const top = details.getBoundingClientRect().top;
            if (top < 80) window.scrollBy({ top: top - 96, behavior: "instant" });
        }
    } else if (focus && !rule) {
        list.scrollTop = listScroll;
        if (mobile.matches) window.scrollTo({ top: listWindowScroll, behavior: "instant" });
        const lastLink = Array.from(list.querySelectorAll<HTMLAnchorElement>("a")).find((link) => link.dataset.id === lastSelectedId);
        (lastLink || search).focus({ preventScroll: true });
    }
}

page.addEventListener("click", (event) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-id]");
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (!selectedId) {
        listWindowScroll = window.scrollY;
        listScroll = list.scrollTop;
    }
    if (currentHash() !== link.dataset.id) {
        const url = new URL(window.location.href);
        url.hash = encodeURIComponent(link.dataset.id!);
        history.pushState(null, "", url);
    }
    announce("");
    syncLocation(true);
});

element("back-to-list").addEventListener("click", () => {
    const url = new URL(window.location.href);
    url.hash = "";
    history.pushState(null, "", url);
    syncLocation(true);
});
window.addEventListener("popstate", () => syncLocation(true));
window.addEventListener("hashchange", () => syncLocation(true));
search.addEventListener("input", () => { list.scrollTop = 0; renderList(); });
element("clear-search").addEventListener("click", () => { search.value = ""; renderList(); search.focus(); });
function resetAll() {
    search.value = "";
    checkboxes.forEach((checkbox) => { checkbox.checked = false; });
    list.scrollTop = 0;
    renderList();
    search.focus();
}
element("reset-all").addEventListener("click", resetAll);
element("empty-reset").addEventListener("click", resetAll);
filterButton.addEventListener("click", () => {
    categoryPanel.showModal();
    filterButton.setAttribute("aria-expanded", "true");
});
checkboxes.forEach((checkbox) => checkbox.addEventListener("change", () => { list.scrollTop = 0; renderList(); }));
element("close-category-dialog").addEventListener("click", () => categoryPanel.close());
element("done-categories").addEventListener("click", () => categoryPanel.close());
element("reset-categories").addEventListener("click", () => {
    checkboxes.forEach((checkbox) => { checkbox.checked = false; });
    list.scrollTop = 0;
    renderList();
    checkboxes[0].focus();
});
categoryPanel.addEventListener("click", (event) => {
    const rect = categoryPanel.getBoundingClientRect();
    if (event.target === categoryPanel && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) categoryPanel.close();
});
categoryPanel.addEventListener("close", () => {
    filterButton.setAttribute("aria-expanded", "false");
    filterButton.focus({ preventScroll: true });
});
element("close-pin-dialog").addEventListener("click", () => dialog.close());
element("cancel-pin-dialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});
dialog.addEventListener("close", () => {
    pendingPinId = null;
    pinTrigger?.focus({ preventScroll: true });
    pinTrigger = null;
});
// Navigation is rendered here; browser scroll restoration would conflict with mobile views.
history.scrollRestoration = "manual";
renderList();
renderPinned();
syncLocation(!!currentHash());
