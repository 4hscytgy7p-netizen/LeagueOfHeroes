import type { SearchEntry, SearchFilters, SearchKind, SearchResult } from '../types/search.ts';

export const searchKindLabels: Record<SearchKind, string> = {
  class: 'Класс', subclass: 'Подкласс', feature: 'Особенность', species: 'Вид', background: 'Предыстория', feat: 'Черта',
  spell: 'Заклинание', item: 'Предмет', 'magic-item': 'Магический предмет', glossary: 'Глоссарий', rule: 'Правило', deity: 'Божество', book: 'Книга',
};
export const searchSynonyms: readonly (readonly string[])[] = [
  ['кз', 'кд', 'ac', 'класс защиты', 'класс доспеха', 'armor class'], ['бм', 'pb', 'бонус мастерства', 'proficiency bonus'],
  ['сл', 'dc', 'сложность', 'difficulty class'], ['по', 'cr', 'показатель опасности', 'challenge rating'],
  ['хиты', 'hp', 'очки здоровья', 'hit points'], ['дп', 'дни простоя', 'downtime'], ['оп', 'очки прогресса'],
  ['огненный шар', 'fireball'], ['мистический заряд', 'eldritch blast'], ['поиск фамильяра', 'обретение фамильяра', 'find familiar'],
  ['договор цепи', 'pact of the chain'], ['дикий облик', 'wild shape'],
  ['атака по возможности', 'провоцированная атака', 'opportunity attack', 'oa'],
  ['сбитый с ног', 'лежащий ничком', 'опрокинутый', 'prone'], ['истощение', 'exhaustion'],
  ['недееспособный', 'incapacitated'], ['концентрация', 'concentration'],
  ['phb', 'книга игрока', 'players handbook', 'player handbook'], ['dmg', 'руководство мастера', 'dungeon masters guide'],
];
export function normalizeSearchText(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[’'`]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function stem(word: string): string {
  if (!/^[а-я]{6,}$/.test(word)) return word;
  return word.replace(/(?:иями|ями|ами|ого|ему|ому|ией|иям|иях|ах|ях|ий|ый|ая|яя|ое|ее|ые|ие|ой|ей|ом|ем|ам|ям|ов|ев|а|я|ы|и|у|ю|е|о)$/u, '');
}
const synonymGroups = searchSynonyms.map(group => group.map(normalizeSearchText));
function alternatives(phrase: string): string[] {
  const group = synonymGroups.find(group => group.includes(phrase));
  // «по» is also a common preposition: a standalone CR query must not match it everywhere.
  return group ? group.filter(option => option !== 'по') : [phrase];
}
export function searchQueryGroups(query: string): string[][] {
  const normalized = normalizeSearchText(query.slice(0, 160));
  if (!normalized) return [];
  const group = alternatives(normalized);
  return group.length > 1 ? [group] : normalized.split(' ').slice(0, 12).map(term => term === 'по' ? [term] : alternatives(term));
}
export interface PreparedSearchEntry { entry: SearchEntry; title: string; english: string; aliases: string[]; metadata: string; body: string; }
export function prepareSearchEntries(entries: SearchEntry[]): PreparedSearchEntry[] {
  return entries.map(entry => ({ entry, title: normalizeSearchText(entry.title), english: normalizeSearchText(entry.nameEn || ''),
    aliases: (entry.aliases || []).map(normalizeSearchText), metadata: normalizeSearchText(`${entry.source} ${entry.edition || ''} ${entry.location || ''} ${searchKindLabels[entry.kind]}`), body: normalizeSearchText(entry.text) }));
}
function contains(text: string, phrase: string): boolean {
  if (phrase.length <= 3) return ` ${text} `.includes(` ${phrase} `);
  if (text.includes(phrase)) return true;
  const terms = phrase.split(' ');
  return terms.every(term => { const root = stem(term); return root.length >= 4 && (` ${text}`).includes(` ${root}`); });
}
export function searchExcerpt(text: string, query: string, limit = 185): string {
  // Case and ё/е folding preserve offsets; punctuation normalization is only for matching.
  const folded = text.toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const candidates = searchQueryGroups(query).flat();
  let position = candidates.reduce((best, term) => { const at = folded.indexOf(term); return at < 0 ? best : Math.min(best, at); }, Infinity);
  if (!Number.isFinite(position)) position = 0;
  const start = Math.max(0, position - 45);
  return `${start ? '…' : ''}${text.slice(start, start + limit).trim()}${start + limit < text.length ? '…' : ''}`;
}
export function findSiteResults(prepared: PreparedSearchEntry[], query: string, filters: SearchFilters = {}, limit = 40): { results: SearchResult[]; total: number } {
  const phrase = normalizeSearchText(query.slice(0, 160));
  if (phrase.length < 2) return { results: [], total: 0 };
  const groups = searchQueryGroups(query);
  const whole = alternatives(phrase);
  const results: SearchResult[] = [];
  for (const doc of prepared) {
    const entry = doc.entry;
    if (filters.kinds?.length && !filters.kinds.includes(entry.kind)) continue;
    if (filters.edition && entry.edition !== filters.edition) continue;
    if (filters.source && entry.source !== filters.source) continue;
    const fields = [doc.title, doc.english, ...doc.aliases, doc.metadata, doc.body];
    if (!groups.every(group => group.some(option => fields.some(field => contains(field, option))))) continue;
    const exact = whole.some(option => doc.title === option || doc.english === option);
    const alias = whole.some(option => doc.aliases.includes(option));
    const titleMatch = groups.every(group => group.some(option => contains(doc.title, option) || contains(doc.english, option)));
    const prefix = whole.some(option => doc.title.startsWith(option) || !!doc.english && doc.english.startsWith(option));
    let score = exact ? 1000 : alias ? 950 : prefix ? 800 : titleMatch ? 650 : 100;
    if (entry.kind === 'book') score -= 20;
    // Public League rules and newer editions break ties; they never outrank an exact name match.
    if (entry.kind === 'rule') score += 5;
    if (entry.edition === '2024') score += 3;
    results.push({ entry, score, excerpt: searchExcerpt(entry.text, query) });
  }
  results.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'ru') || a.entry.id.localeCompare(b.entry.id));
  return { results: results.slice(0, Math.max(0, limit)), total: results.length };
}
export function safeSearchUrl(url: string): boolean {
  if (!/^\/(?!\/)/.test(url) || /[\u0000-\u0020\\]/.test(url)) return false;
  try {
    const path = decodeURIComponent(new URL(url, 'https://league.local').pathname);
    return !/[\u0000-\u001f\\]/.test(path) && !path.startsWith('//') && !/^\/(?:test|internal|masters-rules|api)(?:\/|$)/i.test(path);
  } catch { return false; }
}
