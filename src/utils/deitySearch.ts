export interface FaithSearchVersion {
  source: string;
  alignment: string;
  domains: string[];
  portfolio: string;
  text: string;
}

export interface FaithSearchEntry {
  kind: 'deity' | 'patron';
  pantheon: string;
  text: string;
  versions: FaithSearchVersion[];
}

export interface FaithFilters {
  q: string;
  kind: string;
  pantheon: string;
  source: string;
  alignment: string;
  domain: string;
  portfolio: string;
}

export const emptyFaithFilters: FaithFilters = { q: '', kind: '', pantheon: '', source: '', alignment: '', domain: '', portfolio: '' };

export function normalizeFaithText(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function containsWords(text: string, query: string): boolean {
  const normalized = normalizeFaithText(text);
  return normalizeFaithText(query).split(' ').filter(Boolean).every(word => normalized.includes(word));
}

// All version-specific filters must match one publication, without mixing conflicting editions.
export function matchesFaithEntry(entry: FaithSearchEntry, filters: FaithFilters): boolean {
  if (filters.kind && entry.kind !== filters.kind) return false;
  if (filters.pantheon && entry.pantheon !== filters.pantheon) return false;
  return entry.versions.some(version =>
    (!filters.source || version.source === filters.source)
    && (!filters.alignment || version.alignment === filters.alignment)
    && (!filters.domain || version.domains.includes(filters.domain))
    && containsWords(version.portfolio, filters.portfolio)
    && containsWords(`${entry.text} ${version.text}`, filters.q)
  );
}
