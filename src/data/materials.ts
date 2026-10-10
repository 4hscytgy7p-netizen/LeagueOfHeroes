import { classes, premiumClasses } from './classes';
import { speciesData } from './species/index';
import { backgroundsData } from './backgrounds';
import { featsData } from './feats';
import { spells } from './spells/index.ts';
import { items } from './items';
import { magicItems } from './magicItems';
import { buildMaterialCatalog, materialKey, sourceFromSubclassName, speciesVariantMaterialId } from '../utils/materialCatalog';
import { materialAnnotations } from './materialAnnotations';
import type { MaterialInput, MaterialKind } from '../types/material';
import type { Class } from '../types/class';

const publishedClasses: Class[] = [...classes, ...premiumClasses];
const inputs: MaterialInput[] = [
  ...publishedClasses.map(item => ({ id: item.id, kind: 'class' as const, name: item.name, nameEn: item.nameEn, source: item.sourceBook, href: `/classes/${item.id}` })),
  ...publishedClasses.flatMap(item => item.subclasses.map(subclass => ({
    id: `${item.id}:${subclass.id}`, kind: 'subclass' as const, name: subclass.name, nameEn: subclass.nameEn,
    parent: item.name, comparisonGroup: item.id, source: subclass.sourceBook ?? sourceFromSubclassName(subclass.nameEn),
    href: `/classes/${item.id}?subclass=${encodeURIComponent(subclass.id)}`,
  }))),
  ...speciesData.map(item => ({ id: item.id, kind: 'species' as const, name: item.name, nameEn: item.nameEn, source: item.sourceBook, href: `/races/${item.id}` })),
  ...speciesData.flatMap(item => (item.variants || []).map((variant, index) => ({
    id: speciesVariantMaterialId(item.id, variant, index), kind: 'species-variant' as const, name: variant.name, nameEn: variant.nameEn,
    parent: item.name, comparisonGroup: item.id, source: variant.sourceBook, href: `/races/${item.id}?variant=${encodeURIComponent(variant.name)}`,
  }))),
  ...backgroundsData.map(item => ({ id: item.id, kind: 'background' as const, name: item.name, nameEn: item.nameEn, source: item.sourceBook, href: `/backgrounds/${item.id}` })),
  ...featsData.map(item => ({ id: item.id, kind: 'feat' as const, name: item.name, nameEn: item.nameEn, source: item.sourceBook, href: `/feats/${item.id}` })),
  ...spells.map(item => ({ id: item.id, kind: 'spell' as const, name: item.name, nameEn: item.nameEn, source: item.source.book, sourcePage: item.source.page, href: `/spells/${item.id}` })),
  ...items.map(item => ({ id: item.id, kind: 'item' as const, name: item.name, nameEn: item.nameEn, source: item.sourceBook, href: `/items/${item.id}` })),
  ...magicItems.map(item => ({ id: item.id, kind: 'magic-item' as const, name: item.name, nameEn: item.nameEn, source: item.source.book, sourcePage: item.source.page, href: `/magic-items/${item.id}` })),
];

export const publishedMaterials = buildMaterialCatalog(inputs, materialAnnotations);
const materialsByKey = new Map(publishedMaterials.map(item => [materialKey(item.kind, item.id), item]));
export function getPublishedMaterial(kind: MaterialKind, id: string) {
  const material = materialsByKey.get(materialKey(kind, id));
  if (!material) throw new Error(`Unknown published material: ${kind}:${id}`);
  return material;
}
export const materialSources = [...new Map(publishedMaterials.map(item => [item.sourceInfo.id, item.sourceInfo])).values()]
  .sort((a, b) => a.label.localeCompare(b.label, 'ru'));

// User-confirmed publication policy. Whole books are not admitted automatically.
export const materialPolicy = {
  confirmedAt: '2026-10-05',
  published: 'Все опубликованные варианты разрешены в редакции сайта с учётом общих правил и ограничений Лиги.',
  editions: 'Версия 2024 имеет приоритет. Версию 2014 используют, если новой опубликованной версии нет.',
};
