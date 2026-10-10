import { isLocalAuthBypassEnabled, localAccountPreviewProfile, testAccountSupabase, type AccountRole } from '../../utils/testAccount';
import {
  ruleCategories, settlements, magicItemPoolPrices, dragonStages, dragonQuirks,
  escapeRuleText as esc, renderRuleMarkdown, calculateRewardBudget, calculateTrade,
  calculateDragonStage, validateRuleCatalog, type MasterRule, type MasterRuleCatalog,
  type EditableMasterRule, type RuleAudience, canReadMasterRule, canEditMasterRules, defaultRuleAudiences
} from '../../utils/masterRules';
import {
  mergeRuleFiles, parseLocalRuleStore, saveLocalRule, ruleSignature,
  importRuleFile, LocalRuleConflict, type LocalRuleStore
} from '../../utils/masterRuleFiles';

type EditableRule = EditableMasterRule;
interface LocalDraft { id: string | null; revision: number | null; signature?: string | null; fields: EditableRule; }

export async function initializeMasterWorkspace(userId: string, role: AccountRole) {
  const root = document.querySelector<HTMLElement>('#master-workspace');
  const client = testAccountSupabase;
  const localPreview = isLocalAuthBypassEnabled && userId === localAccountPreviewProfile.id;
  if (!root || (!client && !localPreview) || root.dataset.initialized) return;
  if (role === 'player') return;
  const officialView = new URL(window.location.href).searchParams.get('official') === '1';
  const editable = canEditMasterRules(role) && !officialView;
  const canWriteNotes = role === 'master' || role === 'admin';

  function el<T extends HTMLElement = HTMLElement>(id: string): T {
    const element = root!.querySelector<T>(`#${id}`);
    if (!element) throw new Error(`Missing master workspace element: ${id}`);
    return element;
  }
  const draftKey = `loh-master-rule-draft:${userId}`;
  const bookmarksKey = `loh-master-rule-bookmarks:${userId}`;
  const changesKey = `loh-master-rule-changes:${userId}`;
  const source = validateRuleCatalog(JSON.parse(el('mw-source-rules').textContent || 'null'));
  const search = el<HTMLInputElement>('mw-search');
  const statusFilter = el<HTMLSelectElement>('mw-status-filter');
  const form = el<HTMLFormElement>('mw-rule-form');
  const bodyInput = el<HTMLTextAreaElement>('mw-edit-body');
  const titleInput = el<HTMLInputElement>('mw-edit-title');
  const summaryInput = el<HTMLTextAreaElement>('mw-edit-summary');
  const categoryInput = el<HTMLSelectElement>('mw-edit-category');
  const statusInput = el<HTMLSelectElement>('mw-edit-status');
  const orderInput = el<HTMLInputElement>('mw-edit-order');
  const audienceInputs = [...el('mw-edit-audiences').querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  const noteInput = el<HTMLTextAreaElement>('mw-note-text');
  const notes = new Map<string, string>();
  const unsavedNotes = new Set<string>();
  const notePrefix = `loh-master-rule-note:${userId}:`;
  root.querySelectorAll<HTMLElement>('[data-mw-editor-only]').forEach(element => { element.hidden = !editable; });
  el<HTMLFieldSetElement>('mw-editor-fields').disabled = !editable;
  el<HTMLInputElement>('mw-import-rules').disabled = !editable;
  el('mw-status-filter-label').hidden = role === 'test_master';
  if (!editable) {
    if (role === 'test_master') {
      el('mw-heading-title').textContent = 'Справочник тестового мастера';
      el('mw-heading-description').textContent = 'Подготовьтесь к тестовой игре и первому шагу в Мастера Лиги.';
      el('mw-storage-note').textContent = 'Здесь показаны готовые статьи для тестовых мастеров. После тестовой игры и получения роли мастера вам станет доступен полный мастерский режим.';
      el('mw-sidebar-note').textContent = 'Правила для вашей роли. Отмечайте нужные статьи в избранном.';
    } else {
      el('mw-storage-note').textContent = 'Вы читаете оригинальные правила Лиги. Редактор доступен только администратору; прежние локальные правки здесь не применяются. Свои пояснения сохраняйте отдельно в личных заметках. Скачанный текст можно использовать как основу собственных материалов.';
      el('mw-sidebar-note').textContent = 'Правила сайта и отдельные личные заметки. Черновики отмечены отдельно.';
    }
    el('mw-refresh').textContent = 'Обновить справочник';
  }
  let rules: MasterRule[] = [];
  let category = 'all';
  let current: MasterRule | null = null;
  let view = 'library';
  let editingId: string | null = null;
  let editingRevision: number | null = null;
  let editingSignature: string | null = null;
  let localIds = new Set<string>();
  let sourceConflicts = new Map<string, MasterRule>();
  let initialFields = '';
  let pendingDraft: LocalDraft | null = null;
  let saving = false;
  let loading = false;
  let accessible = true;
  let draftTimer: number | undefined;
  let observer: IntersectionObserver | null = null;
  let generatedText = '';
  let lastUrl = window.location.href;
  let bookmarks = new Set<string>();
  try {
    const saved = JSON.parse(localStorage.getItem(bookmarksKey) || '[]');
    if (Array.isArray(saved)) bookmarks = new Set(saved.filter(value => typeof value === 'string'));
  } catch { /* Reading site articles does not require local storage. */ }

  function notice(message: string, kind = 'success', target = 'mw-status') {
    const element = el(target);
    element.textContent = message;
    element.dataset.kind = kind;
    element.hidden = false;
  }
  function date(value: string) {
    return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(value));
  }
  const number = (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  function newRuleId() {
    if (typeof crypto.randomUUID === 'function') return `rule-${crypto.randomUUID()}`;
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return `rule-${Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')}`;
  }
  const label = (id: string) => ruleCategories.find(item => item.id === id)?.title || 'Другие правила';
  const badge = (rule: MasterRule) => `<span class="mw-badge ${rule.status === 'draft' ? 'mw-badge-draft' : ''}">${rule.status === 'draft' ? 'Черновик' : localIds.has(rule.id) ? 'Готово к публикации' : 'На сайте'}</span>${localIds.has(rule.id) ? '<span class="mw-badge mw-local-badge">Локально</span>' : ''}`;
  function fields(): EditableRule {
    return { title: titleInput.value.trim(), category: categoryInput.value, summary: summaryInput.value.trim(), body: bodyInput.value.trim(), status: statusInput.value as MasterRule['status'], sort_order: Number(orderInput.value), audiences: audienceInputs.filter(input => input.checked).map(input => input.value as RuleAudience) };
  }
  function dirty() { return view === 'editor' && JSON.stringify(fields()) !== initialFields; }
  function draftBanner() { el('mw-local-draft').hidden = !editable || !pendingDraft; }
  function storeDraft() {
    if (!editable || !dirty()) return true;
    const draft: LocalDraft = { id: editingId, revision: editingRevision, signature: editingSignature, fields: fields() };
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
      pendingDraft = draft;
      el('mw-draft-state').textContent = 'Текст сохранён в этом браузере';
      return true;
    } catch {
      el('mw-draft-state').textContent = 'Браузер не разрешил сохранить текст локально';
      return false;
    }
  }
  function clearDraft() {
    if (!editable) return;
    window.clearTimeout(draftTimer);
    try { localStorage.removeItem(draftKey); } catch { /* Optional storage. */ }
    pendingDraft = null;
    draftBanner();
  }
  function canLeave() {
    if (saving) { notice('Дождитесь завершения сохранения.', 'error'); return false; }
    if (!dirty()) return true;
    const stored = storeDraft();
    return window.confirm(stored
      ? 'Закрыть редактор с несохранёнными изменениями? Текст можно восстановить в этом браузере.'
      : 'Браузер не разрешил сохранить текст локально. Закрыть редактор и потерять изменения?');
  }
  function setView(next: string) {
    observer?.disconnect();
    for (const candidate of ['library', 'reader', 'editor', 'tools']) el(`mw-${candidate}`).hidden = candidate !== next;
    view = next;
    draftBanner();
    el('mw-open-tools').classList.toggle('is-active', next === 'tools');
  }
  function updateUrl(id: string | null, push = true) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('rule', id); else url.searchParams.delete('rule');
    url.hash = '';
    if (url.href !== window.location.href) {
      if (push) history.pushState({}, '', url); else history.replaceState({}, '', url);
    }
    lastUrl = window.location.href;
  }
  function revealMain() {
    const target = root!.querySelector<HTMLElement>('.mw-main');
    if (!target) return;
    const top = target.getBoundingClientRect().top;
    if (top < 90 || top > window.innerHeight - 100) target.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function renderLibrary() {
    const query = search.value.trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
    const selectedStatus = statusFilter.value;
    const filtered = rules.filter(rule => {
      const matchCategory = category === 'all' || (category === 'bookmarks' ? bookmarks.has(rule.id) : rule.category === category);
      const haystack = `${rule.title} ${rule.summary} ${rule.body}`.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
      return matchCategory && (selectedStatus === 'all' || rule.status === selectedStatus) && haystack.includes(query);
    });
    el('mw-list-title').textContent = category === 'all' ? 'Все правила' : category === 'bookmarks' ? 'Избранное' : label(category);
    el('mw-list-description').textContent = category === 'all' ? (role === 'test_master' ? 'Руководство и правила, доступные тестовому мастеру.' : 'От награды за сессию до возвращения в Сигил.') : category === 'bookmarks' ? 'Правила, которые вы отметили для быстрого доступа.' : ruleCategories.find(item => item.id === category)?.description || '';
    el('mw-result-count').textContent = `Статей: ${filtered.length}`;
    root!.querySelectorAll<HTMLElement>('[data-count]').forEach(element => {
      const key = element.dataset.count;
      element.textContent = String(rules.filter(rule => key === 'all' || (key === 'bookmarks' ? bookmarks.has(rule.id) : rule.category === key)).length);
    });
    root!.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button => {
      const active = button.dataset.category === category;
      button.hidden = !editable && !['all', 'bookmarks'].includes(button.dataset.category || '') && !rules.some(rule => rule.category === button.dataset.category);
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    el('mw-rule-list').innerHTML = filtered.length ? filtered.map(rule => {
      const starred = bookmarks.has(rule.id);
      return `<article class="mw-rule-card"><button class="mw-rule-open" type="button" data-rule-id="${esc(rule.id)}">
        <span class="mw-card-kicker">${esc(label(rule.category))} ${badge(rule)}</span>
        <strong>${esc(rule.title)}</strong><span class="mw-card-summary">${esc(rule.summary || 'Открыть полный текст правила.')}</span>
        <span class="mw-card-footer"><span>${Math.max(1, Math.ceil(rule.body.split(/\s+/).length / 180))} мин чтения · ${esc(date(rule.updated_at))}</span><span class="mw-card-arrow">Читать →</span></span>
      </button><button class="mw-card-star" type="button" data-bookmark-id="${esc(rule.id)}" aria-pressed="${starred}" aria-label="${starred ? 'Убрать из избранного' : 'Добавить в избранное'}: ${esc(rule.title)}">${starred ? '★' : '☆'}</button></article>`;
    }).join('') : `<p class="mw-empty">${query || selectedStatus !== 'all' ? 'Правила не найдены. Измените запрос или фильтр.' : category === 'bookmarks' ? 'Отметьте статьи звёздочкой, чтобы быстро возвращаться к ним.' : 'В этом разделе пока нет статей. Добавьте первое правило.'}</p>`;
  }
  function toggleBookmark(id: string) {
    if (bookmarks.has(id)) bookmarks.delete(id); else bookmarks.add(id);
    try { localStorage.setItem(bookmarksKey, JSON.stringify([...bookmarks])); } catch { notice('Избранное доступно до закрытия страницы: браузер запретил локальное сохранение.', 'error'); }
    renderLibrary();
    if (current?.id === id) updateReaderBookmark();
  }
  function updateReaderBookmark() {
    const starred = !!current && bookmarks.has(current.id);
    const button = el<HTMLButtonElement>('mw-bookmark');
    button.textContent = starred ? '★ В избранном' : '☆ В избранное';
    button.setAttribute('aria-pressed', String(starred));
  }
  function openRule(id: string, push = true, skipLeave = false) {
    if (!skipLeave && !canLeave()) return;
    const rule = rules.find(item => item.id === id);
    if (!rule) { setView('library'); updateUrl(null, false); notice('Статья не найдена или недоступна в этом режиме. Выберите правило из списка.', 'error'); return; }
    current = rule;
    category = rule.category;
    renderLibrary();
    setView('reader');
    updateUrl(id, push);
    el('mw-rule-title').textContent = rule.title;
    el('mw-rule-meta').innerHTML = `${esc(label(rule.category))} ${badge(rule)}${editable ? `<span class="mw-badge">${(rule.audiences ?? defaultRuleAudiences).map(audience => audience === 'test_master' ? 'Тестовый мастер' : 'Мастер').join(' · ')}</span>` : ''}`;
    const resetButton = el<HTMLButtonElement>('mw-reset-rule');
    resetButton.hidden = !editable || (!localIds.has(rule.id) && !sourceConflicts.has(rule.id));
    resetButton.textContent = source.rules.some(article => article.id === rule.id) ? 'Вернуть версию сайта' : 'Удалить локальную статью';
    el('mw-source-conflict').hidden = !sourceConflicts.has(rule.id);
    el('mw-rule-summary').textContent = rule.summary;
    el('mw-rule-summary').hidden = !rule.summary;
    const rendered = renderRuleMarkdown(rule.body);
    el('mw-rule-body').innerHTML = rendered.html;
    el('mw-toc').innerHTML = rendered.headings.length ? rendered.headings.map(heading => `<a href="#${esc(heading.id)}" data-level="${heading.level}">${esc(heading.title)}</a>`).join('') : '<span>В статье нет подзаголовков.</span>';
    el('mw-rule-updated').textContent = `${localIds.has(rule.id) ? 'Локальная редакция администратора' : rule.status === 'draft' ? 'Черновик правила Лиги' : 'Правило Лиги'} · ${rule.id} · редакция ${rule.revision} · обновлено ${date(rule.updated_at)}`;
    const original = source.rules.find(article => article.id === rule.id);
    const originalUrl = new URL(window.location.href);
    originalUrl.search = '';
    originalUrl.searchParams.set('rule', rule.id);
    originalUrl.searchParams.set('official', '1');
    originalUrl.hash = '';
    el<HTMLAnchorElement>('mw-original-link').href = originalUrl.href;
    el('mw-original-link').hidden = !original;
    el('mw-download-rule').hidden = !original;
    el('mw-personal-notes').hidden = !canWriteNotes;
    loadNote(rule.id);
    updateReaderBookmark();
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) {
          el('mw-toc').querySelectorAll('a').forEach(link => link.classList.toggle('is-active', link.hash === `#${entry.target.id}`));
        }
      }, { rootMargin: '-90px 0px -65% 0px' });
      rendered.headings.forEach(heading => { const target = document.getElementById(heading.id); if (target) observer!.observe(target); });
    }
    if (push) { el('mw-rule-title').focus({ preventScroll: true }); revealMain(); }
  }
  function showLibrary(push = true) {
    if (!canLeave()) return;
    setView('library'); updateUrl(null, push); renderLibrary();
  }
  function loadNote(id: string) {
    if (!canWriteNotes) return;
    try {
      if (!notes.has(id)) notes.set(id, localStorage.getItem(notePrefix + id) || '');
      noteInput.value = notes.get(id)!;
      el('mw-note-status').textContent = unsavedNotes.has(id) ? 'Заметка не сохранена. Скопируйте текст перед закрытием страницы.' : noteInput.value ? 'Заметка сохранена в этом браузере.' : 'Сохраняется автоматически при вводе.';
    } catch {
      noteInput.value = notes.get(id) || '';
      el('mw-note-status').textContent = 'Браузер не разрешил прочитать заметку. Скопируйте новый текст перед закрытием страницы.';
    }
  }
  noteInput.addEventListener('input', () => {
    if (!accessible || !canWriteNotes || !current) return;
    const id = current.id;
    notes.set(id, noteInput.value);
    try {
      if (noteInput.value) localStorage.setItem(notePrefix + id, noteInput.value);
      else localStorage.removeItem(notePrefix + id);
      unsavedNotes.delete(id);
      el('mw-note-status').textContent = noteInput.value ? 'Заметка сохранена в этом браузере.' : 'Заметка удалена.';
    } catch {
      unsavedNotes.add(id);
      el('mw-note-status').textContent = 'Не удалось сохранить заметку. Текст доступен до закрытия страницы — скопируйте его.';
    }
  });
  function preview() {
    el('mw-preview-body').innerHTML = bodyInput.value.trim() ? renderRuleMarkdown(bodyInput.value, 'preview').html : '<p>Здесь появится оформленный текст статьи.</p>';
  }
  function edit(rule: MasterRule | null, restored?: LocalDraft, generatedBody?: string) {
    if (!editable || !accessible) return false;
    if (!canLeave()) return false;
    if (!restored && pendingDraft && !window.confirm('В браузере есть незавершённый текст. Начать редактирование другой статьи? Новый текст заменит локальный черновик после изменения.')) return false;
    editingId = restored ? restored.id : rule?.id || null;
    editingRevision = restored ? restored.revision : rule?.revision || null;
    editingSignature = restored ? restored.signature || null : rule ? ruleSignature(rule) : null;
    const defaults: EditableRule = { title: '', category: ruleCategories.some(item => item.id === category) ? category : 'other', summary: '', body: '', status: 'draft', sort_order: 100 };
    const next = restored?.fields || rule || defaults;
    titleInput.value = next.title;
    categoryInput.value = next.category;
    summaryInput.value = next.summary;
    bodyInput.value = generatedBody || next.body;
    statusInput.value = next.status;
    audienceInputs.forEach(input => { input.checked = (next.audiences ?? defaultRuleAudiences).includes(input.value as RuleAudience); });
    orderInput.value = String(next.sort_order);
    el('mw-editor-title').textContent = editingId ? 'Редактирование правила' : 'Новое правило';
    el('mw-save-error').hidden = true;
    el('mw-conflict').hidden = true;
    initialFields = restored || generatedBody ? '' : JSON.stringify(fields());
    setView('editor');
    el('mw-local-draft').hidden = true;
    el('mw-draft-state').textContent = '';
    preview();
    if (restored || generatedBody) storeDraft();
    titleInput.focus({ preventScroll: true });
    revealMain();
    return true;
  }
  function denyAccess() {
    storeDraft();
    accessible = false;
    rules = []; current = null;
    el('mw-rule-list').replaceChildren();
    el('mw-rule-body').replaceChildren();
    el('mw-preview-body').replaceChildren();
    noteInput.value = '';
    notes.clear(); unsavedNotes.clear();
    root!.hidden = true;
    root!.dispatchEvent(new CustomEvent('master-access-denied', { bubbles: true }));
  }
  function readChanges() { return parseLocalRuleStore(localStorage.getItem(changesKey)); }
  async function withChangesLock<T>(callback: () => T): Promise<T> {
    return navigator.locks ? navigator.locks.request(changesKey, callback) : callback();
  }
  function applyChanges(store: LocalRuleStore) {
    const merged = mergeRuleFiles(source, editable ? store : { version: 1, changes: [] });
    rules = merged.rules.filter(rule => canReadMasterRule(rule, role));
    localIds = merged.localIds;
    sourceConflicts = merged.conflicts;
    renderLibrary();
    root!.querySelectorAll<HTMLElement>('[data-rule-id]').forEach(element => { element.hidden = !rules.some(rule => rule.id === element.dataset.ruleId); });
    el('mw-local-conflicts').hidden = !sourceConflicts.size;
    el('mw-local-conflict-count').textContent = `Статей с копией прежней редакции: ${sourceConflicts.size}. Версия сайта показана в справочнике; ваши тексты сохранены отдельно.`;
    return merged;
  }
  function loadRules() {
    if (loading || !accessible) return false;
    loading = true;
    root!.setAttribute('aria-busy', 'true');
    el<HTMLButtonElement>('mw-refresh').disabled = true;
    try {
      const store = editable ? readChanges() : { version: 1 as const, changes: [] };
      const merged = applyChanges(store);
      if (merged.store.changes.length !== store.changes.length) {
        try { localStorage.setItem(changesKey, JSON.stringify(merged.store)); } catch { /* Already published local copies need no writes to remain readable. */ }
      }
      el<HTMLButtonElement>('mw-add-rule').disabled = !editable;
      return true;
    } catch (error) {
      applyChanges({ version: 1, changes: [] });
      el<HTMLButtonElement>('mw-add-rule').disabled = !editable;
      notice('Локальные правки не удалось прочитать. Правила сайта доступны. Проверьте разрешение на хранение данных или импортируйте резервный файл.', 'error');
      return true;
    } finally {
      loading = false;
      root!.setAttribute('aria-busy', 'false');
      el<HTMLButtonElement>('mw-refresh').disabled = false;
    }
  }
  async function saveRule(event: SubmitEvent) {
    event.preventDefault();
    if (saving || !accessible || !editable || !form.reportValidity()) return;
    const payload = fields();
    if (!payload.title || !payload.body) { notice('Заполните заголовок и текст правила.', 'error', 'mw-save-error'); return; }
    if (!payload.audiences?.length) { notice('Выберите хотя бы одну роль для отображения правила.', 'error', 'mw-save-error'); return; }
    storeDraft();
    saving = true;
    el<HTMLFieldSetElement>('mw-editor-fields').disabled = true;
    el<HTMLButtonElement>('mw-save-rule').disabled = true;
    el('mw-save-error').hidden = true;
    try {
      const id = editingId || newRuleId();
      const saved = await withChangesLock(() => {
        if (!accessible) throw new Error('Сессия завершена.');
        const result = saveLocalRule(source, readChanges(), id, editingRevision, payload, new Date().toISOString(), editingSignature);
        localStorage.setItem(changesKey, JSON.stringify(result.store));
        applyChanges(result.store);
        return result.saved;
      });
      clearDraft();
      initialFields = JSON.stringify(fields());
      openRule(saved.id, true, true);
      notice('Статья сохранена в этом браузере. Для публикации на сайте скачайте файл справочника.');
    } catch (error) {
      if (error instanceof LocalRuleConflict) {
        if (error.current) {
          const index = rules.findIndex(rule => rule.id === error.current!.id);
          if (index >= 0) rules[index] = error.current;
          el('mw-conflict').hidden = false;
          el('mw-conflict-body').textContent = `${error.current.title}\nРедакция ${error.current.revision}\n\n${error.current.body}`;
        }
        notice('Статья изменилась в другой вкладке или после обновления сайта. Ваш текст остался в редакторе. Сравните версии перед сохранением.', 'error', 'mw-save-error');
      } else notice('Браузер не разрешил сохранить статью или локальные данные повреждены. Текст остался в редакторе.', 'error', 'mw-save-error');
    } finally {
      saving = false;
      el<HTMLFieldSetElement>('mw-editor-fields').disabled = false;
      el<HTMLButtonElement>('mw-save-rule').disabled = false;
    }
  }

  root.dataset.initialized = 'true';
  try {
    const draft: LocalDraft | null = editable ? JSON.parse(localStorage.getItem(draftKey) || 'null') : null;
    if (draft && typeof draft.fields?.body === 'string' && typeof draft.fields?.title === 'string'
      && typeof draft.fields?.summary === 'string' && ruleCategories.some(item => item.id === draft.fields.category)
      && ['draft', 'published'].includes(draft.fields.status) && Number.isInteger(draft.fields.sort_order)
      && (draft.signature == null || typeof draft.signature === 'string')
      && (draft.id === null || typeof draft.id === 'string') && (draft.revision === null || Number.isInteger(draft.revision))) pendingDraft = draft;
  } catch { /* Corrupt drafts do not affect site articles. */ }
  draftBanner();

  root.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button || !accessible) return;
    if (button.dataset.ruleId) openRule(button.dataset.ruleId);
    if (button.dataset.bookmarkId) toggleBookmark(button.dataset.bookmarkId);
    if (button.dataset.category && canLeave()) {
      category = button.dataset.category;
      setView('library'); updateUrl(null); renderLibrary();
    }
    if (button.hasAttribute('data-mw-back')) showLibrary();
  });
  search.addEventListener('input', renderLibrary);
  statusFilter.addEventListener('change', renderLibrary);
  el('mw-add-rule').addEventListener('click', () => edit(null));
  el('mw-edit-rule').addEventListener('click', () => { if (current) edit(current); });
  el('mw-cancel-edit').addEventListener('click', () => {
    if (!canLeave()) return;
    if (current && editingId === current.id) openRule(current.id, true, true); else { setView('library'); updateUrl(null); }
  });
  el('mw-open-tools').addEventListener('click', () => { if (canLeave()) { setView('tools'); updateUrl(null); revealMain(); } });
  el('mw-open-map-generator').addEventListener('click', () => {
    const panel = el('mw-map-generator-panel');
    const button = el('mw-open-map-generator');
    const frame = el<HTMLIFrameElement>('mw-map-generator');
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', String(!panel.hidden));
    button.textContent = panel.hidden ? 'Открыть генератор карт' : 'Свернуть генератор карт';
    if (!panel.hidden && !frame.getAttribute('src')) frame.src = frame.dataset.src!;
  });
  el('mw-bookmark').addEventListener('click', () => { if (current) toggleBookmark(current.id); });
  el('mw-refresh').addEventListener('click', async () => {
    el('mw-status').hidden = true;
    if (await loadRules()) notice('Справочник обновлён.');
  });
  function downloadCatalog(catalog: MasterRuleCatalog, filename = 'masterRules.json') {
    const blob = new Blob([JSON.stringify(validateRuleCatalog(catalog), null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  el('mw-export-rules').addEventListener('click', () => {
    if (!accessible || saving) return;
    try {
      let exported = rules;
      if (editable) { try { exported = mergeRuleFiles(source, readChanges()).rules; } catch { /* The visible site articles can still be exported if storage is unavailable. */ } }
      if (sourceConflicts.size && !window.confirm('В файле будут актуальные правила сайта и совместимые локальные правки. Копии прежних редакций можно отдельно скачать кнопкой «Скачать мои копии». Продолжить?')) return;
      const hasUnsavedText = dirty();
      if (hasUnsavedText) {
        if (!form.reportValidity()) return;
        const payload = fields();
        const id = editingId || newRuleId();
        const previous = exported.find(rule => rule.id === id);
        const now = new Date().toISOString();
        const snapshot: MasterRule = { id, ...payload, revision: (previous?.revision || 0) + 1, created_at: previous?.created_at || now, updated_at: now };
        exported = [...exported.filter(rule => rule.id !== id), snapshot];
      }
      downloadCatalog({ version: 1, rules: exported });
      notice(hasUnsavedText ? 'Файл скачан и включает текст из редактора. Он ещё не опубликован на сайте.' : editable ? 'Файл правил скачан. Для общей публикации обновите файл справочника в проекте и опубликуйте сайт.' : 'Скачаны оригинальные правила сайта. Личные заметки и прежние локальные правки в файл не входят.');
    } catch (error) { notice(error instanceof Error ? error.message : 'Не удалось скачать правила.', 'error'); }
  });
  el('mw-export-local-copies').addEventListener('click', () => {
    if (!accessible || !editable) return;
    try { downloadCatalog({ version: 1, rules: readChanges().changes.map(change => change.rule) }, 'masterRules-local-backup.json'); }
    catch { notice('Не удалось прочитать локальные копии для скачивания.', 'error'); }
  });
  el<HTMLInputElement>('mw-import-rules').addEventListener('change', async event => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !accessible || !editable || !canLeave()) { input.value = ''; return; }
    saving = true;
    input.disabled = true;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Файл правил должен быть не больше 10 МБ.');
      const incoming = validateRuleCatalog(JSON.parse(await file.text()));
      if (!window.confirm(`Импортировать ${incoming.rules.length} статей в этот браузер? Совпадающие ID заменят локальные версии. Статьи сайта обновляются при публикации файла.`)) return;
      await withChangesLock(() => {
        if (!accessible) throw new Error('Сессия завершена.');
        let store: LocalRuleStore;
        try { store = readChanges(); }
        catch {
          if (!window.confirm('Локальные правки повреждены. Заменить их статьями из выбранного файла?')) throw new Error('Импорт отменён.');
          store = { version: 1, changes: [] };
        }
        const next = importRuleFile(source, store, incoming, new Date().toISOString());
        localStorage.setItem(changesKey, JSON.stringify(next));
        applyChanges(next);
      });
      setView('library'); updateUrl(null);
      notice(`Импортировано статей: ${incoming.rules.length}. Изменения сохранены в этом браузере.`);
    } catch (error) { notice(error instanceof Error ? error.message : 'Не удалось импортировать правила.', 'error'); }
    finally { saving = false; input.disabled = false; input.value = ''; }
  });
  el('mw-reset-rule').addEventListener('click', async () => {
    if (!current || !accessible || !editable || !canLeave()) return;
    const id = current.id;
    const published = source.rules.some(rule => rule.id === id);
    if (!window.confirm(published ? 'Убрать локальные правки этой статьи и вернуть версию сайта?' : 'Удалить эту локальную статью? Для резервной копии сначала скачайте файл правил.')) return;
    saving = true;
    try {
      await withChangesLock(() => {
        if (!accessible) throw new Error('Сессия завершена.');
        const store = readChanges();
        store.changes = store.changes.filter(change => change.rule.id !== id);
        localStorage.setItem(changesKey, JSON.stringify(store));
        applyChanges(store);
      });
      if (published) openRule(id, true, true); else { setView('library'); updateUrl(null); }
      notice(published ? 'Показана версия статьи с сайта.' : 'Локальная статья удалена.');
    } catch { notice('Не удалось убрать локальные правки. Проверьте разрешение браузера на хранение данных.', 'error'); }
    finally { saving = false; }
  });
  el('mw-recover-local').addEventListener('click', () => {
    const copy = current && sourceConflicts.get(current.id);
    if (!copy || !current) return;
    edit(current, { id: current.id, revision: current.revision, signature: ruleSignature(current), fields: copy });
  });
  el('mw-restore-draft').addEventListener('click', () => { if (pendingDraft) edit(null, pendingDraft); });
  el('mw-discard-draft').addEventListener('click', () => { if (window.confirm('Убрать локальный незавершённый текст? Сохранённые статьи останутся в справочнике.')) clearDraft(); });
  el('mw-load-latest').addEventListener('click', () => {
    const latest = rules.find(rule => rule.id === editingId);
    if (!latest || !window.confirm('Заменить текст редактора сохранённой версией? Скопируйте свои изменения, если хотите их сохранить.')) return;
    initialFields = JSON.stringify(fields());
    clearDraft();
    edit(latest);
  });
  form.addEventListener('input', () => {
    el('mw-draft-state').textContent = dirty() ? 'Есть несохранённые изменения' : '';
    window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(() => { preview(); storeDraft(); }, 300);
  });
  form.addEventListener('submit', saveRule);
  el('mw-format-toolbar').addEventListener('click', event => {
    const format = (event.target as HTMLElement).closest<HTMLElement>('[data-format]')?.dataset.format;
    if (!format) return;
    const selected = bodyInput.value.slice(bodyInput.selectionStart, bodyInput.selectionEnd);
    const fragments: Record<string, string> = {
      heading: `\n\n## ${selected || 'Название раздела'}\n\n`, bold: `**${selected || 'важный текст'}**`,
      list: `\n\n- ${selected || 'Первый пункт'}\n- Второй пункт\n\n`,
      table: '\n\n| Условие | Результат |\n| --- | --- |\n| Пример | Значение |\n\n',
      link: `[${selected || 'Название ссылки'}](/bastions/)`
    };
    bodyInput.setRangeText(fragments[format], bodyInput.selectionStart, bodyInput.selectionEnd, 'end');
    bodyInput.focus(); bodyInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  window.addEventListener('beforeunload', event => { if (accessible && (dirty() || saving || unsavedNotes.size)) { storeDraft(); event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('storage', event => {
    if (!accessible) return;
    if (canWriteNotes && event.key?.startsWith(notePrefix)) {
      const id = event.key.slice(notePrefix.length);
      if (unsavedNotes.has(id)) {
        if (current?.id === id) el('mw-note-status').textContent = 'Заметка изменилась в другой вкладке. Ваш несохранённый текст оставлен здесь — скопируйте его.';
      } else {
        notes.delete(id);
        if (current?.id === id) loadNote(id);
      }
    }
    if (event.key === bookmarksKey) {
      try {
        const values = JSON.parse(event.newValue || '[]');
        if (Array.isArray(values)) bookmarks = new Set(values.filter(value => typeof value === 'string'));
        renderLibrary(); updateReaderBookmark();
      } catch { /* Keep the last readable bookmark list. */ }
    }
    if (event.key === changesKey) {
      const readerId = view === 'reader' ? current?.id : null;
      loadRules();
      if (readerId && rules.some(rule => rule.id === readerId)) openRule(readerId, false, true);
      else if (readerId) { setView('library'); updateUrl(null); }
      if (view === 'editor') notice('Локальные статьи изменились в другой вкладке. Текст редактора сохранён; при сохранении проверим актуальную редакцию.');
    }
  });
  window.addEventListener('popstate', () => {
    const destinationId = new URL(window.location.href).searchParams.get('rule');
    if (view === 'reader' && destinationId === current?.id) { lastUrl = window.location.href; return; }
    if (!canLeave()) { history.pushState({}, '', lastUrl); return; }
    const id = new URL(window.location.href).searchParams.get('rule');
    if (id) openRule(id, false, true); else { setView('library'); renderLibrary(); }
    lastUrl = window.location.href;
  });
  client?.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (session && session.user.id !== userId)) denyAccess();
  });

  async function copy(text: string, message: string) {
    try { await navigator.clipboard.writeText(text); notice(message); }
    catch { notice('Браузер не разрешил копирование. Выделите и скопируйте текст вручную.', 'error'); }
  }
  el('mw-copy-link').addEventListener('click', () => {
    if (!current) return;
    const url = new URL(window.location.href); url.searchParams.set('rule', current.id); url.hash = '';
    if (!localIds.has(current.id)) url.searchParams.set('official', '1');
    void copy(url.href, localIds.has(current.id)
      ? 'Ссылка скопирована. Локальные правки видны только в этом браузере; для их передачи скачайте файл правил.'
      : localPreview
        ? 'Ссылка скопирована. Локальный просмотр доступен на dev-сервере; на сайте нужен вход через Discord и подходящая роль.'
        : 'Ссылка скопирована. Для открытия статьи нужен вход через Discord и роль, которой доступно это правило.');
  });
  el('mw-download-rule').addEventListener('click', () => {
    if (!accessible || !current) return;
    const original = source.rules.find(rule => rule.id === current!.id);
    if (!original) return;
    const url = el<HTMLAnchorElement>('mw-original-link').href;
    const text = `# ${original.title}\n\nПравило Лиги · ${original.id} · редакция ${original.revision}\nСтатус: ${original.status === 'draft' ? 'черновик' : 'готовая статья'}\nИсточник: ${url}\nОбновлено: ${original.updated_at}\n\n${original.body}\n`;
    const downloadUrl = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = downloadUrl; link.download = `${original.id}-league-original.md`;
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  });
  function calculation(id: string, callback: (data: FormData) => string) {
    const toolForm = el<HTMLFormElement>(`mw-${id}-form`);
    toolForm.addEventListener('input', () => { el(`mw-${id}-result`).replaceChildren(); });
    toolForm.addEventListener('submit', event => {
      event.preventDefault();
      if (!toolForm.reportValidity()) return;
      const result = el(`mw-${id}-result`);
      try { result.innerHTML = callback(new FormData(toolForm)); result.dataset.kind = 'success'; }
      catch (error) { result.textContent = error instanceof Error ? error.message : 'Проверьте введённые значения.'; result.dataset.kind = 'error'; }
    });
  }
  const numeric = (data: FormData, key: string) => {
    const value = Number(data.get(key));
    if (!Number.isFinite(value) || value < 0) throw new Error('Введите конечное неотрицательное число.');
    return value;
  };
  calculation('reward', data => {
    const result = calculateRewardBudget(numeric(data, 'pool'), numeric(data, 'cap'), numeric(data, 'allocated'));
    return `Общий предел денежной награды от поселения: <strong>${number(result.cashLimit)} зм</strong> (минимум из 20% пула и потенциала).<br>${result.remaining < 0 ? `Превышение бюджета: <strong>${number(-result.remaining)} зм</strong>.` : `Нераспределённый остаток пула: <strong>${number(result.remaining)} зм</strong>.`}`;
  });
  el('mw-settlement').addEventListener('change', () => {
    el<HTMLInputElement>('mw-settlement-cap').value = String(settlements[Number(el<HTMLSelectElement>('mw-settlement').value)][1]);
    el('mw-reward-result').replaceChildren();
  });
  function itemPriceChanged() {
    const kind = el<HTMLSelectElement>('mw-item-kind').value;
    el<HTMLSelectElement>('mw-item-rarity').disabled = kind !== 'magic';
    el<HTMLInputElement>('mw-item-price').disabled = kind === 'bought';
    el('mw-item-price-label').firstChild!.textContent = kind === 'mundane' ? 'Базовая цена за штуку, зм' : 'Цена учёта за штуку, зм';
    if (kind === 'magic') el<HTMLInputElement>('mw-item-price').value = String(magicItemPoolPrices[Number(el<HTMLSelectElement>('mw-item-rarity').value)][1]);
    el('mw-item-result').replaceChildren();
  }
  el('mw-item-kind').addEventListener('change', itemPriceChanged);
  el('mw-item-rarity').addEventListener('change', itemPriceChanged);
  calculation('item', data => {
    const kind = String(data.get('kind'));
    if (kind === 'bought') return 'Вклад в пул: <strong>0 зм</strong>. Покупки за собственные деньги персонажей не считаются наградой.';
    const quantity = numeric(data, 'quantity');
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Введите целое количество не меньше 1.');
    const value = numeric(data, 'price') * quantity * (kind === 'mundane' ? .5 : 1);
    return `Стоимость в пуле: <strong>${number(value)} зм</strong>.<br>${kind === 'mundane' ? '50% базовой цены × количество.' : 'Цена учёта выбранной редкости × количество.'}`;
  });
  calculation('trade', data => {
    const result = calculateTrade(numeric(data, 'price'), numeric(data, 'quantity'), numeric(data, 'investigation'), numeric(data, 'persuasion'));
    if (!result.found) return 'Торговец не найден. Продажа не состоялась; стоимость ранее полученной добычи в пуле не меняется.';
    return `Выручка: <strong>${number(result.saleValue)} зм</strong>.<br>Стоимость добычи в пуле: <strong>${number(result.poolValue)} зм</strong>.<br>Прибыль сверх учтённой добычи: <strong>${number(result.extra)} зм</strong> — не увеличивает пул.${result.advantage ? '<br>Следующая проверка Убеждения — с Преимуществом.' : ''}`;
  });
  el('mw-dragon-mode').addEventListener('change', () => {
    el('mw-dragon-days-label').hidden = el<HTMLSelectElement>('mw-dragon-mode').value !== 'decay';
  });
  el('mw-dragon-form').addEventListener('input', () => {
    generatedText = '';
    el('mw-dragon-result').hidden = true;
    el('mw-generator-actions').hidden = true;
  });
  el<HTMLFormElement>('mw-dragon-form').addEventListener('submit', event => {
    event.preventDefault();
    const generatorForm = el<HTMLFormElement>('mw-dragon-form');
    if (!generatorForm.reportValidity()) return;
    try {
      const data = new FormData(generatorForm);
      const name = String(data.get('name') || '').trim();
      if (!name) throw new Error('Введите название предмета.');
      const mode = String(data.get('mode'));
      const stage = calculateDragonStage(numeric(data, 'stage'), numeric(data, 'age'), mode, numeric(data, 'days'));
      const die = data.get('quirk') === 'none' ? null : Math.floor(Math.random() * dragonQuirks.length);
      const reason: Record<string, string> = {
        none: 'Стадия не изменяется.', year: 'Предмет провёл год в сокровищнице; предел определяется возрастом дракона.',
        slain: 'Напитывание началось в первый час после убийства дракона: возможно повышение на одну стадию, но не выше предела его возраста.',
        decay: `Предмет ${numeric(data, 'days')} дней находился вне сокровищницы без настройки: одна потерянная стадия за каждые полные 30 дней.`
      };
      generatedText = `## ${name}\n\n**Тип:** предмет драконьей сокровищницы.\n\n**Исходная стадия:** ${dragonStages[numeric(data, 'stage')]}.\n\n**Текущая стадия:** ${dragonStages[stage]}.\n\n## Развитие\n${reason[mode]}\n\n## Причуда\n${die === null ? 'Без драконической причуды.' : `Бросок d8: ${die + 1}. ${dragonQuirks[die]}`}\n\n## Свойства по стадиям\nЗаполните свойства из описания выбранного магического предмета. Этот паспорт не добавляет новых боевых свойств и не является разрешением на выдачу.\n\n## Получение и учёт\nУкажите приключение, ролевое обоснование и стоимость в пуле наград.\n\n[Правила предметов сокровищниц](/test/cabinet/master/?rule=dragon-hoard-items)`;
      el('mw-dragon-result').innerHTML = renderRuleMarkdown(generatedText, 'generated').html;
      el('mw-dragon-result').hidden = false;
      el('mw-generator-actions').hidden = false;
    } catch (error) { notice(error instanceof Error ? error.message : 'Проверьте данные предмета.', 'error'); }
  });
  el('mw-copy-generated').addEventListener('click', () => { if (generatedText) void copy(generatedText, 'Паспорт предмета скопирован.'); });
  el('mw-generated-draft').addEventListener('click', () => {
    if (!generatedText) return;
    if (!edit(null, undefined, generatedText)) return;
    categoryInput.value = 'items';
    titleInput.value = String(new FormData(el<HTMLFormElement>('mw-dragon-form')).get('name') || '').slice(0, 180);
    summaryInput.value = 'Паспорт прогрессирующего предмета драконьей сокровищницы.';
    storeDraft();
  });

  if (await loadRules()) {
    const id = new URL(window.location.href).searchParams.get('rule');
    if (id) {
      const hash = window.location.hash.slice(1);
      openRule(id, false);
      if (/^rule-heading-\d+$/.test(hash)) document.getElementById(hash)?.scrollIntoView();
    }
  }
}
