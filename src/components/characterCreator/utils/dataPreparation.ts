export function toolOptionsFromDescription(
  value: unknown,
  allTools: readonly string[],
  artisanTools: readonly string[],
  musicalInstruments: readonly string[],
  gamingSets: readonly string[]
) {
  const text = String(value ?? '').toLocaleLowerCase('ru');
  if (!text.trim()) return [];
  if (/ремеслен|artisan/.test(text)) return [...artisanTools];
  if (/музыкальн|инструмент[^.]*музык/.test(text)) return [...musicalInstruments];
  if (/игров|набор[^.]*игр/.test(text)) return [...gamingSets];

  const exact = allTools.filter((tool) =>
    text.includes(tool.toLocaleLowerCase('ru'))
  );

  return exact.length ? exact : [...allTools];
}

export function languageChoiceCount(value: unknown) {
  const text = String(value ?? '').toLocaleLowerCase('ru');
  const digit = text.match(
    /(?:выберите|знаете|получаете|владеете)[^.!?]{0,50}?(\d+)/
  )?.[1];

  if (digit) return Math.max(1, Number(digit));
  if (/два языка|двумя языками|2 языка/.test(text)) return 2;
  if (/три языка|тремя языками|3 языка/.test(text)) return 3;
  return /язык/.test(text) ? 1 : 0;
}

export function languageOptionsForSource(
  value: unknown,
  standardLanguages: readonly string[],
  rareLanguages: readonly string[]
) {
  const text = String(value ?? '').toLocaleLowerCase('ru');
  if (!/язык/.test(text)) return [];

  if (/редк|экзотическ|любой язык|любого языка/.test(text)) {
    return [...standardLanguages, ...rareLanguages];
  }

  return [...standardLanguages];
}

export function isCustomLineageEligibleGeneralFeat(item: any) {
  if (item?.type !== 'general') return false;

  const requirements = Array.isArray(item.requirements)
    ? item.requirements.filter(Boolean)
    : [];

  if (requirements.length > 2) return false;

  return requirements.every((requirement: unknown) => {
    const text = String(requirement ?? '')
      .toLocaleLowerCase('ru')
      .replace(/ё/g, 'е')
      .trim();

    if (/уровень\s*4\+|4\+\s*уров/.test(text)) return true;

    return /(?:сила|ловкость|телосложение|интеллект|мудрость|харизма)(?:\s+или\s+(?:сила|ловкость|телосложение|интеллект|мудрость|харизма))*\s*13\+/.test(text);
  });
}

export function normalizeSpellName(value: unknown) {
  return String(value ?? '')
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim();
}

export function normalizeSpellLevel(value: unknown) {
  const text = String(value ?? '').toLocaleLowerCase('ru');

  if (text === '0' || /cantrip|заговор/.test(text)) return 'cantrip';
  return text === '1' || /1\s*(?:уров|level)/.test(text) ? '1' : text;
}

export function spellBelongsToClass(
  spell: any,
  characterClass: any,
  normalizeName: (value: unknown) => string = normalizeSpellName
) {
  const classId = String(characterClass?.id ?? '')
    .trim()
    .toLocaleLowerCase('ru');

  const classNames = [characterClass?.name, characterClass?.nameEn]
    .filter(Boolean)
    .map(normalizeName);

  return (spell.sources ?? []).some((source: any) => {
    if (!/^class$|^класс$/i.test(String(source?.type ?? ''))) return false;

    const rawName = String(source?.name ?? '');
    const hrefClassId = rawName
      .match(/href=["']\/classes\/([^?"'/>]+)/i)?.[1]
      ?.toLocaleLowerCase('ru');

    if (classId && hrefClassId) return hrefClassId === classId;

    const plainSourceName = normalizeName(rawName.replace(/<[^>]+>/g, ' '));
    return classNames.some((name) => name && plainSourceName === name);
  });
}

export function parseMoneyToCopper(value: unknown) {
  const text = String(value ?? '')
    .toLocaleLowerCase('ru')
    .replace(',', '.');

  const match = text.match(
    /([\d.]+)\s*(мм|см|эм|зм|пм|cp|sp|ep|gp|pp)/i
  );

  if (!match) return 0;

  const amount = Number(match[1]) || 0;
  const unit = match[2].toLocaleLowerCase('ru');
  const rates: Record<string, number> = {
    мм: 1,
    cp: 1,
    см: 10,
    sp: 10,
    эм: 50,
    ep: 50,
    зм: 100,
    gp: 100,
    пм: 1000,
    pp: 1000
  };

  return Math.round(amount * (rates[unit] || 0));
}

export function parseWeight(value: unknown) {
  const match = String(value ?? '').replace(',', '.').match(/[\d.]+/);
  return match ? Number(match[0]) : 0;
}

export function getEquipmentCategoryGroup(type: unknown) {
  const value = String(type || '');

  if (value.includes('оружие')) return 'weapon';
  if (value.includes('доспех') || value === 'Щит') return 'armor';
  if (value === 'Боеприпасы') return 'ammo';
  if (value === 'Инструменты') return 'tools';

  if (
    value === 'Магические фокусировки'
    || value === 'Священный символ'
    || value === 'Фокусировка друидов'
  ) {
    return 'focus';
  }

  if (value === 'Снаряжение приключенца') return 'gear';
  return 'other';
}
