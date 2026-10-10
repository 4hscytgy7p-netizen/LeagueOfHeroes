import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { classes, premiumClasses } from '../classes/index.ts';
import { speciesData } from '../species/index.ts';
import { backgroundsData } from '../backgrounds/index.ts';
import { featsData } from '../feats/index.ts';
import { spells } from '../spells/index.ts';
import { items } from '../items/index.ts';
import { magicItems } from '../magicItems/index.ts';
import { glossary } from '../glossary.ts';
import { deities } from '../deities/index.ts';
import { explorationTopicDefinitions } from '../explorationTopics.ts';
import { parseMaterialSource, sourceFromSubclassName } from '../../utils/materialCatalog.ts';
import { plainSearchText, publicRuleEntries, searchFeatureAnchor } from '../../utils/searchContent.ts';
import { safeSearchUrl } from '../../utils/siteSearch.ts';
import type { SearchEntry, SearchKind, SearchManifest } from '../../types/search.ts';
import type { Book } from '../../types/book.ts';
import type { ClassFeature } from '../../types/class.ts';
import GeneralRules from '../../pages/general-rules.astro';
import EquipmentRules from '../../pages/rules/equipment.astro';
import InjuryRules from '../../pages/rules/injuries.astro';
import SpeciesRules from '../../pages/races.astro';
import AllowedMaterials from '../../pages/allowed-materials.astro';
import Downtime from '../../pages/rules/downtime-activities.astro';
import Bastions from '../../pages/bastions.astro';
import FAQ from '../../pages/faq.astro';
import CharacterGuide from '../../pages/character-guide.astro';

// Deliberate public allowlist. Never import cabinet, master rules or drafts here.
const publicPages = [
  { page: GeneralRules, url: '/general-rules', title: 'Основные правила Лиги' },
  { page: EquipmentRules, url: '/rules/equipment', title: 'Снаряжение: таблицы и правила Лиги' },
  { page: InjuryRules, url: '/rules/injuries', title: 'Травмы: правила Лиги' },
  { page: SpeciesRules, url: '/races', title: 'Виды: общие правила Лиги', ignoredIds: ['species-catalog'] },
  { page: AllowedMaterials, url: '/allowed-materials', title: 'Разрешённые материалы', ignoredIds: ['catalog'] },
  { page: Downtime, url: '/rules/downtime-activities', title: 'Деятельность во время простоя' },
  { page: Bastions, url: '/bastions', title: 'Бастионы' },
  { page: FAQ, url: '/faq', title: 'Частые вопросы' },
  { page: CharacterGuide, url: '/character-guide', title: 'Создание персонажа' },
];
const bookDefinitions = Object.values(import.meta.glob<Book>('../books/*/book.json', { eager: true, import: 'default' }));
function sourceFields(raw?: string): Pick<SearchEntry, 'source' | 'edition' | 'aliases'> {
  const parsed = parseMaterialSource(raw);
  return { source: parsed.label, ...(parsed.edition !== 'unspecified' ? { edition: parsed.edition } : {}), aliases: [raw || '', parsed.code].filter(Boolean) };
}
function text(...parts: (string | undefined)[]): string { return plainSearchText(parts.filter(Boolean).join(' ')); }
function descriptionStrings(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(descriptionStrings).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(descriptionStrings).join(' ');
  return '';
}
let pending: Promise<{ catalog: SearchEntry[]; titles: SearchEntry[]; manifest: SearchManifest }> | undefined;
export function getSearchCatalog() {
  return pending ||= buildCatalog().catch(error => { pending = undefined; throw error; });
}
async function buildCatalog() {
  const catalog: SearchEntry[] = [];
  const add = (entry: SearchEntry) => catalog.push(entry);
  for (const item of [...classes, ...premiumClasses]) {
    const url = `/classes/${encodeURIComponent(item.id)}`;
    const source = sourceFields(item.sourceBook);
    add({ id: `class:${encodeURIComponent(item.id)}`, kind: 'class', title: item.name, nameEn: item.nameEn, url, ...source, text: text(item.description) });
    function addFeatures(features: ClassFeature[], base: string, parent: string, parentId: string, subclass: boolean, fields: ReturnType<typeof sourceFields>) {
      features.forEach((feature, index) => {
        const target = `${base}#${searchFeatureAnchor(feature.name, feature.level, subclass, index)}`;
        add({ id: `feature:${parentId}:${index}`, kind: 'feature', title: feature.name, url: target, ...fields, location: `${parent} · уровень ${feature.level}`, text: text(feature.description, descriptionStrings(feature.collapsible)) });
        feature.collapsible?.forEach((part, nested) => add({ id: `feature:${parentId}:${index}:${nested}`, kind: 'feature', title: part.title, url: `${base}${base.includes('?') ? '&' : '?'}featurePart=${encodeURIComponent(part.title)}#${searchFeatureAnchor(feature.name, feature.level, subclass, index)}`, ...fields, location: `${parent} · ${feature.name}`, text: text(part.description, descriptionStrings(part.tableData)) }));
      });
    }
    addFeatures(item.features, url, item.name, item.id, false, source);
    for (const subclass of item.subclasses) {
      const target = `${url}?subclass=${encodeURIComponent(subclass.id)}`;
      const fields = sourceFields(subclass.sourceBook ?? sourceFromSubclassName(subclass.nameEn));
      add({ id: `subclass:${item.id}:${subclass.id}`, kind: 'subclass', title: subclass.name, nameEn: subclass.nameEn.replace(/\s+[a-z’'`]+['’`]?(14|24)$/i, ''), url: target, ...fields, location: item.name, text: text(subclass.description) });
      addFeatures(subclass.features, target, `${item.name} · ${subclass.name}`, `${item.id}:${subclass.id}`, true, fields);
    }
  }
  for (const item of speciesData) {
    const url = `/races/${encodeURIComponent(item.id)}`;
    add({ id: `species:${encodeURIComponent(item.id)}`, kind: 'species', title: item.name, nameEn: item.nameEn, url, ...sourceFields(item.sourceBook), text: text(item.lore, descriptionStrings(item.abilities)) });
    item.variants?.forEach((variant, index) => add({ id: `species:${item.id}:${index}`, kind: 'species', title: variant.name, nameEn: variant.nameEn, url: `${url}?variant=${encodeURIComponent(variant.name)}`, ...sourceFields(variant.sourceBook), location: item.name, text: text(variant.lore, descriptionStrings(variant.abilities), descriptionStrings(variant.tableData)) }));
  }
  for (const item of backgroundsData) add({ id: `background:${encodeURIComponent(item.id)}`, kind: 'background', title: item.name, nameEn: item.nameEn, url: `/backgrounds/${encodeURIComponent(item.id)}`, ...sourceFields(item.sourceBook), text: text(item.lore, descriptionStrings(item.proficiencies), descriptionStrings(item.characteristics), descriptionStrings(item.spellTable), descriptionStrings(item.variants)) });
  for (const item of featsData) add({ id: `feat:${encodeURIComponent(item.id)}`, kind: 'feat', title: item.name, nameEn: item.nameEn, url: `/feats/${encodeURIComponent(item.id)}`, ...sourceFields(item.sourceBook), text: text(item.description, ...item.effects, ...(item.requirements || [])) });
  for (const item of spells) add({ id: `spell:${encodeURIComponent(item.id)}`, kind: 'spell', title: item.name, nameEn: item.nameEn, url: `/spells/${encodeURIComponent(item.id)}`, ...sourceFields(item.source.book), location: `Уровень ${item.level === 'cantrip' ? '0 (заговор)' : item.level} · ${item.school}`, text: text(item.description, item.castingTime, item.range, item.duration, item.components.material) });
  for (const item of items) add({ id: `item:${encodeURIComponent(item.id)}`, kind: 'item', title: item.name, nameEn: item.nameEn, url: `/items/${encodeURIComponent(item.id)}`, ...sourceFields(item.sourceBook), text: text(item.description, item.type) });
  for (const item of magicItems) add({ id: `magic-item:${encodeURIComponent(item.id)}`, kind: 'magic-item', title: item.name, nameEn: item.nameEn, url: `/magic-items/${encodeURIComponent(item.id)}`, ...sourceFields(item.source.book), text: text(item.description, item.type, item.rarity) });
  for (const item of glossary) add({ id: `glossary:${encodeURIComponent(item.id)}`, kind: 'glossary', title: item.name, nameEn: item.nameEn, url: `/glossary/${encodeURIComponent(item.id)}`, source: 'Глоссарий', text: text(item.html) });
  for (const item of deities) add({ id: `deity:${encodeURIComponent(item.id)}`, kind: 'deity', title: item.name, nameEn: item.originalName, aliases: item.aliases, url: `/deities#${encodeURIComponent(item.id)}`, source: item.reference.sourceName, location: item.pantheon, text: text(item.description, item.reference.summary, item.reference.portfolio, ...item.reference.domains, item.reference.alignment) });
  for (const topic of explorationTopicDefinitions) {
    add({ id: `rule:exploration:${topic.id}`, kind: 'rule', title: topic.title, aliases: topic.keywords.split(' '), url: `/exploration#${topic.id}`, source: 'Исследование и путешествия', edition: '2024', text: topic.description });
    for (const rule of topic.rules) add({ id: `rule:exploration:${rule.id}`, kind: 'rule', title: rule.title, url: `/exploration#${rule.id}`, source: sourceFields(rule.source.bookId.startsWith('phb') ? 'PHB24' : 'DMG24').source, edition: '2024', text: topic.description });
  }
  const container = await AstroContainer.create();
  for (const { page, url, title, ignoredIds } of publicPages) {
    const html = await container.renderToString(page, { request: new Request(`https://league.local${url}`) });
    catalog.push(...publicRuleEntries(html, url, title, ignoredIds));
  }
  for (const book of bookDefinitions) {
    for (const section of book.sections) add({ id: `book:${book.id}:${section.id}`, kind: 'book', title: section.title, ...sourceFields(`${book.id.startsWith('phb') ? 'PHB' : 'DMG'}${book.edition}`), url: `/books/${book.id}/${section.id}/`, location: book.title, text: text(section.description, book.subtitle) });
  }
  const ids = new Set<string>();
  for (const entry of catalog) {
    if (ids.has(entry.id) || !safeSearchUrl(entry.url)) throw new Error(`Invalid search entry: ${entry.id}`);
    ids.add(entry.id);
  }
  const counts: Partial<Record<SearchKind, number>> = {};
  for (const entry of catalog) counts[entry.kind] = (counts[entry.kind] || 0) + 1;
  const manifest: SearchManifest = { version: 1, catalogUrl: '/search-index/catalog.json', titlesUrl: '/search-index/titles.json',
    books: bookDefinitions.map(book => ({ id: book.id, title: book.title, edition: book.edition as '2014' | '2024', url: `/books/${book.id}/search.json` })),
    sources: [...new Set(catalog.map(entry => entry.source))].sort((a, b) => a.localeCompare(b, 'ru')), counts };
  return { catalog, titles: catalog.map(entry => ({ ...entry, text: entry.text.slice(0, 185) })), manifest };
}
