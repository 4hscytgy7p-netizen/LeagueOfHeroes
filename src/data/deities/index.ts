import snapshot from './source.json';
import { legacyDeityIdentities } from './legacy.ts';
import { buildDeities } from '../../utils/deities.ts';
import type { DeitySnapshot } from '../../types/deity.ts';
import { deityBriefs } from './briefs.ts';

export const deitySnapshot = snapshot as DeitySnapshot;
export const deities = buildDeities(deitySnapshot, legacyDeityIdentities, deityBriefs);

export const DEITY_OPTIONS = deities.map(deity => ({
  id: deity.id, kind: 'deity', name: deity.name, originalName: deity.originalName,
  pantheon: deity.pantheon, aliases: deity.aliases, alignment: deity.reference.alignment,
  domains: deity.reference.domains.filter(domain => domain !== 'Не указан'),
  portfolio: deity.reference.portfolio || 'Не указана в источнике', description: deity.description,
  source: deity.reference.source, href: `/deities#${deity.id}`,
  detail: `${deity.pantheon} · ${deity.reference.alignment} · ${deity.reference.portfolio || 'Сфера не указана'} · ${deity.reference.source}`,
}));

export const DEITY_ALIGNMENTS = [...new Set(DEITY_OPTIONS.map(deity => deity.alignment))].sort((a, b) => a.localeCompare(b, 'ru'));
export const DEITY_DOMAINS = [...new Set(DEITY_OPTIONS.flatMap(deity => deity.domains))].sort((a, b) => a.localeCompare(b, 'ru'));
export const FAITH_SOURCE_URL = '/deities#league-requirements';
