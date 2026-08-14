export type FeatType = 'origin' | 'general' | 'fighting-style' | 'epic';
export type AbilityScore = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export interface Feat {
  id: string;
  name: string;
  nameEn: string;
  type: FeatType;
  requirements?: string[];
  description?: string;
  effects: string[];
  abilityScoreIncrease?: AbilityScore[];
}