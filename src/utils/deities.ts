import type { Deity, DeitySnapshot, DeitySourceRecord } from '../types/deity.ts';
import { deityNames } from '../data/deities/names.ts';
import { categoryLabels, domainLabels, pantheonLabels, sourceLabels, titlePortfolio, translateConcept, translateTitle } from '../data/deities/localization.ts';
import { translateSymbol } from '../data/deities/symbols.ts';
import type { FaithSearchEntry } from './deitySearch.ts';

export function deitySourceHref(record: Pick<DeitySourceRecord, 'name' | 'pantheon' | 'source'>): string {
  const hash = [record.name, record.pantheon, record.source].map(value => encodeURIComponent(value.toLowerCase()).toLowerCase()).join('_');
  return `https://5e.tools/deities.html#${hash}`;
}

export function canonicalPantheon(pantheon: string): string {
  if (pantheon === 'Faerûnian') return 'Forgotten Realms';
  if (pantheon === 'Gnome') return 'Gnomish';
  return pantheon;
}

function canonicalName(name: string, pantheon: string): string {
  return pantheon === 'Greyhawk' && name === 'St. Cuthbert' ? 'Cuthbert' : name;
}

export function deityAlignment(alignment: string[]): string {
  if (!alignment.length) return 'Не указано';
  return alignment.map(value => ({ L: 'З', C: 'Х', N: 'Н', G: 'Д', E: 'З' })[value] ?? value).join('');
}

const slug = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function buildDeities(snapshot: DeitySnapshot, legacy: readonly { id: string; name: string }[] = [], briefs: readonly { name: string; pantheon: string; source: string; summary: string }[] = []): Deity[] {
  const sources = new Map(snapshot.sources.map(source => [source.code, source]));
  const groups = new Map<string, Deity>();
  const seen = new Set<string>();
  const summaries = new Map(briefs.map(brief => [`${brief.name}|${brief.pantheon}|${brief.source}`, brief.summary]));
  for (const record of snapshot.records) {
    if (/^(egw|egtw)$/i.test(record.source)) throw new Error('Excluded deity source: EGtW');
    const source = sources.get(record.source);
    const pantheon = canonicalPantheon(record.pantheon);
    const name = canonicalName(record.name, pantheon);
    const russianName = deityNames[name];
    if (!source || !sourceLabels[record.source] || !russianName || !pantheonLabels[pantheon]) throw new Error(`Untranslated deity metadata: ${record.name}/${record.source}`);
    const publicationKey = `${record.name}|${record.pantheon}|${record.source}`;
    if (record.category && !categoryLabels[record.category]) throw new Error(`Untranslated deity category: ${record.category}`);
    if (seen.has(publicationKey)) throw new Error(`Duplicate deity publication: ${publicationKey}`);
    seen.add(publicationKey);
    const key = `${pantheon}|${name}`;
    let deity = groups.get(key);
    if (!deity) {
      const previous = pantheon === 'Forgotten Realms' ? legacy.find(option => option.name === russianName) : undefined;
      deity = { id: previous?.id || `deity-${slug(pantheon)}-${slug(name)}`, name: russianName, originalName: name, aliases: [], pantheon: pantheonLabels[pantheon], description: '', versions: [], reference: undefined! };
      groups.set(key, deity);
    }
    deity.aliases = [...new Set([...deity.aliases, record.name, ...record.altNames])];
    const domains = record.domains.map(domain => {
      if (!domainLabels[domain]) throw new Error(`Untranslated deity domain: ${domain}`);
      return domainLabels[domain];
    });
    deity.versions.push({
      originalName: record.name, originalPantheon: record.pantheon,
      source: record.source, sourceName: sourceLabels[record.source], published: source.published,
      category: record.category ? categoryLabels[record.category] : '',
      page: record.page, href: deitySourceHref(record), alignment: deityAlignment(record.alignment), domains,
      // FRHoF uses the gender-neutral English "god" for every deity, including goddesses.
      title: record.title ? translateTitle(record.title, record.source === 'FRHoF') : '',
      portfolio: record.province ? translateConcept(record.province) : titlePortfolio(record.title),
      symbol: translateSymbol(record.symbol), hasLore: record.hasLore,
      summary: summaries.get(publicationKey) || '',
    });
  }
  for (const key of summaries.keys()) if (!seen.has(key)) throw new Error(`Missing deity summary source: ${key}`);
  const ids = new Set<string>();
  for (const deity of groups.values()) {
    if (ids.has(deity.id)) throw new Error(`Duplicate deity ID: ${deity.id}`);
    ids.add(deity.id);
    deity.versions.sort((a, b) => b.published.localeCompare(a.published) || a.source.localeCompare(b.source));
    // Use the newest publication with actual domains and expose it explicitly.
    deity.reference = deity.versions.find(version => version.domains.some(domain => domain !== 'Не указан')) || deity.versions[0];
    const summary = deity.versions.find(version => version.summary)?.summary;
    if (summary) deity.description = summary;
    if (!deity.description) deity.description = deity.reference.title || (deity.reference.portfolio ? `Сферы влияния: ${deity.reference.portfolio}.` : `Божество пантеона «${deity.pantheon}».`);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.pantheon.localeCompare(b.pantheon, 'ru'));
}

export function deitySearchEntry(deity: Deity): FaithSearchEntry {
  return {
    kind: 'deity', pantheon: deity.pantheon,
    text: [deity.name, deity.originalName, ...deity.aliases, deity.pantheon, deity.description].join(' '),
    versions: deity.versions.map(version => ({ source: version.source, alignment: version.alignment, domains: version.domains, portfolio: version.portfolio, text: [version.title, version.portfolio, version.symbol, version.category, version.source, version.sourceName, ...version.domains].join(' ') })),
  };
}
