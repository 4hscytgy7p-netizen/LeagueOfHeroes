import type { BookSearchEntry } from '../types/book';
import { bookSearchExcerpt, findBookEntries } from '../utils/bookSearch';

const reader = document.querySelector<HTMLElement>('[data-book-reader]');
if (reader) initializeReader(reader);

function initializeReader(reader: HTMLElement) {
  const bookId = reader.dataset.bookId!;
  const sectionId = reader.dataset.sectionId || '';
  const sourceSha256 = reader.dataset.bookSource;
  const content = reader.querySelector<HTMLElement>('.book-content');
  const sectionIds = new Set(Array.from(reader.querySelectorAll<HTMLAnchorElement>('.book-toc a'))
    .map((link) => new URL(link.href).pathname.split('/').filter(Boolean).pop()!));
  const sectionPages = new Map(Array.from(reader.querySelectorAll<HTMLAnchorElement>('.book-toc a'))
    .map((link) => [new URL(link.href).pathname.split('/').filter(Boolean).pop()!,
      new Set((link.dataset.bookPages || '').split(',').map(Number))] as const));
  const navigation = reader.querySelector<HTMLDetailsElement>('.book-navigation');
  if (navigation && window.matchMedia('(max-width: 767px)').matches) navigation.open = false;

  function readStore(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function writeStore(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* Reading stays available without storage. */ }
  }

  const controls = reader.querySelector<HTMLElement>('[data-reader-controls]');
  const sizeOutput = reader.querySelector<HTMLOutputElement>('[data-font-size]');
  const fontButtons = Array.from(reader.querySelectorAll<HTMLButtonElement>('[data-font-change]'));
  let fontSize = Number(readStore('loh.books.fontSize') || 18);
  if (!Number.isFinite(fontSize)) fontSize = 18;
  function applyFontSize() {
    fontSize = Math.max(15, Math.min(24, fontSize));
    reader.style.setProperty('--book-font-size', `${fontSize}px`);
    if (sizeOutput) sizeOutput.value = String(fontSize);
    for (const button of fontButtons) button.disabled = Number(button.dataset.fontChange) < 0 ? fontSize <= 15 : fontSize >= 24;
  }
  applyFontSize();
  if (controls && content) controls.hidden = false;
  for (const button of fontButtons) button.addEventListener('click', () => {
    fontSize += Number(button.dataset.fontChange);
    applyFontSize();
    writeStore('loh.books.fontSize', String(fontSize));
  });

  const progressKey = `loh.books.progress.${bookId}`;
  const resume = reader.querySelector<HTMLAnchorElement>('[data-book-resume]');
  try {
    const progress = JSON.parse(readStore(progressKey) || 'null');
    if (resume && progress && sectionIds.has(progress.sectionId)
        && typeof progress.anchor === 'string' && /^p\d+-\d+$/.test(progress.anchor)
        && Number.isInteger(progress.page) && progress.page > 0
        && sectionPages.get(progress.sectionId)?.has(progress.page)
        && progress.anchor.startsWith(`p${progress.page}-`)
        && (!progress.sourceSha256 || progress.sourceSha256 === sourceSha256)) {
      resume.href = `/books/${bookId}/${progress.sectionId}/#${progress.anchor}`;
      resume.textContent = `Продолжить со страницы ${progress.page} →`;
      resume.hidden = false;
    }
  } catch { /* Ignore an old or malformed saved position. */ }

  if (content && sectionId) {
    const anchors = Array.from(content.querySelectorAll<HTMLElement>('[data-reading-anchor]'));
    let scheduled = false;
    let savedAnchor = '';
    function savePosition() {
      scheduled = false;
      let current = anchors[0];
      for (const anchor of anchors) {
        if (anchor.getBoundingClientRect().top <= 180) current = anchor;
        else break;
      }
      const page = Number(current?.closest<HTMLElement>('[data-book-page]')?.dataset.bookPage);
      if (current && page && current.id !== savedAnchor) {
        writeStore(progressKey, JSON.stringify({ sectionId, anchor: current.id, page, sourceSha256 }));
        savedAnchor = current.id;
      }
    }
    window.addEventListener('scroll', () => {
      if (!scheduled) { scheduled = true; window.requestAnimationFrame(savePosition); }
    }, { passive: true });
    window.addEventListener('pagehide', savePosition);
  }

  const search = reader.querySelector<HTMLElement>('[data-book-search]');
  const input = reader.querySelector<HTMLInputElement>('#book-search-input');
  const results = reader.querySelector<HTMLOListElement>('#book-search-results');
  const status = reader.querySelector<HTMLElement>('#book-search-status');
  if (!search || !input || !results || !status) return;
  search.hidden = false;
  let index: Promise<BookSearchEntry[]> | undefined;
  let revision = 0;
  let timeout: ReturnType<typeof setTimeout>;

  function loadIndex() {
    if (!index) index = fetch(`/books/${bookId}/search.json`).then(async (response) => {
      if (!response.ok) throw new Error('Search unavailable');
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid search index');
      return data.filter((entry): entry is BookSearchEntry => entry && typeof entry.text === 'string'
        && sectionIds.has(entry.sectionId) && typeof entry.sectionTitle === 'string'
        && /^p\d+-\d+$/.test(entry.anchor) && Number.isInteger(entry.page) && entry.page > 0);
    }).catch((error) => { index = undefined; throw error; });
    return index;
  }

  function highlight(query: string) {
    if (!content) return;
    for (const mark of content.querySelectorAll('mark[data-book-match]')) mark.replaceWith(document.createTextNode(mark.textContent || ''));
    content.normalize();
    const terms = [...new Set(query.trim().split(/\s+/).filter((term) => term.length >= 2))];
    if (!terms.length) return;
    const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[её]/gi, '[её]'));
    const pattern = new RegExp(escaped.sort((a, b) => b.length - a.length).join('|'), 'giu');
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      const text = node.data;
      const matches = Array.from(text.matchAll(pattern));
      if (!matches.length) continue;
      const fragment = document.createDocumentFragment();
      let offset = 0;
      for (const match of matches) {
        fragment.append(document.createTextNode(text.slice(offset, match.index)));
        const mark = document.createElement('mark');
        mark.dataset.bookMatch = '';
        mark.textContent = match[0];
        fragment.append(mark);
        offset = match.index! + match[0].length;
      }
      fragment.append(document.createTextNode(text.slice(offset)));
      node.replaceWith(fragment);
    }
  }

  async function searchBook() {
    const token = ++revision;
    const query = input!.value.trim();
    results!.replaceChildren();
    results!.hidden = true;
    highlight(query.length >= 2 ? query : '');
    if (query.length < 2) { status!.textContent = query ? 'Введите хотя бы два символа.' : ''; return; }
    status!.textContent = 'Ищем в доступных разделах…';
    try {
      const entries = await loadIndex();
      if (token !== revision) return;
      const matches = findBookEntries(entries, query);
      for (const entry of matches) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        const title = document.createElement('strong');
        title.textContent = `${entry.sectionTitle} · стр. ${entry.pageLabel || entry.page}`;
        const excerpt = document.createElement('span');
        excerpt.textContent = bookSearchExcerpt(entry.text, query);
        link.href = `/books/${bookId}/${entry.sectionId}/?q=${encodeURIComponent(query)}#${entry.anchor}`;
        link.append(title, excerpt);
        item.append(link);
        results!.append(item);
      }
      results!.hidden = matches.length === 0;
      status!.textContent = matches.length ? `Результатов: ${matches.length}${matches.length === 15 ? ' (первые 15)' : ''}` : 'В доступных разделах ничего не найдено.';
    } catch {
      if (token === revision) status!.textContent = 'Поиск временно недоступен. Попробуйте ещё раз.';
    }
  }
  input.addEventListener('input', () => {
    revision++;
    clearTimeout(timeout);
    timeout = setTimeout(searchBook, 180);
  });
  const initialQuery = new URLSearchParams(location.search).get('q');
  if (initialQuery) { input.value = initialQuery; searchBook(); }
}
