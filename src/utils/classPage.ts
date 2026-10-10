import type { Class, ClassFeature, ClassLevel } from '../types/class.ts';

export function classProgressionLevels(classData: Pick<Class, 'levels' | 'subclasses'>, subclassId: string): ClassLevel[] {
  const spellcasting = classData.subclasses.find(subclass => subclass.id === subclassId)?.spellcasting;
  if (!spellcasting) return classData.levels;
  return classData.levels.map(level => ({
    ...level,
    spellSlots: { ...level.spellSlots, ...spellcasting.find(row => row.level === level.level)?.spellSlots },
  }));
}

export function classSpellSlotLevels(levels: Pick<ClassLevel, 'spellSlots'>[]): number[] {
  const max = Math.max(0, ...levels.flatMap(level => Object.entries(level.spellSlots || {})
    .filter(([, count]) => Number(count) > 0).map(([slot]) => Number(slot))));
  return Array.from({ length: max }, (_, index) => index + 1);
}

export function featureAnchor(name: string, level: number, subclass = false): string {
  const slug = String(name || `feature-${level}`).toLowerCase().trim()
    .replace(/[\s/\\]+/g, '-').replace(/[^a-zа-я0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `feature-${slug}-${level}${subclass ? '-subclass' : ''}`;
}

export function resolveSubclass(search: string, saved: string | null, ids: readonly string[]): string {
  const params = new URLSearchParams(search);
  const candidate = params.has('subclass') ? params.get('subclass') : saved;
  return candidate && ids.includes(candidate) ? candidate : '';
}

export function classViewUrl(href: string, subclass: string, anchor = ''): string {
  const url = new URL(href, 'https://local.invalid');
  // An explicit empty value means base class, even if a specialization was saved.
  url.searchParams.set('subclass', subclass);
  if (decodeFeatureHash(url.hash) !== anchor) url.searchParams.delete('featurePart');
  url.hash = anchor;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function decodeFeatureHash(hash: string): string {
  try { return decodeURIComponent(hash.replace(/^#/, '')); } catch { return ''; }
}

export function visibleClassFeatures(classData: Pick<Class, 'features' | 'subclasses'>, subclassId: string): { feature: ClassFeature; subclass: boolean }[] {
  const subclass = classData.subclasses.find(item => item.id === subclassId);
  const levels = new Set(subclass?.features.map(feature => feature.level));
  const base = classData.features.filter(feature => !subclass || !levels.has(feature.level)
    || !/Подкласс|Круг|Домен|Путь/.test(feature.name));
  return [
    ...base.map(feature => ({ feature, subclass: false })),
    ...(subclass?.features || []).map(feature => ({ feature, subclass: true })),
  ].sort((a, b) => a.feature.level - b.feature.level);
}
