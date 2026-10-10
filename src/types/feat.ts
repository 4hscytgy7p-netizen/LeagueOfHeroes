export type FeatType = 'origin' | 'general' | 'fighting-style' | 'epic';
export type AbilityScore = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export interface Feat {
  id: string;
  name: string;
  nameEn: string;
  /** Book code and rules edition, e.g. PHB`24. Omit when unknown. */
  sourceBook?: string;
  type: FeatType;
  requirements?: string[];
  description?: string;
  effects: string[];
  abilityScoreIncrease?: AbilityScore[];
}
