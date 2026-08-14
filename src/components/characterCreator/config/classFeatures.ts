const WEAPON_MASTERY_OPTIONS_RAW = [
  { id: 'battleaxe', name: 'Боевой топор', detail: 'Опрокидывание [Topple]', masteryId: 'topple', href: '/faq' },
  { id: 'blowgun', name: 'Духовая трубка', detail: 'Подавление [Vex]', masteryId: 'vex', href: '/faq' },
  { id: 'club', name: 'Дубинка', detail: 'Замедление [Slow]', masteryId: 'slow', href: '/faq' },
  { id: 'dagger', name: 'Кинжал', detail: 'Выпад [Nick]', masteryId: 'nick', href: '/faq' },
  { id: 'dart', name: 'Дротик', detail: 'Подавление [Vex]', masteryId: 'vex', href: '/faq' },
  { id: 'flail', name: 'Цеп', detail: 'Изнурение [Sap]', masteryId: 'sap', href: '/faq' },
  { id: 'glaive', name: 'Глефа', detail: 'Задевание [Graze]', masteryId: 'graze', href: '/faq' },
  { id: 'greataxe', name: 'Секира', detail: 'Прорубание [Cleave]', masteryId: 'cleave', href: '/faq' },
  { id: 'greatclub', name: 'Большая дубина', detail: 'Толкание [Push]', masteryId: 'push', href: '/faq' },
  { id: 'greatsword', name: 'Двуручный меч', detail: 'Задевание [Graze]', masteryId: 'graze', href: '/faq' },
  { id: 'halberd', name: 'Алебарда', detail: 'Прорубание [Cleave]', masteryId: 'cleave', href: '/faq' },
  { id: 'hand-crossbow', name: 'Ручной арбалет', detail: 'Подавление [Vex]', masteryId: 'vex', href: '/faq' },
  { id: 'handaxe', name: 'Ручной топор', detail: 'Подавление [Vex]', masteryId: 'vex', href: '/faq' },
  { id: 'heavy-crossbow', name: 'Тяжёлый арбалет', detail: 'Толкание [Push]', masteryId: 'push', href: '/faq' },
  { id: 'javelin', name: 'Метательное копьё', detail: 'Замедление [Slow]', masteryId: 'slow', href: '/faq' },
  { id: 'lance', name: 'Пика', detail: 'Опрокидывание [Topple]', masteryId: 'topple', href: '/faq' },
  { id: 'light-crossbow', name: 'Лёгкий арбалет', detail: 'Замедление [Slow]', masteryId: 'slow', href: '/faq' },
  { id: 'light-hammer', name: 'Лёгкий молот', detail: 'Выпад [Nick]', masteryId: 'nick', href: '/faq' },
  { id: 'longbow', name: 'Длинный лук', detail: 'Замедление [Slow]', masteryId: 'slow', href: '/faq' },
  { id: 'longsword', name: 'Длинный меч', detail: 'Изнурение [Sap]', masteryId: 'sap', href: '/faq' },
  { id: 'mace', name: 'Булава', detail: 'Изнурение [Sap]', masteryId: 'sap', href: '/faq' },
  { id: 'maul', name: 'Молот', detail: 'Опрокидывание [Topple]', masteryId: 'topple', href: '/faq' },
  { id: 'morningstar', name: 'Моргенштерн', detail: 'Изнурение [Sap]', masteryId: 'sap', href: '/faq' },
  { id: 'musket', name: 'Мушкет', detail: 'Замедление [Slow]', masteryId: 'slow', href: '/faq' },
  { id: 'pike', name: 'Длинное копьё', detail: 'Толкание [Push]', masteryId: 'push', href: '/faq' },
  { id: 'pistol', name: 'Пистолет', detail: 'Подавление [Vex]', masteryId: 'vex', href: '/faq' },
  { id: 'quarterstaff', name: 'Боевой посох', detail: 'Опрокидывание [Topple]', masteryId: 'topple', href: '/faq' },
  { id: 'rapier', name: 'Рапира', detail: 'Подавление [Vex]', masteryId: 'vex', href: '/faq' },
  { id: 'scimitar', name: 'Скимитар', detail: 'Выпад [Nick]', masteryId: 'nick', href: '/faq' },
  { id: 'shortbow', name: 'Короткий лук', detail: 'Подавление [Vex]', masteryId: 'vex', href: '/faq' },
  { id: 'shortsword', name: 'Короткий меч', detail: 'Подавление [Vex]', masteryId: 'vex', href: '/faq' },
  { id: 'sickle', name: 'Серп', detail: 'Выпад [Nick]', masteryId: 'nick', href: '/faq' },
  { id: 'sling', name: 'Праща', detail: 'Замедление [Slow]', masteryId: 'slow', href: '/faq' },
  { id: 'spear', name: 'Копьё', detail: 'Изнурение [Sap]', masteryId: 'sap', href: '/faq' },
  { id: 'trident', name: 'Трезубец', detail: 'Опрокидывание [Topple]', masteryId: 'topple', href: '/faq' },
  { id: 'war-pick', name: 'Боевой клевец', detail: 'Изнурение [Sap]', masteryId: 'sap', href: '/faq' },
  { id: 'warhammer', name: 'Боевой молот', detail: 'Толкание [Push]', masteryId: 'push', href: '/faq' },
  { id: 'whip', name: 'Кнут', detail: 'Замедление [Slow]', masteryId: 'slow', href: '/faq' }
] as const;

const SIMPLE_WEAPON_IDS = new Set([
  'club', 'dagger', 'greatclub', 'handaxe', 'javelin', 'light-hammer',
  'mace', 'quarterstaff', 'sickle', 'spear', 'dart', 'light-crossbow',
  'shortbow', 'sling'
]);

const RANGED_WEAPON_IDS = new Set([
  'blowgun', 'dart', 'hand-crossbow', 'heavy-crossbow', 'light-crossbow',
  'longbow', 'musket', 'pistol', 'shortbow', 'sling'
]);

export const WEAPON_MASTERY_OPTIONS = WEAPON_MASTERY_OPTIONS_RAW.map((option) => ({
  ...option,
  category: SIMPLE_WEAPON_IDS.has(option.id) ? 'simple' : 'martial',
  rangeType: RANGED_WEAPON_IDS.has(option.id) ? 'ranged' : 'melee'
}));

export const BLOOD_CURSE_OPTIONS = [
  { id: 'blood-curse-of-the-anxious', name: 'Проклятие беспокойства', description: 'Вы знаете это Проклятие крови и можете применять его с помощью способности «Проклятая кровь». Усиление проклятия расходует кость магии крови согласно правилам класса.', href: '/classes/bloodhunter#feature-проклятая-кровь-1' },
  { id: 'blood-curse-of-the-marked', name: 'Проклятие меченого', description: 'Вы знаете это Проклятие крови и можете применять его с помощью способности «Проклятая кровь». Усиление проклятия расходует кость магии крови согласно правилам класса.', href: '/classes/bloodhunter#feature-проклятая-кровь-1' },
  { id: 'blood-curse-of-the-fallen-puppet', name: 'Проклятие павшей марионетки', description: 'Вы знаете это Проклятие крови и можете применять его с помощью способности «Проклятая кровь». Усиление проклятия расходует кость магии крови согласно правилам класса.', href: '/classes/bloodhunter#feature-проклятая-кровь-1' },
  { id: 'blood-curse-of-corrosion', name: 'Проклятие распирающей агонии', description: 'В качестве бонусного действия вы проклинаете существо, которое видите в пределах 30 футов. До конца вашего следующего хода, когда цель получает урон от колющего или рубящего оружия, она также получает некротический урон, равный одному броску кости магии крови.\n\nУсиление: проклятие длится 1 минуту. В конце каждого своего хода проклятое существо может совершить спасбросок Телосложения, прекращая эффект при успехе.', href: '/classes/bloodhunter#feature-проклятая-кровь-1' },
  { id: 'blood-curse-of-the-muddled-mind', name: 'Проклятие помутнённого рассудка', description: 'Вы знаете это Проклятие крови и можете применять его с помощью способности «Проклятая кровь». Усиление проклятия расходует кость магии крови согласно правилам класса.', href: '/classes/bloodhunter#feature-проклятая-кровь-1' },
  { id: 'blood-curse-of-binding', name: 'Проклятие привязки', description: 'Вы знаете это Проклятие крови и можете применять его с помощью способности «Проклятая кровь». Усиление проклятия расходует кость магии крови согласно правилам класса.', href: '/classes/bloodhunter#feature-проклятая-кровь-1' },
  { id: 'blood-curse-of-the-eyeless', name: 'Проклятие слепоты', description: 'Вы знаете это Проклятие крови и можете применять его с помощью способности «Проклятая кровь». Усиление проклятия расходует кость магии крови согласно правилам класса.', href: '/classes/bloodhunter#feature-проклятая-кровь-1' },
  { id: 'blood-curse-of-exposure', name: 'Проклятие уязвимости', description: 'Вы знаете это Проклятие крови и можете применять его с помощью способности «Проклятая кровь». Усиление проклятия расходует кость магии крови согласно правилам класса.', href: '/classes/bloodhunter#feature-проклятая-кровь-1' }
] as const;

export function buildClassFeatureOptions(fightingStyleOptions: any[]) {
  const fighterStyleOptions = fightingStyleOptions.filter((option) => {
    const requirements = Array.isArray(option.requirements) ? option.requirements : [];
    return requirements.every((requirement) =>
      String(requirement).trim().toLocaleLowerCase('ru') === 'умение боевой стиль'
    );
  });

  const faithOptions = [
    ...DEITY_OPTIONS,
    {
      id: 'faith-other-deity',
      kind: 'custom-deity',
      name: 'Другое божество или пантеон',
      detail: 'Создайте собственного покровителя или опишите божество из другого сеттинга.'
    }
  ];
  const faithGroup = (description: string, extraOptions: any[] = []) => ({
    id: 'faith',
    name: 'Божество или духовный путь',
    count: 1,
    description,
    href: FAITH_SOURCE_URL,
    options: [...extraOptions, ...faithOptions]
  });

  return {
  fighter: [{ id: 'fighting-style', name: 'Боевой стиль', count: 1, options: fighterStyleOptions }],
  cleric: [{
    id: 'divine-order', name: 'Божественный порядок', count: 1, href: '/classes/cleric#feature-божественный-порядок-1', options: [
      { id: 'protector', name: 'Защитник', detail: 'Владение воинским оружием и тяжёлой бронёй', exportDescription: 'Защитник. Обученный битве, вы получаете владение воинским оружием и тяжёлыми доспехами.', href: '/classes/cleric#feature-божественный-порядок-1', effects: [{ type: 'weaponProficiency', categories: ['Воинское оружие'] }, { type: 'armorTraining', categories: ['Тяжёлая броня'] }] },
      { id: 'thaumaturge', name: 'Чудотворец', detail: 'Дополнительный заговор жреца; бонус Мудрости к Магии или Религии', exportDescription: 'Чудотворец. Вы знаете 1 дополнительный заговор из списка заклинаний жреца. Кроме того, ваша мистическая связь с божественным даёт вам бонус к проверкам Интеллекта (Магия или Религия). Бонус равен вашему модификатору Мудрости (минимум +1).', href: '/classes/cleric#feature-божественный-порядок-1', effects: [{ type: 'extraCantrip', spellList: 'cleric', count: 1 }, { type: 'skillCheckBonus', skills: ['Магия', 'Религия'], ability: 'wisdom' }] }
    ]
  }, faithGroup('Выберите божество, которому служит жрец. Домены указаны как подсказка для будущего выбора подкласса.')],
  druid: [{
    id: 'primal-order', name: 'Первобытный порядок', count: 1, href: '/classes/druid#feature-первобытный-порядок-1', options: [
      { id: 'magician', name: 'Маг', detail: 'Дополнительный заговор друида; бонус Мудрости к Магии или Природе', href: '/classes/druid#feature-первобытный-порядок-1', effects: [{ type: 'extraCantrip', spellList: 'druid', count: 1 }, { type: 'skillCheckBonus', skills: ['Магия', 'Природа'], ability: 'wisdom' }] },
      { id: 'warden', name: 'Страж', detail: 'Владение воинским оружием и средней бронёй', href: '/classes/druid#feature-первобытный-порядок-1', effects: [{ type: 'weaponProficiency', categories: ['Воинское оружие'] }, { type: 'armorTraining', categories: ['Средняя броня'] }] }
    ]
  }, faithGroup(
    'Друид может почитать божество природы либо саму природу и её духов.',
    [{ id: 'faith-nature-itself', name: 'Сама природа и её духи', detail: 'Духовный путь без служения одному божеству.' }]
  )],
  paladin: [faithGroup(
    'Божество не является источником силы паладина: силу даёт его клятва. Здесь можно выбрать связанного с клятвой покровителя или оставить путь светским.',
    [{ id: 'faith-sacred-oath', name: 'Только клятва — без божества', detail: 'Паладин следует идеалам выбранной клятвы и не служит одному божеству.' }]
  )],
  monk: [faithGroup(
    'Монастырь может быть связан с божеством либо с самостоятельной философской традицией.',
    [{ id: 'faith-philosophy', name: 'Философская или монастырская традиция', detail: 'Духовная дисциплина без служения одному божеству.' }]
  )],
  warlock: [{
    id: 'eldritch-invocation', name: 'Таинственное воззвание', count: 1, href: '/classes/warlock#feature-таинственные-воззвания-1', options: [
      { id: 'pact-of-the-tome', name: 'Договор гримуара', detail: 'Открывает отдельный выбор заговоров и ритуалов', effects: [{ type: 'spellSource', source: 'pact-tome' }], href: '/classes/warlock#feature-таинственные-воззвания-1' },
      { id: 'pact-of-the-blade', name: 'Договор клинка', detail: 'Создаёт или связывает оружие договора', effects: [{ type: 'pactWeapon' }], href: '/classes/warlock#feature-таинственные-воззвания-1' },
      { id: 'pact-of-the-chain', name: 'Договор цепи', detail: 'Даёт Поиск фамильяра и особые формы фамильяра', effects: [{ type: 'fixedSpell', spell: 'Поиск фамильяра' }], href: '/classes/warlock#feature-таинственные-воззвания-1' },
      { id: 'armor-of-shadows', name: 'Доспехи теней', detail: 'Доспех мага без траты ячейки', effects: [{ type: 'fixedSpell', spell: 'Доспех мага' }], href: '/classes/warlock#feature-таинственные-воззвания-1' },
      { id: 'eldritch-mind', name: 'Мистический разум', detail: 'Преимущество на спасброски Телосложения для концентрации', effects: [{ type: 'trait' }], href: '/classes/warlock#feature-таинственные-воззвания-1' }
    ]
  }, {
    id: 'warlock-patron',
    name: 'Конкретный покровитель',
    count: 1,
    description: 'Выберите сущность, с которой заключён договор. Вид покровителя подсказывает подходящий подкласс, но его мировоззрение не ограничивает мировоззрение героя.',
    href: WARLOCK_PATRON_SOURCE_URL,
    secondaryHref: WARLOCK_PATRON_DNDSU_URL,
    options: WARLOCK_PATRONS
  }]
  } as Record<string, any[]>;
}
import { DEITY_OPTIONS, FAITH_SOURCE_URL } from './deities.ts';
import { WARLOCK_PATRONS, WARLOCK_PATRON_SOURCE_URL, WARLOCK_PATRON_DNDSU_URL } from './patrons.ts';
