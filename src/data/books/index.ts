import type { Book, BookSection } from '../../types/book';

// Only prepared content is imported. Source PDFs and Python tools are never bundled.
const manifests = import.meta.glob<{ default: Book }>('./*/book.json', { eager: true });
const sections = import.meta.glob<{ default: BookSection }>('./*/sections/*.json', { eager: true });

export const books: Book[] = Object.values(manifests)
  .map((module) => module.default)
  .sort((a, b) => a.title.localeCompare(b.title, 'ru'));

export function getBookSection(bookId: string, sectionId: string): BookSection {
  const section = sections[`./${bookId}/sections/${sectionId}.json`]?.default;
  if (!section) throw new Error(`Book section not found: ${bookId}/${sectionId}`);
  return section;
}

export function bookSectionUrl(bookId: string, sectionId: string): string {
  return `/books/${bookId}/${sectionId}/`;
}

export function bookPageRange(pages: number[], labels?: Book['pageLabels']): string {
  if (!pages.length) return '';
  const label = (page: number) => labels?.[page] || `${page}`;
  return pages.length === 1 ? label(pages[0]) : `${label(pages[0])}–${label(pages[pages.length - 1])}`;
}

export function bookSectionGroups(book: Book) {
  const groups: { title: string; sections: Book['sections'] }[] = [];
  for (const section of book.sections) {
    const title = section.group || 'Разделы книги';
    let group = groups.find((entry) => entry.title === title);
    if (!group) {
      group = { title, sections: [] };
      groups.push(group);
    }
    group.sections.push(section);
  }
  return groups;
}
