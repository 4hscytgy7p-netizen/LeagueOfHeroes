import type { MaterialAnnotation, MaterialInput, MaterialKind, MaterialSource, PublishedMaterial } from '../types/material.ts';

export const materialKindLabels = {
  class: 'Классы', subclass: 'Подклассы', species: 'Виды', 'species-variant': 'Варианты видов',
  background: 'Предыстории', feat: 'Черты', spell: 'Заклинания', item: 'Предметы', 'magic-item': 'Магические предметы'
} as const;

export const materialStatusLabels = {
  allowed: 'Разрешено', modified: 'Адаптации и ограничения Лиги', superseded: 'Заменён новой версией'
} as const;

export function normalizeMaterialSearch(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[’'`]/g, '').replace(/\s+/g, ' ').trim();
}

export function parseMaterialSource(raw?: string): MaterialSource {
  const value = raw?.trim() || '';
  if (!value) return { id: 'unspecified', code: '', edition: 'unspecified', label: 'Источник не указан' };
  const compact = value.replace(/[\s’'`]/g, '');
  const match = compact.match(/^([a-z][a-z\d]*?)(?:20)?(14|24)$/i);
  const code = match ? match[1] : compact;
  const edition = match ? (match[2] === '24' ? '2024' : '2014') : 'unspecified';
  const normalizedCode = code.toUpperCase();
  const title = normalizedCode === 'PHB' ? 'Книга игрока' : normalizedCode === 'DMG' ? 'Руководство мастера' : code;
  return {
    id: `${encodeURIComponent(normalizedCode.toLowerCase())}-${edition}`,
    code: normalizedCode,
    edition,
    label: `${title}${edition === 'unspecified' ? '' : ` · ${edition}`}`,
  };
}

// Several subclass records carry their own source at the end of nameEn.
// Never inherit a class source: a 2024 class can include 2014 subclasses.
export function sourceFromSubclassName(name: string): string | undefined {
  return name.trim().match(/(?:^|\s)([a-z][a-z’'`]*['’`]?(?:14|24))\s*$/i)?.[1];
}

function comparisonName(input: MaterialInput): string {
  const english = input.nameEn.replace(/\s+[a-z][a-z’'`]*['’`]?(?:14|24)\s*$/i, '');
  return `${input.kind}:${input.comparisonGroup || ''}:${normalizeMaterialSearch(english || input.name)}`;
}

export function materialKey(kind: MaterialKind, id: string): string {
  return `${kind}:${id}`;
}

export function speciesVariantMaterialId(parentId: string, variant: { id?: string }, index: number): string {
  return `${parentId}:${variant.id || index}`;
}

export function isMaterialLink(href: string): boolean {
  return /^\/(?!\/)/.test(href) && !/[\\\s\u0000-\u001f]/.test(href);
}

export function buildMaterialCatalog(inputs: readonly MaterialInput[], annotations: readonly MaterialAnnotation[] = []): PublishedMaterial[] {
  const keys = new Set<string>();
  const materials = inputs.map(input => {
    const key = `${input.kind}:${input.id}`;
    if (keys.has(key)) throw new Error(`Duplicate published material: ${key}`);
    keys.add(key);
    const sourceInfo = parseMaterialSource(input.source);
    return {
      ...input, sourceInfo, status: 'allowed', errata: [],
      searchText: normalizeMaterialSearch(`${input.name} ${input.nameEn} ${input.parent || ''} ${input.source || ''} ${sourceInfo.code} ${sourceInfo.label}`),
    } as PublishedMaterial;
  });
  const byKey = new Map(materials.map(item => [materialKey(item.kind, item.id), item]));
  const marked = new Map<string, MaterialAnnotation>();
  for (const annotation of annotations) {
    const key = materialKey(annotation.kind, annotation.id);
    const item = byKey.get(key);
    if (!item) throw new Error(`Unknown annotated material: ${key}`);
    if (marked.has(key)) throw new Error(`Duplicate material annotation: ${key}`);
    if (!annotation.errata?.length && annotation.replacedBy === undefined) throw new Error(`Empty material annotation: ${key}`);
    marked.set(key, annotation);
    item.errata = (annotation.errata || []).map(rule => {
      if (!isMaterialLink(rule.href)) throw new Error(`Invalid errata link: ${key}`);
      if (rule.type && !['adaptation', 'restriction'].includes(rule.type)) throw new Error(`Invalid league rule type: ${key}`);
      if (rule.type === 'adaptation' && !rule.note?.trim()) throw new Error(`Adaptation needs an explanation: ${key}`);
      return { ...rule };
    });
    if (item.errata.length) {
      item.status = 'modified';
      item.ruleHref = item.errata[0].href;
    }
  }
  const currentVersions = new Map<string, PublishedMaterial[]>();
  for (const item of materials.filter(item => item.sourceInfo.edition === '2024')) {
    const key = comparisonName(item);
    currentVersions.set(key, [...(currentVersions.get(key) || []), item]);
  }
  const replacements = new Map<PublishedMaterial, PublishedMaterial>();
  for (const item of materials) {
    const annotation = marked.get(materialKey(item.kind, item.id));
    if (annotation?.replacedBy === null) continue;
    if (annotation?.replacedBy) {
      const preferred = byKey.get(materialKey(annotation.replacedBy.kind, annotation.replacedBy.id));
      if (!preferred) throw new Error(`Unknown replacement for ${item.kind}:${item.id}`);
      if (preferred.kind !== item.kind || preferred.comparisonGroup !== item.comparisonGroup) {
        throw new Error(`Incompatible replacement for ${item.kind}:${item.id}`);
      }
      replacements.set(item, preferred);
    } else {
      const candidates = currentVersions.get(comparisonName(item)) || [];
      if (item.sourceInfo.edition === '2014' && candidates.length === 1) replacements.set(item, candidates[0]);
    }
  }
  for (const [item, replacement] of replacements) {
    const seen = new Set([item]);
    let preferred = replacement;
    while (true) {
      if (seen.has(preferred)) throw new Error(`Cyclic material replacement: ${item.kind}:${item.id}`);
      seen.add(preferred);
      const next = replacements.get(preferred);
      if (!next) break;
      preferred = next;
    }
    if (!isMaterialLink(preferred.href)) throw new Error(`Invalid replacement link: ${preferred.kind}:${preferred.id}`);
    item.status = 'superseded';
    item.preferredHref = preferred.href;
    item.preferredName = preferred.name;
  }
  return materials.sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.kind.localeCompare(b.kind));
}

export function matchesMaterial(item: Pick<PublishedMaterial, 'searchText' | 'kind' | 'status' | 'sourceInfo'> & { errata?: PublishedMaterial['errata'] }, query: string, edition = '', kind = '', status = ''): boolean {
  const terms = normalizeMaterialSearch(query).split(' ').filter(Boolean);
  return terms.every(term => item.searchText.includes(term))
    && (!edition || item.sourceInfo.edition === edition)
    && (!kind || item.kind === kind)
    && (!status || item.status === status || (status === 'modified' && !!item.errata?.length));
}
