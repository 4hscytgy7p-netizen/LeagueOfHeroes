export interface BookSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  tone?: 'narrator' | 'player';
}

export interface BookSectionSummary {
  id: string;
  title: string;
  description: string;
  sourcePages: number[];
  group?: string;
}

export interface Book {
  id: string;
  title: string;
  subtitle: string;
  edition: string;
  language: string;
  description: string;
  status: 'partial' | 'complete';
  totalPages: number;
  importedPages: number[];
  sourceSha256: string;
  sections: BookSectionSummary[];
  coverageLabel?: string;
  sourceNote?: string;
  pageLabels?: Record<string, string>;
  cover?: { src: string; alt: string; width: number; height: number };
}

export type BookBlock = (
  | { kind: 'paragraph'; spans: BookSpan[]; style?: 'attribute' | 'reference'; link?: string; targetPage?: number }
  | { kind: 'heading'; level: 2 | 3 | 4; spans: BookSpan[]; link?: string; targetPage?: number }
  | { kind: 'list'; ordered: boolean; start?: number; items: BookSpan[][] }
  | { kind: 'table'; headers: string[]; rows: string[][]; caption?: string }
  | { kind: 'callout'; blocks: BookBlock[] }
  | { kind: 'image'; src: string; smallSrc?: string; smallWidth?: number; alt: string; width: number; height: number; caption?: string; zoom?: boolean; text?: string; textLabel?: string }
) & { id?: string; sourcePage?: number };

export interface BookSection extends BookSectionSummary {
  bookId: string;
  pages: { number: number; blocks: BookBlock[] }[];
}

export interface BookSearchEntry {
  sectionId: string;
  sectionTitle: string;
  page: number;
  pageLabel?: string;
  anchor: string;
  text: string;
  kind?: BookBlock['kind'];
}
