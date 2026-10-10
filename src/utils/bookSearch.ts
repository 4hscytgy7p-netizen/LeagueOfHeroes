import type { BookSearchEntry } from '../types/book.ts';

export function normalizeBookText(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

export function findBookEntries(entries: BookSearchEntry[], query: string, limit = 15): BookSearchEntry[] {
  const phrase = normalizeBookText(query);
  if (phrase.length < 2) return [];
  const terms = phrase.split(' ');
  return entries.map((entry, position) => {
    const text = normalizeBookText(`${entry.sectionTitle} ${entry.text}`);
    if (!terms.every((term) => text.includes(term))) return null;
    const score = (normalizeBookText(entry.text).includes(phrase) ? 4 : 0)
      + (normalizeBookText(entry.sectionTitle).includes(phrase) ? 2 : 0)
      + (entry.kind === 'heading' && normalizeBookText(entry.text).includes(phrase) ? 8 : 0);
    return { entry, score, position };
  }).filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .slice(0, Math.max(0, limit)).map((value) => value.entry);
}

export function bookSearchExcerpt(text: string, query: string, length = 175): string {
  const normalized = normalizeBookText(text);
  const term = normalizeBookText(query).split(' ')[0];
  const match = normalized.indexOf(term);
  const start = Math.max(0, match - 50);
  return `${start ? '…' : ''}${text.slice(start, start + length).trim()}${start + length < text.length ? '…' : ''}`;
}
