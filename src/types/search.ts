export type SearchKind = 'class' | 'subclass' | 'feature' | 'species' | 'background' | 'feat' | 'spell' | 'item' | 'magic-item' | 'glossary' | 'rule' | 'deity' | 'book';
export interface SearchEntry {
  id: string;
  kind: SearchKind;
  title: string;
  nameEn?: string;
  aliases?: string[];
  url: string;
  source: string;
  location?: string;
  edition?: '2014' | '2024';
  text: string;
}
export interface SearchFilters { kinds?: SearchKind[]; edition?: string; source?: string; }
export interface SearchResult { entry: SearchEntry; score: number; excerpt: string; }
export interface SearchBook { id: string; title: string; edition: '2014' | '2024'; url: string; }
export interface SearchManifest { version: 1; catalogUrl: string; titlesUrl: string; books: SearchBook[]; sources: string[]; counts: Partial<Record<SearchKind, number>>; }
export interface SearchRequest { id: number; query: string; mode: 'quick' | 'full'; filters: SearchFilters; limit: number; }
export interface SearchResponse { id: number; results: SearchResult[]; total: number; incomplete: boolean; error?: string; }
