export function normalizeItemSearch(value: string): string {
    return value.normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }  