export interface StatValue {
  base: number;
  racial: number;
}

export interface Stats {
  STR: StatValue;
  DEX: StatValue;
  CON: StatValue;
  INT: StatValue;
  WIS: StatValue;
  CHA: StatValue;
}

export const STAT_NAMES: Record<string, string> = {
  STR: 'Сила (STR)',
  DEX: 'Ловкость (DEX)',
  CON: 'Телосложение (CON)',
  INT: 'Интеллект (INT)',
  WIS: 'Мудрость (WIS)',
  CHA: 'Харизма (CHA)',
};

export const COST_TABLE: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export const INITIAL_STATS: Stats = {
  STR: { base: 8, racial: 0 },
  DEX: { base: 8, racial: 0 },
  CON: { base: 8, racial: 0 },
  INT: { base: 8, racial: 0 },
  WIS: { base: 8, racial: 0 },
  CHA: { base: 8, racial: 0 },
};