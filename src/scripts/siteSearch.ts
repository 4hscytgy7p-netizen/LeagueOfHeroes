import { normalizeSearchText, safeSearchUrl, searchKindLabels } from '../utils/siteSearch.ts';
import type { SearchKind, SearchManifest, SearchRequest, SearchResponse, SearchResult } from '../types/search.ts';

let worker: Worker | undefined;
let serial = 0;
const waiting = new Map<number, (response: SearchResponse) => void>();
function requestSearch(request: Omit<SearchRequest, 'id'>, receive: (response: SearchResponse) => void): number {
  const id = ++serial;
  try {
    if (!worker) {
      worker = new Worker(new URL('./searchWorker.ts', import.meta.url), { type: 'module' });
      worker.addEventListener('message', (event: MessageEvent<SearchResponse>) => {
        const callback = waiting.get(event.data.id);
        waiting.delete(event.data.id);
        callback?.(event.data);
      });
      worker.addEventListener('error', () => {
        worker?.terminate(); worker = undefined;
        for (const [pendingId, callback] of waiting) callback({ id: pendingId, total: 0, results: [], incomplete: true, error: 'Не удалось запустить поиск. Повторите попытку.' });
        waiting.clear();
      });
    }
    waiting.set(id, receive);
    worker.postMessage({ ...request, id });
  } catch {
    window.setTimeout(() => receive({ id, total: 0, results: [], incomplete: true, error: 'Поиск не поддерживается этим браузером. Попробуйте обновить браузер.' }), 0);
  }
  return id;
}
function element(tag: string, className: string, text: string): HTMLElement {
  const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
}
function renderResults(list: HTMLOListElement, results: SearchResult[]) {
  const fragment = document.createDocumentFragment();
  for (const { entry, excerpt } of results) {
    if (!safeSearchUrl(entry.url)) continue;
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = entry.url; link.className = 'site-search-result';
    link.append(element('span', 'site-search-result-title', entry.title));
    if (entry.nameEn) link.append(element('span', 'site-search-result-en', entry.nameEn));
    const meta = element('span', 'site-search-result-meta', '');
    meta.append(element('span', 'site-search-result-kind', searchKindLabels[entry.kind]));
    meta.append(element('span', '', entry.source));
    if (entry.edition && !entry.source.includes(entry.edition)) meta.append(element('span', '', entry.edition));
    if (entry.location) meta.append(element('span', '', entry.location));
    link.append(meta);
    if (excerpt) link.append(element('span', 'site-search-result-excerpt', excerpt));
    li.append(link); fragment.append(li);
  }
  list.replaceChildren(fragment);
}
function initializeSearch(root: HTMLElement, mode: 'quick' | 'full') {
  const input = root.querySelector<HTMLInputElement>('input[type="search"]')!;
  const list = root.querySelector<HTMLOListElement>('[data-search-results]')!;
  const status = root.querySelector<HTMLElement>('[data-search-status]')!;
  const retry = root.querySelector<HTMLButtonElement>('[data-search-retry]')!;
  const more = root.querySelector<HTMLButtonElement>('[data-search-more]');
  const allResults = root.querySelector<HTMLAnchorElement>('[data-all-results]');
  const kind = root.querySelector<HTMLSelectElement>('[data-search-kind]');
  const edition = root.querySelector<HTMLSelectElement>('[data-search-edition]');
  const source = root.querySelector<HTMLSelectElement>('[data-search-source]');
  let limit = mode === 'quick' ? 8 : 40;
  let current = 0;
  let timer = 0;
  let desiredSource = '';
  function updateURL(push = false) {
    if (mode !== 'full') return;
    const url = new URL(window.location.href);
    for (const [key, value] of [['q', input.value.trim().slice(0, 160)], ['kind', kind?.value || ''], ['edition', edition?.value || ''], ['source', source?.value || '']]) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    if (url.href !== window.location.href) window.history[push ? 'pushState' : 'replaceState'](null, '', url);
  }
  function invalidate() {
    window.clearTimeout(timer);
    waiting.delete(current); current = 0;
  }
  function search() {
    invalidate();
    const query = input.value.trim().slice(0, 160);
    if (allResults) allResults.href = query ? `/search?${new URLSearchParams({ q: query })}` : '/search';
    if (normalizeSearchText(query).length < 2) {
      list.replaceChildren(); status.textContent = 'Введите хотя бы 2 символа.'; retry.hidden = true;
      if (more) more.hidden = true;
      return;
    }
    status.textContent = mode === 'full' ? 'Ищем в справочнике и выбранных источниках…' : 'Ищем…';
    list.setAttribute('aria-busy', 'true'); retry.hidden = true;
    if (more) more.hidden = true;
    current = requestSearch({ query, mode, limit, filters: { kinds: kind?.value ? [kind.value as SearchKind] : [], edition: edition?.value || '', source: source?.value || '' } }, response => {
      if (response.id !== current) return;
      list.removeAttribute('aria-busy');
      renderResults(list, response.results);
      status.textContent = response.error ? `${response.error}${response.results.length ? ` Показано: ${response.results.length}.` : ''}`
        : response.total ? `Найдено: ${response.total}. Показано: ${response.results.length}.${response.total > 500 && limit >= 500 ? ' Уточните запрос или фильтры, чтобы сузить выдачу.' : ''}`
          : 'Ничего не найдено. Попробуйте другое название или уберите фильтры.';
      retry.hidden = !response.incomplete;
      if (more) more.hidden = response.results.length >= response.total || limit >= 500;
    });
  }
  input.addEventListener('input', () => {
    invalidate(); limit = mode === 'quick' ? 8 : 40;
    list.replaceChildren(); list.removeAttribute('aria-busy'); retry.hidden = true;
    if (more) more.hidden = true;
    if (allResults) allResults.href = `/search?${new URLSearchParams({ q: input.value.trim().slice(0, 160) })}`;
    updateURL();
    status.textContent = normalizeSearchText(input.value).length >= 2 ? 'Ищем…' : 'Введите хотя бы 2 символа.';
    timer = window.setTimeout(search, 160);
  });
  retry.addEventListener('click', search);
  more?.addEventListener('click', () => { limit += 40; search(); });
  root.addEventListener('keydown', event => {
    if (mode !== 'quick' || !['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
    const links = [...list.querySelectorAll<HTMLAnchorElement>('a')];
    if (event.key === 'Enter' && event.target === input) {
      event.preventDefault(); window.location.assign(links[0]?.href || allResults!.href); return;
    }
    if (event.target !== input && !links.includes(event.target as HTMLAnchorElement)) return;
    if (event.key !== 'Enter' && links.length) {
      event.preventDefault();
      const index = links.indexOf(document.activeElement as HTMLAnchorElement);
      const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
      if (next < 0) input.focus(); else links[Math.min(next, links.length - 1)].focus();
    }
  });
  if (mode === 'full') {
    function restoreURL() {
      const params = new URLSearchParams(window.location.search);
      input.value = (params.get('q') || '').slice(0, 160);
      const selectedKind = params.get('kind') || '';
      if (kind) kind.value = Object.hasOwn(searchKindLabels, selectedKind) ? selectedKind : '';
      if (edition) edition.value = ['2014', '2024'].includes(params.get('edition') || '') ? params.get('edition')! : '';
      desiredSource = params.get('source') || '';
      if (source) {
        if (desiredSource && ![...source.options].some(option => option.value === desiredSource)) source.add(new Option(desiredSource, desiredSource));
        source.value = desiredSource;
      }
      limit = 40; search();
    }
    root.querySelector('form')!.addEventListener('submit', event => { event.preventDefault(); limit = 40; updateURL(true); search(); });
    for (const select of [kind, edition, source]) select?.addEventListener('change', () => { desiredSource = source?.value || ''; limit = 40; updateURL(true); search(); });
    window.addEventListener('popstate', restoreURL);
    restoreURL();
    // Only the search page needs filter metadata. Header search stays idle until requested.
    let filtersLoaded = false;
    function loadFilterMetadata() {
      if (filtersLoaded) return;
      fetch('/search-index/manifest.json', { cache: 'no-cache' }).then(async response => {
        if (!response.ok) throw new Error('Cannot load filters');
        return response.json() as Promise<SearchManifest>;
      }).then(manifest => {
        if (!source) return;
        source.replaceChildren(new Option('Все источники', ''), ...manifest.sources.map(label => new Option(label, label)));
        filtersLoaded = true;
        source.value = manifest.sources.includes(desiredSource) ? desiredSource : '';
        if (desiredSource && !source.value) { desiredSource = ''; updateURL(); search(); }
      }).catch(() => { /* Search reports any load failure and can be retried. */ });
    }
    loadFilterMetadata();
    retry.addEventListener('click', loadFilterMetadata);
  }
  return search;
}
const dialog = document.querySelector<HTMLDialogElement>('[data-quick-search]');
if (dialog) {
  const search = initializeSearch(dialog, 'quick');
  let opener: HTMLElement | null = null;
  function open(event?: Event) {
    if (!dialog || typeof dialog.showModal !== 'function') return;
    event?.preventDefault();
    if (!dialog.open) {
      opener = document.activeElement as HTMLElement;
      dialog.showModal(); document.documentElement.classList.add('site-search-open');
    }
    dialog.querySelector<HTMLInputElement>('input')?.focus(); search();
  }
  for (const trigger of document.querySelectorAll<HTMLAnchorElement>('[data-open-search]')) trigger.addEventListener('click', event => {
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) open(event);
  });
  document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && !event.altKey && event.code === 'KeyK') open(event); });
  dialog.querySelector('[data-close-search]')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { document.documentElement.classList.remove('site-search-open'); opener?.focus(); });
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  const shortcut = document.querySelector('[data-search-shortcut]');
  if (shortcut && /Macintosh|Mac OS|iPhone|iPad/.test(navigator.userAgent)) shortcut.textContent = '⌘ K';
}
const fullPage = document.querySelector<HTMLElement>('[data-full-search]');
if (fullPage) initializeSearch(fullPage, 'full');
