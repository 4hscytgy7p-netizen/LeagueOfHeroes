export type MaterialEdition = '2014' | '2024' | 'unspecified';
export type MaterialKind = 'class' | 'subclass' | 'species' | 'species-variant' | 'background' | 'feat' | 'spell' | 'item' | 'magic-item';
export type MaterialStatus = 'allowed' | 'modified' | 'superseded';

export interface MaterialSource {
  id: string;
  code: string;
  edition: MaterialEdition;
  label: string;
}

export interface MaterialInput {
  id: string;
  kind: MaterialKind;
  name: string;
  nameEn: string;
  href: string;
  source?: string;
  sourcePage?: number;
  parent?: string;
  comparisonGroup?: string;
}

export interface MaterialReference {
  kind: MaterialKind;
  id: string;
}

export interface MaterialErrata {
  href: string;
  note?: string;
}

export interface MaterialAnnotation extends MaterialReference {
  errata?: MaterialErrata[];
  /** null disables automatic replacement for this material. */
  replacedBy?: MaterialReference | null;
}

export interface PublishedMaterial extends MaterialInput {
  sourceInfo: MaterialSource;
  status: MaterialStatus;
  errata: MaterialErrata[];
  ruleHref?: string;
  preferredHref?: string;
  preferredName?: string;
  searchText: string;
}
