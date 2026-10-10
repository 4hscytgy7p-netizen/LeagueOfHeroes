import type { Creature } from '../types/creature.ts';

export const creatureAbilityLabels = [
  { key: 'str', label: 'СИЛ', full: 'Сила' }, { key: 'dex', label: 'ЛОВ', full: 'Ловкость' },
  { key: 'con', label: 'ТЕЛ', full: 'Телосложение' }, { key: 'int', label: 'ИНТ', full: 'Интеллект' },
  { key: 'wis', label: 'МДР', full: 'Мудрость' }, { key: 'cha', label: 'ХАР', full: 'Харизма' },
] as const;

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function signedModifier(value: number): string {
  return value >= 0 ? `+${value}` : `−${Math.abs(value)}`;
}

export function resolveFeatureCreatures(ids: readonly string[], creatures: readonly Creature[]): Creature[] {
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate creature reference in a feature');
  return ids.map(id => {
    const creature = creatures.find(creature => creature.id === id);
    if (!creature) throw new Error(`Missing creature reference: ${id}`);
    return creature;
  });
}
