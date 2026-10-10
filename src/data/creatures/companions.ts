import type { Creature } from '../../types/creature.ts';
import { classCompanions } from './classCompanions.ts';
import { spellCreatures } from './spellCreatures.ts';
import { drakkenheimCreatures } from './drakkenheim.ts';

// Verified against the exact 5etools publications; formulas refer to the summoner.
// All artwork stays on the external host. Art sources are independent from rule editions.
const imageBase = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/bestiary';
const calculationNote = 'Числа после «ваш» относятся к создателю, а не к характеристикам компаньона.';

export const companions: Creature[] = [
  ...classCompanions,
  ...spellCreatures,
  ...drakkenheimCreatures,
  {
    id: 'wildfire-spirit-tce', name: 'Дух дикого огня', nameEn: 'Wildfire Spirit',
    contextLabel: 'Компаньон', calculationNote,
    source: { code: 'TCE', name: 'Котёл Таши со всякой всячиной', page: 40, edition: '2014', href: 'https://5e.tools/bestiary.html#wildfire%20spirit_tce' },
    size: 'Маленький', type: 'Элементаль', alignment: 'Без мировоззрения',
    armorClass: '13 (природный доспех)', hitPoints: '5 + пятикратный уровень друида',
    speed: '30 футов, полёт 30 футов (парение)',
    abilities: { str: 10, dex: 14, con: 14, int: 13, wis: 15, cha: 11 },
    damageImmunities: ['Огонь'],
    conditionImmunities: [
      { name: 'Очарованный', glossaryId: 'charmed' }, { name: 'Испуганный', glossaryId: 'frightened' },
      { name: 'Схваченный', glossaryId: 'grappled' }, { name: 'Сбитый с ног', glossaryId: 'prone' },
      { name: 'Опутанный', glossaryId: 'restrained' },
    ],
    senses: 'Тёмное зрение 60 футов, пассивное Восприятие 12',
    languages: 'Понимает языки, на которых вы говорите', proficiencyBonus: 'Равен вашему бонусу мастерства (БМ)',
    traits: [],
    actions: [
      { name: 'Огненное семя', paragraphs: ['Дальнобойная атака оружием: для попадания используется ваш модификатор атаки заклинанием; дальность 60 футов, одна видимая вами цель. Попадание: 1к6 + БМ урона Огнём.'] },
      { name: 'Огненная телепортация', paragraphs: ['Дух и выбранные вами согласные существа в пределах 5 футов от него телепортируются на расстояние до 15 футов в свободные пространства, которые вы видите. Затем каждое существо в пределах 5 футов от оставленного духом пространства совершает спасбросок Ловкости против Сл ваших заклинаний. При провале оно получает 1к6 + БМ урона Огнём.'] },
    ],
    reactions: [],
    information: [
      'Компаньон друида Круга Дикого Огня. Друид определяет его облик: например, зверь в пламени или фигура из горящих ветвей.',
      'Появление, команды и продолжительность существования описаны в особенности «Призыв духа дикого огня». БМ, уровень друида, модификатор атаки заклинанием и Сл заклинаний относятся к призвавшему друиду.',
    ],
    token: { url: `${imageBase}/tokens/TCE/Wildfire%20Spirit.webp`, alt: 'Токен духа дикого огня', sourceHref: 'https://5e.tools/bestiary.html#wildfire%20spirit_tce', caption: 'Токен из хранилища изображений 5etools · TCE' },
  },
  {
    id: 'steel-defender-efa', name: 'Стальной защитник', nameEn: 'Steel Defender',
    contextLabel: 'Компаньон', calculationNote,
    source: { code: 'EFA', name: 'Эберрон: Кузня артефактора', page: 19, edition: '2024', href: 'https://5e.tools/bestiary.html#steel%20defender_efa' },
    size: 'Средний', type: 'Конструкт', alignment: 'Нейтральный',
    armorClass: '12 + ваш модификатор Интеллекта', hitPoints: '5 + пятикратный уровень артефактора',
    hitDice: 'Количество костей хитов (к8) равно вашему уровню артефактора', speed: '40 футов',
    abilities: { str: 14, dex: 12, con: 14, int: 4, wis: 10, cha: 6 },
    savingThrowBonus: 'Ваш БМ', damageImmunities: ['Яд'],
    conditionImmunities: [
      { name: 'Очарованный', glossaryId: 'charmed' }, { name: 'Истощение', glossaryId: 'exhaustion' }, { name: 'Отравленный', glossaryId: 'poisoned' },
    ],
    senses: 'Тёмное зрение 60 футов, пассивное Восприятие 10', languages: 'Понимает известные вам языки',
    proficiencyBonus: 'Равен вашему бонусу мастерства (БМ)',
    traits: [
      { name: 'Стальная связь', paragraphs: ['Добавляйте ваш бонус мастерства ко всем проверкам характеристик и спасброскам защитника.'] },
    ],
    actions: [
      { name: 'Силовой разрыв', paragraphs: ['Бросок рукопашной атаки: бонус равен вашему модификатору атаки заклинанием; досягаемость 5 футов. Попадание: 1к8 + 2 + ваш модификатор Интеллекта Силового урона.'] },
      { name: 'Ремонт (3/день)', paragraphs: ['Защитник либо один Конструкт или объект, видимый им в пределах 5 футов, восстанавливает 2к8 + ваш модификатор Интеллекта хитов.'] },
    ],
    reactions: [
      { name: 'Отражение атаки', paragraphs: ['Условие: существо, которое защитник видит в пределах 5 футов от себя, совершает бросок атаки по другому существу, не по защитнику.', 'Эффект: вызвавшее реакцию существо совершает этот бросок атаки с Помехой.'] },
    ],
    information: [
      'Созданный Боевым кузнецом компаньон. Артефактор выбирает внешний вид и две или четыре конечности; это не меняет характеристики.',
      'Команды, восстановление и создание нового защитника описаны в особенности «Стальной защитник». Формулы используют уровень и характеристики создателя; в блоке показана версия EFA, совместимая с опубликованным здесь подклассом.',
    ],
    token: { url: `${imageBase}/tokens/EFA/Steel%20Defender.webp`, alt: 'Токен стального защитника', sourceHref: 'https://5e.tools/bestiary.html#steel%20defender_efa', caption: 'Токен из хранилища изображений 5etools · EFA' },
    image: { url: `${imageBase}/TCE/Steel%20Defender.webp`, alt: 'Иллюстрация стального защитника из Котла Таши', sourceHref: 'https://5e.tools/bestiary.html#steel%20defender_tce', caption: 'Иллюстрация из TCE. Характеристики в этом блоке приведены по EFA.' },
  },
  {
    id: 'eldritch-cannon-efa', name: 'Мистическая пушка', nameEn: 'Eldritch Cannon',
    kind: 'object', contextLabel: 'Магический объект', calculationNote,
    source: { code: 'EFA', name: 'Эберрон: Кузня артефактора', page: 16, edition: '2024', href: 'https://5e.tools/objects.html#eldritch%20cannon_efa' },
    size: 'Маленький или Крошечный', type: 'Объект',
    armorClass: '18', hitPoints: '5 × ваш уровень Артефактора (наложение «Починки» восстанавливает пушке 2к6 хитов)',
    damageImmunities: ['Яд', 'Психика'], conditionImmunities: [],
    traits: [], actions: [], reactions: [],
    bonusActions: [
      { name: 'Активация пушки (вы должны находиться в пределах 60 футов от пушки)', paragraphs: ['Бонусным действием вы приказываете пушке использовать Огнемёт, Силовую баллисту или Защитник; вы можете приказать пушке переместиться на расстояние вплоть до 15 футов до этого или после.'] },
      { name: 'Огнемёт', paragraphs: ['Пушка извергает пламя 15-футовым Конусом. Каждое существо в этой области совершает спасбросок Ловкости против вашей Сл спасброска заклинаний, получая 2д8 урона Огнём при провале или половину этого урона при успехе. Воспламеняемые объекты в этой области начинают гореть, если их никто не несёт и не носит.'] },
      { name: 'Силовая баллиста', paragraphs: ['Совершите бросок дальнобойной атаки заклинанием, исходящий от пушки по одному существу или объекту в пределах 120 футов от неё. При попадании цель получает 2д8 урона Силовым полем и, если это существо, отталкивается от пушки на расстояние вплоть до 5 футов.'] },
      { name: 'Защитник', paragraphs: ['Пушка дарует себе и каждому выбранному вами существу в пределах 10 футов временные хиты: 1к8 + ваш модификатор Интеллекта (для этого расчёта модификатор не меньше +1).'] },
    ],
    information: [
      'Магический объект, создаваемый особенностью «Мистическая пушка» Артиллериста на 3-м уровне. Правила создания, исчезновения и улучшений приведены в особенностях подкласса.',
      'Характеристики, чувства и языки в записи EFA не указаны. Перемещение по команде описано в «Активации пушки».',
    ],
    token: { url: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/objects/tokens/EFA/Eldritch%20Cannon.webp', alt: 'Токен мистической пушки', sourceHref: 'https://5e.tools/objects.html#eldritch%20cannon_efa', caption: 'Токен из хранилища изображений 5etools · EFA' },
  }
];
