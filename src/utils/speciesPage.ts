import type { Species, SpeciesVariant } from '../types/species.ts';

export type SpeciesAbility = NonNullable<Species['abilities']>[number];
export type SpeciesPageVariant = SpeciesVariant & { pageId: string; materialIndex?: number };
export type SpeciesContentBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; headers: string[]; rows: string[][] };

// Existing plain text/TSV data; titles never determine the content format.
export function speciesContent(text: string): SpeciesContentBlock[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const blocks: SpeciesContentBlock[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (line.includes('\t')) {
      const headers = line.split('\t').map(cell => cell.trim());
      const rows: string[][] = [];
      while (lines[index + 1]?.includes('\t')) rows.push(lines[++index].split('\t').map(cell => cell.trim()));
      blocks.push({ kind: 'table', headers, rows });
      index++;
    } else if (/^[•-]\s*/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[•-]\s*/.test(lines[index])) items.push(lines[index++].replace(/^[•-]\s*/, ''));
      blocks.push({ kind: 'list', items });
    } else {
      blocks.push({ kind: 'paragraph', text: line });
      index++;
    }
  }
  return blocks;
}

export function speciesVariantId(variant: SpeciesVariant): string {
  return variant.id || variant.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function speciesPageVariants(species: Species): SpeciesPageVariant[] {
  // Index the source order before sorting to preserve existing material IDs.
  const variants = (species.variants || []).map((variant, materialIndex) => ({ ...variant, pageId: speciesVariantId(variant), materialIndex }));
  if (['elf', 'gnome', 'tiefling'].includes(species.id)) {
    variants.sort((a, b) => Number(b.sourceBook === species.sourceBook) - Number(a.sourceBook === species.sourceBook));
  }
  return variants;
}

export function speciesPageAbilities(species: Species, variant?: SpeciesVariant): { ability: SpeciesAbility; variant: boolean }[] {
  return [
    ...(species.abilities || []).filter(ability => !variant?.replacesAbilities?.includes(ability.title)).map(ability => ({ ability, variant: false })),
    ...(variant?.abilities || []).map(ability => ({ ability, variant: true })),
  ];
}

export function speciesSpeed(base: number, variant?: SpeciesVariant['speed']): { label: string; value: number }[] {
  const speeds: { walk?: number; swimming?: number; flying?: number } = typeof variant === 'number' ? { walk: variant } : { walk: base, ...variant };
  return ([['walk', 'Ходьба'], ['swimming', 'Плавание'], ['flying', 'Полёт']] as const)
    .filter(([key]) => speeds[key] !== undefined)
    .map(([key, label]) => ({ label, value: speeds[key]! }));
}

export function resolveSpeciesVariant(search: string, variants: Pick<SpeciesPageVariant, 'pageId' | 'name'>[]): string {
  const requested = new URLSearchParams(search).get('variant');
  return variants.find(variant => variant.pageId === requested || variant.name === requested)?.pageId || '';
}

export function speciesViewUrl(href: string, variantId: string, hash?: string): string {
  const url = new URL(href, 'https://local.invalid');
  if (variantId) url.searchParams.set('variant', variantId);
  else url.searchParams.delete('variant');
  if (hash !== undefined) url.hash = hash;
  return `${url.pathname}${url.search}${url.hash}`;
}
