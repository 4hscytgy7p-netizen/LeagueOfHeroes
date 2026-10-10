export interface DeitySourceRecord {
  name: string;
  pantheon: string;
  source: string;
  page?: number;
  alignment: string[];
  domains: string[];
  title: string;
  province: string;
  symbol: string;
  category: string;
  altNames: string[];
  reprintAlias: string | string[];
  hasLore: boolean;
}

export interface DeitySnapshot {
  catalogUrl: string;
  upstreamUrl: string;
  importedAt: string;
  sha256: string;
  excludedSources: string[];
  upstreamCount: number;
  excludedCount: number;
  sources: { code: string; name: string; published: string }[];
  records: DeitySourceRecord[];
}

export interface DeityVersion {
  originalName: string;
  originalPantheon: string;
  source: string;
  sourceName: string;
  category: string;
  published: string;
  page?: number;
  href: string;
  alignment: string;
  domains: string[];
  title: string;
  portfolio: string;
  symbol: string;
  hasLore: boolean;
  summary: string;
}

export interface Deity {
  id: string;
  name: string;
  originalName: string;
  aliases: string[];
  pantheon: string;
  description: string;
  versions: DeityVersion[];
  reference: DeityVersion;
}
