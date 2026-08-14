export const SPELL_LIMITS: Record<string, {
  cantrips: number;
  level1: number;
  prepared?: number;
}> = {
  bard: { cantrips: 2, level1: 4 },
  cleric: { cantrips: 3, level1: 4 },
  druid: { cantrips: 2, level1: 4 },
  sorcerer: { cantrips: 4, level1: 2 },
  warlock: { cantrips: 2, level1: 2 },
  wizard: { cantrips: 3, level1: 6, prepared: 4 },
  paladin: { cantrips: 0, level1: 2 },
  ranger: { cantrips: 0, level1: 2 },
  artificer: { cantrips: 2, level1: 2 },
  apothecary: { cantrips: 2, level1: 2, prepared: 2 }
};
