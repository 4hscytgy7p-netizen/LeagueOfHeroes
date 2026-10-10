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

export const STAT_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
export const POINT_BUDGET = 27;
export const BONUS_BUDGET = 3;
export const MIN_BASE = 8;
export const MAX_BASE = 15;
export const MAX_BONUS = 2;

export const STAT_NAMES: Record<keyof Stats, string> = {
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

export type StatAction = 'decrease-base' | 'increase-base' | 'decrease-racial' | 'increase-racial';

export function createInitialStats(): Stats {
  const stats = { ...INITIAL_STATS };
  for (const key of STAT_KEYS) stats[key] = { ...INITIAL_STATS[key] };
  return stats;
}

export function getRemainingBudget(stats: Stats) {
  return {
    points: POINT_BUDGET - STAT_KEYS.reduce((sum, key) => sum + COST_TABLE[stats[key].base], 0),
    bonuses: BONUS_BUDGET - STAT_KEYS.reduce((sum, key) => sum + stats[key].racial, 0),
  };
}

export function getModifier(total: number): number {
  return Math.floor((total - 10) / 2);
}

export function formatModifier(total: number): string {
  const modifier = getModifier(total);
  return modifier >= 0 ? `+${modifier}` : `−${Math.abs(modifier)}`;
}

export function getActionBlockReason(stats: Stats, key: keyof Stats, action: StatAction): string | null {
  const { base, racial } = stats[key];
  const remaining = getRemainingBudget(stats);

  switch (action) {
    case 'decrease-base':
      return base <= MIN_BASE ? 'Минимум 8' : null;
    case 'increase-base':
      if (base >= MAX_BASE) return 'Максимум 15';
      return COST_TABLE[base + 1] - COST_TABLE[base] > remaining.points
        ? 'Недостаточно очков'
        : null;
    case 'decrease-racial':
      return racial <= 0 ? 'Бонус не назначен' : null;
    case 'increase-racial':
      if (racial >= MAX_BONUS) return 'Максимум +2';
      return remaining.bonuses <= 0 ? 'Все бонусы распределены' : null;
  }
}

export function changeStat(stats: Stats, key: keyof Stats, action: StatAction): Stats {
  if (getActionBlockReason(stats, key, action)) return stats;
  const field = action.endsWith('base') ? 'base' : 'racial';
  const change = action.startsWith('increase') ? 1 : -1;
  return { ...stats, [key]: { ...stats[key], [field]: stats[key][field] + change } };
}

// One compact, validated representation for saved distributions and shared URLs.
export function serializeStats(stats: Stats): string {
  return STAT_KEYS.map((key) => `${stats[key].base}:${stats[key].racial}`).join(',');
}

export function parseStats(value: string): Stats | null {
  const pairs = value.split(',');
  if (pairs.length !== STAT_KEYS.length) return null;
  const stats = createInitialStats();

  for (const [index, key] of STAT_KEYS.entries()) {
    if (!/^\d{1,2}:\d$/.test(pairs[index])) return null;
    const [base, racial] = pairs[index].split(':').map(Number);
    if (base < MIN_BASE || base > MAX_BASE || racial > MAX_BONUS) return null;
    stats[key] = { base, racial };
  }

  const remaining = getRemainingBudget(stats);
  return remaining.points >= 0 && remaining.bonuses >= 0 ? stats : null;
}

export function formatStatsResult(stats: Stats): string {
  const remaining = getRemainingBudget(stats);
  const lines = STAT_KEYS.map((key) => {
    const { base, racial } = stats[key];
    return `${STAT_NAMES[key]}: ${base + racial} (${formatModifier(base + racial)}), база ${base}, бонус +${racial}`;
  });
  return [
    'Point Buy',
    ...lines,
    `Очки: ${POINT_BUDGET - remaining.points}/${POINT_BUDGET}; бонусы: ${BONUS_BUDGET - remaining.bonuses}/${BONUS_BUDGET}`,
  ].join('\n');
}
