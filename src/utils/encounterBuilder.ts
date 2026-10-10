import { crXPValues, xpBudgets } from '../data/encounters.ts';

export const encounterStorageKey = 'league-encounter-v1';
export interface CharacterGroup { count: number; level: number }
export interface MonsterGroup { name: string; cr: string; count: number; zeroXP?: boolean }
export interface Encounter { characters: CharacterGroup[]; monsters: MonsterGroup[] }

export function positiveInteger(value: unknown, label: string, max = Number.MAX_SAFE_INTEGER): number {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') {
    throw new Error(`${label}: введите целое положительное число.`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) {
    throw new Error(`${label}: нужно целое число от 1 до ${max.toLocaleString('ru-RU')}.`);
  }
  return number;
}

export function validateCR(value: unknown): string {
  if (typeof value !== 'string' || !crXPValues.some(item => item.cr === value.trim())) {
    throw new Error('CR: выберите 0, 1/8, 1/4, 1/2 или целое число от 1 до 30.');
  }
  return value.trim();
}

export function xpForCR(cr: string, zeroXP = false): number {
  const valid = validateCR(cr);
  if (valid === '0' && zeroXP) return 0;
  return crXPValues.find(item => item.cr === valid)!.xp;
}

export function validateCharacter(value: CharacterGroup): CharacterGroup {
  return { count: positiveInteger(value?.count, 'Количество персонажей'), level: positiveInteger(value?.level, 'Уровень', 20) };
}

export function validateMonster(value: MonsterGroup): MonsterGroup {
  if (typeof value?.name !== 'string' || !value.name.trim() || value.name.trim().length > 200) {
    throw new Error('Название противника: введите от 1 до 200 символов.');
  }
  const cr = validateCR(value.cr);
  if (value.zeroXP !== undefined && typeof value.zeroXP !== 'boolean') throw new Error('Неверный выбор опыта за CR 0.');
  if (value.zeroXP && cr !== '0') throw new Error('0 опыта можно указать только для CR 0.');
  return { name: value.name.trim(), cr, count: positiveInteger(value.count, 'Количество противников'), zeroXP: value.zeroXP === true };
}

function safeSum(total: number, value: number): number {
  const sum = total + value;
  if (!Number.isSafeInteger(sum)) throw new Error('Количество слишком велико для точного расчёта. Уменьшите его.');
  return sum;
}

export function calculateEncounter(encounter: Encounter) {
  const characters = encounter.characters.map(validateCharacter);
  const monsters = encounter.monsters.map(validateMonster);
  let characterCount = 0, weightedLevels = 0, monsterCount = 0, totalXP = 0;
  const budgets = { low: 0, moderate: 0, high: 0 };
  for (const character of characters) {
    characterCount = safeSum(characterCount, character.count);
    weightedLevels = safeSum(weightedLevels, character.level * character.count);
    const budget = xpBudgets[character.level - 1];
    for (const key of ['low', 'moderate', 'high'] as const) budgets[key] = safeSum(budgets[key], budget[key] * character.count);
  }
  for (const monster of monsters) {
    monsterCount = safeSum(monsterCount, monster.count);
    totalXP = safeSum(totalXP, xpForCR(monster.cr, monster.zeroXP) * monster.count);
  }
  // The 2024 values are budgets to spend up to, not lower thresholds.
  const difficulty = !characterCount ? 'Добавьте персонажей' : !monsterCount ? 'Добавьте противников'
    : totalXP <= budgets.low ? 'Низкая' : totalXP <= budgets.moderate ? 'Средняя'
    : totalXP <= budgets.high ? 'Высокая' : 'Выше высокой';
  const warnings: string[] = [];
  if (characterCount && monsterCount > characterCount * 2) warnings.push('Более двух противников на персонажа: серия удачных атак может резко повысить опасность, особенно на уровнях 1–2.');
  if (characters.length && monsters.some(monster => Number(monster.cr) > Math.min(...characters.map(character => character.level)))) warnings.push('CR одного из противников выше уровня части группы: одно действие может вывести персонажа из строя. Проверьте урон и необычные умения.');
  return { characterCount, monsterCount, budgets, totalXP, difficulty, warnings,
    averageLevel: characterCount ? weightedLevels / characterCount : null,
    xpPerCharacter: characterCount ? Math.floor(totalXP / characterCount) : null,
    highRatio: characterCount ? totalXP / budgets.high : null };
}

export function serializeEncounter(encounter: Encounter): string {
  calculateEncounter(encounter);
  return JSON.stringify({ version: 1, characters: encounter.characters, monsters: encounter.monsters });
}

export function restoreEncounter(raw: string): Encounter {
  const data = JSON.parse(raw);
  if (!data || data.version !== 1 || !Array.isArray(data.characters) || !Array.isArray(data.monsters)) {
    throw new Error('Неверный формат сохранённого столкновения.');
  }
  const result = { characters: data.characters.map(validateCharacter), monsters: data.monsters.map(validateMonster) };
  calculateEncounter(result);
  return result;
}
