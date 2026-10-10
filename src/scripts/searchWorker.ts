import { findSiteResults, normalizeSearchText, prepareSearchEntries, safeSearchUrl } from '../utils/siteSearch.ts';
import type { PreparedSearchEntry } from '../utils/siteSearch.ts';
import type { SearchBook, SearchEntry, SearchManifest, SearchRequest, SearchResponse } from '../types/search.ts';
import type { BookSearchEntry } from '../types/book.ts';
import { parseMaterialSource } from '../utils/materialCatalog.ts';

const cache = new Map<string, Promise<unknown>>();
const prepared = new Map<string, Promise<PreparedSearchEntry[]>>();
function fetchJSON<T>(url: string): Promise<T> {
  if (!cache.has(url)) cache.set(url, fetch(url, { cache: 'no-cache' }).then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }).catch(error => { cache.delete(url); throw error; }));
  return cache.get(url)! as Promise<T>;
}
function loadEntries(url: string, book?: SearchBook): Promise<PreparedSearchEntry[]> {
  if (!prepared.has(url)) prepared.set(url, (async () => {
    let entries: SearchEntry[];
    if (book) {
      const blocks = await fetchJSON<BookSearchEntry[]>(url);
      entries = blocks.map((block, index) => ({ id: `fragment:${book.id}:${index}`, kind: 'book',
        title: block.kind === 'heading' ? block.text.slice(0, 160) : block.sectionTitle,
        url: `/books/${book.id}/${encodeURIComponent(block.sectionId)}/#${encodeURIComponent(block.anchor)}`,
        source: parseMaterialSource(`${book.id.startsWith('phb') ? 'PHB' : 'DMG'}${book.edition}`).label, edition: book.edition, location: `${book.title} · с. ${block.pageLabel || block.page}`,
        aliases: [book.id.startsWith('phb') ? 'PHB' : 'DMG'], text: block.text }));
    } else entries = await fetchJSON<SearchEntry[]>(url);
    const documents = prepareSearchEntries(entries.filter(entry => safeSearchUrl(entry.url)));
    cache.delete(url); // Normalized documents suffice; release the raw book JSON.
    return documents;
  })().catch(error => { prepared.delete(url); cache.delete(url); throw error; }));
  return prepared.get(url)!;
}
async function search(request: SearchRequest): Promise<SearchResponse> {
  if (normalizeSearchText(request.query).length < 2) return { id: request.id, results: [], total: 0, incomplete: false };
  const manifest = await fetchJSON<SearchManifest>('/search-index/manifest.json');
  const sources = [loadEntries(request.mode === 'quick' ? manifest.titlesUrl : manifest.catalogUrl)];
  if (request.mode === 'full' && (!request.filters.kinds?.length || request.filters.kinds.includes('book'))) {
    for (const book of manifest.books) {
      if (request.filters.edition && request.filters.edition !== book.edition) continue;
      if (request.filters.source && request.filters.source !== parseMaterialSource(`${book.id.startsWith('phb') ? 'PHB' : 'DMG'}${book.edition}`).label) continue;
      sources.push(loadEntries(book.url, book));
    }
  }
  const loaded = await Promise.allSettled(sources);
  const entries = loaded.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  const incomplete = loaded.some(result => result.status === 'rejected');
  const found = findSiteResults(entries, request.query, request.filters, Math.min(request.limit, 500));
  // Full descriptions stay inside the worker, never copied to the UI per result.
  return { id: request.id, total: found.total, incomplete, results: found.results.map(result => ({ ...result, entry: { ...result.entry, text: '' } })),
    ...(incomplete ? { error: 'Часть поиска недоступна. Проверьте соединение и повторите поиск.' } : {}) };
}
const worker = self as unknown as { addEventListener(type: 'message', callback: (event: MessageEvent<SearchRequest>) => void): void; postMessage(message: SearchResponse): void };
worker.addEventListener('message', event => {
  const request = event.data;
  search(request).then(result => worker.postMessage(result)).catch(() => worker.postMessage({ id: request.id, results: [], total: 0, incomplete: true, error: 'Не удалось загрузить поиск. Проверьте соединение и повторите попытку.' }));
});
