import type { Spell } from '../types/spell';

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function linkifySpells(text: string, spells: Spell[]): string {
  let linked = text;
  const sortedSpells = [...spells].sort((a, b) => b.name.length - a.name.length);

  sortedSpells.forEach(spell => {
    const name = spell.name;
    const re = new RegExp(escapeRegExp(name), 'g');
    linked = linked.replace(
      re,
      `<a href="/spells" class="spell-link" data-spell-id="${spell.id}" data-spell-name="${spell.name}">${spell.name}</a>`
    );
  });

  return linked;
}
