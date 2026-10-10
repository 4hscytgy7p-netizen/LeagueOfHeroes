import type { SubclassSpellcastingLevel } from '../../types/class';

// Shared progression already used by the three subclass spellcasting tables.
export const thirdCasterSpellcasting: SubclassSpellcastingLevel[] = [
  [3, 3, 2, 0, 0, 0],
  [4, 4, 3, 0, 0, 0],
  [5, 4, 3, 0, 0, 0],
  [6, 4, 3, 0, 0, 0],
  [7, 5, 4, 2, 0, 0],
  [8, 6, 4, 2, 0, 0],
  [9, 6, 4, 2, 0, 0],
  [10, 7, 4, 3, 0, 0],
  [11, 8, 4, 3, 0, 0],
  [12, 8, 4, 3, 0, 0],
  [13, 9, 4, 3, 2, 0],
  [14, 10, 4, 3, 2, 0],
  [15, 10, 4, 3, 2, 0],
  [16, 11, 4, 3, 3, 0],
  [17, 11, 4, 3, 3, 0],
  [18, 11, 4, 3, 3, 0],
  [19, 12, 4, 3, 3, 1],
  [20, 13, 4, 3, 3, 1],
].map(([level, knownSpells, first, second, third, fourth]) => ({
  level, knownSpells, spellSlots: { 1: first, 2: second, 3: third, 4: fourth },
}));

export function thirdCasterSpellcastingTable(levelLabel: string) {
  return {
    headers: [levelLabel, 'Известные заклинания', '1-я ячейка', '2-я ячейка', '3-я ячейка', '4-я ячейка'],
    rows: thirdCasterSpellcasting.map(({ level, knownSpells, spellSlots }) => [
      String(level), String(knownSpells),
      ...([1, 2, 3, 4] as const).map(slot => String(spellSlots[slot] || '—')),
    ]),
  };
}
