import type { Book, BookBlock, BookSection } from '../types/book.ts';

export interface ExplorationRuleDefinition {
  id: string;
  title: string;
  source: { bookId: string; sectionId: string; anchor: string; blockIds: string[] };
  open?: boolean;
  glossaryIds?: string[];
  travelTable?: boolean;
}

export interface ExplorationTopicDefinition {
  id: string;
  title: string;
  description: string;
  keywords: string;
  rules: ExplorationRuleDefinition[];
  leagueLinks?: { label: string; href: string }[];
}

export function normalizeExplorationQuery(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

export function matchesExplorationQuery(text: string, query: string): boolean {
  return normalizeExplorationQuery(query).split(' ').filter(Boolean).every(word => text.includes(word));
}

function blockText(block: BookBlock): string {
  switch (block.kind) {
    case 'heading': case 'paragraph': return block.spans.map(span => span.text).join('');
    case 'table': return [block.caption || '', ...block.headers, ...block.rows.flat()].join(' ');
    case 'list': return block.items.map(spans => spans.map(span => span.text).join('')).join(' ');
    case 'callout': return block.blocks.map(blockText).join(' ');
    case 'image': return block.alt;
  }
}

// Present the imported two-line header as one accessible header; all distances remain source data.
export function compactTravelTable(block: BookBlock): BookBlock {
  if (block.kind !== 'table') return block;
  if (block.headers.length !== 4 || block.rows[0]?.length !== 4 || block.rows[0][0] !== '') {
    throw new Error('Travel table source structure changed');
  }
  return { ...block, caption: 'Темп путешествия', headers: [block.headers[0], ...block.rows[0].slice(1).map(value => `За ${value.toLocaleLowerCase('ru')}`)], rows: block.rows.slice(1) };
}

// Book anchors are local to a section. Prefix every rendered ID, including children of callouts.
function namespaceBlock(block: BookBlock, prefix: string): BookBlock {
  const copy = { ...block, id: block.id ? `${prefix}-${block.id}` : undefined };
  return copy.kind === 'callout' ? { ...copy, blocks: copy.blocks.map(child => namespaceBlock(child, prefix)) } : copy;
}

export function resolveExplorationTopics(
  topics: readonly ExplorationTopicDefinition[],
  loadSection: (bookId: string, sectionId: string) => BookSection,
  books: readonly Book[],
  glossary: readonly { id: string; name: string }[],
) {
  const glossaryById = new Map(glossary.map(rule => [rule.id, rule]));
  const usedIds = new Set<string>();
  const checkId = (id: string) => {
    if (usedIds.has(id)) throw new Error(`Duplicate exploration ID: ${id}`);
    usedIds.add(id);
  };
  return topics.map(topic => {
    checkId(topic.id);
    return {
      ...topic,
      searchText: normalizeExplorationQuery(`${topic.title} ${topic.description} ${topic.keywords}`),
      rules: topic.rules.map(rule => {
        checkId(rule.id);
        const book = books.find(book => book.id === rule.source.bookId);
        if (!book || book.edition !== '2024') throw new Error(`Expected a published 2024 book: ${rule.source.bookId}`);
        const section = loadSection(book.id, rule.source.sectionId);
        const indexed = new Map<string, { block: BookBlock; page: number }>();
        const index = (block: BookBlock, page: number) => {
          if (block.id) indexed.set(block.id, { block, page });
          if (block.kind === 'callout') block.blocks.forEach(child => index(child, page));
        };
        section.pages.forEach(page => page.blocks.forEach(block => index(block, page.number)));
        const get = (id: string) => {
          const value = indexed.get(id);
          if (!value) throw new Error(`Missing exploration source: ${book.id}/${section.id}#${id}`);
          return value;
        };
        get(rule.source.anchor);
        const selected = rule.source.blockIds.map(id => get(id));
        if (!selected.length) throw new Error(`Empty exploration excerpt: ${rule.id}`);
        const pages = [...new Set(selected.map(entry => entry.page))];
        const blocks = selected.map(({ block }) => namespaceBlock(rule.travelTable && block.kind === 'table' ? compactTravelTable(block) : block, rule.id));
        return {
          ...rule, blocks,
          sourceHref: `/books/${book.id}/${section.id}/#${rule.source.anchor}`,
          sourceLabel: `${book.id.startsWith('phb-') ? 'PHB' : 'DMG'} ${book.edition} · стр. ${pages.map(page => book.pageLabels?.[page] || page).join(', ')}`,
          sourceTitle: book.title,
          searchText: normalizeExplorationQuery(`${rule.title} ${blocks.map(blockText).join(' ')}`),
          glossaryLinks: (rule.glossaryIds || []).map(id => {
            const term = glossaryById.get(id);
            if (!term) throw new Error(`Missing exploration glossary term: ${id}`);
            return { label: term.name, href: `/glossary#${encodeURIComponent(id)}` };
          }),
        };
      }),
    };
  });
}
