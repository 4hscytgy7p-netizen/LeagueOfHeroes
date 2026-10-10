import type { ExplorationRuleDefinition, ExplorationTopicDefinition } from '../utils/exploration.ts';

function phb(id: string, title: string, sectionId: string, anchor: string, blockIds: string[], options: Partial<ExplorationRuleDefinition> = {}): ExplorationRuleDefinition {
  return { id, title, source: { bookId: 'phb-2024-ru', sectionId, anchor, blockIds }, ...options };
}
function dmg(id: string, title: string, sectionId: string, anchor: string, blockIds: string[], options: Partial<ExplorationRuleDefinition> = {}): ExplorationRuleDefinition {
  return { id, title, source: { bookId: 'dmg-2024-ru', sectionId, anchor, blockIds }, ...options };
}

// Only pointers and editorial navigation live here. Rules and numbers come from book JSON.
export const explorationTopicDefinitions: ExplorationTopicDefinition[] = [
  {
    id: 'travel', title: 'Темп и время в пути', description: 'Расстояния, влияние темпа на проверки и продолжительное движение.', keywords: 'travel pace скорость марш транспорт скакуны',
    rules: [
      phb('travel-pace', 'Темп путешествия', 'exploration', 'p19-22', ['p19-25','p19-27','p19-28','p19-29'], { open: true, travelTable: true }),
      dmg('travel-hours', 'Больше восьми часов в дороге', 'exploration', 'p34-8', ['p34-12'], { glossaryIds: ['exhaustion'] }),
      phb('travel-mounts', 'Скакуны и транспорт в PHB', 'exploration', 'p19-22', ['p19-23','p19-31','p19-32']),
      dmg('travel-special', 'Особое перемещение и транспорт в DMG', 'exploration', 'p34-8', ['p34-13','p34-14','p34-15','p34-16','p34-17']),
    ],
  },
  {
    id: 'terrain', title: 'Местность и маршрут', description: 'Максимальный темп, расстояния обнаружения, навигация и добыча пропитания.', keywords: 'terrain лес горы болото пустыня арктика выживание заблудиться еда вода',
    rules: [
      dmg('terrain-table', 'Местность путешествия', 'exploration', 'p34-22', ['p34-23','p34-24'], { open: true }),
      dmg('terrain-roads', 'Дороги и медленные путешественники', 'exploration', 'p34-8', ['p34-9','p34-10','p34-11']),
      dmg('terrain-navigation', 'Как не сбиться с пути', 'exploration', 'p36-1', ['p36-2','p36-3','p36-4']),
      dmg('terrain-foraging', 'Поиск пищи и воды', 'exploration', 'p35-13', ['p35-14','p35-15'], { glossaryIds: ['Malnutrition','dehydration'] }),
    ],
    leagueLinks: [{ label: 'Контейнеры и запасы на персонаже', href: '/heroes-league-errata#containers' }],
  },
  {
    id: 'search', title: 'Поиск и наблюдение', description: 'Скрытые объекты, пассивное восприятие и различие наблюдения и анализа.', keywords: 'search perception investigation внимательность восприятие расследование следы',
    rules: [
      phb('search-action', 'Действие «Поиск»', 'rules-glossary-4', 'p357-35', ['p357-37','p357-39'], { open: true, glossaryIds: ['search'] }),
      phb('search-objects', 'Где искать скрытый объект', 'exploration', 'p19-7', ['p19-8','p19-9']),
      phb('search-passive', 'Пассивное восприятие', 'rules-glossary-4', 'p357-16', ['p357-18','p357-19'], { glossaryIds: ['Passive Perception'] }),
      dmg('search-analysis', 'Когда нужен анализ', 'exploration', 'p31-5', ['p31-7','p31-8','p31-9']),
      dmg('search-sound', 'Дистанция слышимости', 'exploration', 'p32-3', ['p32-2','p32-4']),
    ],
  },
  {
    id: 'stealth', title: 'Скрытность', description: 'Условия засады, обнаружение и события, которые раскрывают персонажа.', keywords: 'stealth hide засада прятаться невидимый укрытие',
    rules: [phb('stealth-hide', 'Действие «Засада»', 'rules-glossary-2', 'p351-16', ['p351-18','p351-19','p351-20'], { open: true, glossaryIds: ['hide','invisible','cover'] })],
  },
  {
    id: 'light', title: 'Свет и видимость', description: 'Освещение, заслонённая местность и тёмное зрение.', keywords: 'light vision darkness темнота факел фонарь туман',
    rules: [
      phb('light-levels', 'Яркий свет, тусклый свет и тьма', 'exploration', 'p18-11', ['p18-13','p18-14','p18-15'], { open: true, glossaryIds: ['bright-light','dim-light','darkness'] }),
      phb('light-obscured', 'Слабое и сильное заслонение', 'exploration', 'p18-8', ['p18-9','p18-10'], { glossaryIds: ['lightly-obscured','heavily-obscured','blinded'] }),
      phb('light-darkvision', 'Что меняет тёмное зрение', 'rules-glossary-6', 'p364-16', ['p364-18'], { glossaryIds: ['darkvision'] }),
    ],
  },
  {
    id: 'movement', title: 'Плавание и лазание', description: 'Стоимость перемещения, дыхание и опасности воды.', keywords: 'swimming climbing underwater плавать лазать подводный глубина холодная вода',
    rules: [
      phb('movement-swim', 'Плавание', 'rules-glossary-4', 'p357-26', ['p357-28'], { open: true, glossaryIds: ['swimming','swim-speed'] }),
      phb('movement-climb', 'Лазание', 'rules-glossary-2', 'p353-30', ['p353-32','p353-33'], { glossaryIds: ['climbing','climb-speed'] }),
      phb('movement-difficult', 'Труднопроходимая местность', 'rules-glossary-6', 'p364-5', ['p364-7','p364-8','p364-9'], { glossaryIds: ['difficult-terrain'] }),
      phb('movement-breath', 'Задержка дыхания и удушье', 'rules-glossary-6', 'p364-19', ['p364-21'], { glossaryIds: ['suffocation'] }),
      dmg('movement-water', 'Глубокая и холодная вода', 'environment', 'p85-8', ['p85-9','p85-24','p85-25']),
      dmg('movement-visibility', 'Обнаружение под водой', 'exploration', 'p32-9', ['p32-8','p32-10']),
    ],
  },
  {
    id: 'falling', title: 'Падения', description: 'Урон при приземлении и реакция при падении в воду.', keywords: 'falling высота обрыв дробящий акробатика атлетика',
    rules: [phb('falling-damage', 'Падение и приземление', 'rules-glossary-4', 'p357-1', ['p357-3','p357-4'], { open: true, glossaryIds: ['falling','prone'] })],
    leagueLinks: [{ label: 'Отдельное правило травм Лиги · DMG 2014', href: '/heroes-league-errata#injuries' }],
  },
  {
    id: 'survival', title: 'Истощение и запасы', description: 'Последствия истощения, ежедневная потребность в пище и воде.', keywords: 'exhaustion fatigue голод жажда рацион отдых survival',
    rules: [
      phb('survival-exhaustion', 'Истощение в редакции 2024', 'rules-glossary-2', 'p352-36', ['p352-38','p352-39','p352-40','p352-41','p352-42'], { open: true, glossaryIds: ['exhaustion','long-rest'] }),
      phb('survival-food', 'Пища и недоедание', 'rules-glossary-3', 'p355-8', ['p355-10','p355-11','p355-12'], { glossaryIds: ['Malnutrition'] }),
      phb('survival-water', 'Вода и обезвоживание', 'rules-glossary-3', 'p355-16', ['p355-18','p355-19','p355-20'], { glossaryIds: ['dehydration'] }),
    ],
    leagueLinks: [{ label: 'Контейнеры и бурдюк на персонаже', href: '/heroes-league-errata#containers' }],
  },
  {
    id: 'weather', title: 'Погода и окружающая среда', description: 'Погода на этапе пути, жара, холод, ветер, осадки, лёд и высота.', keywords: 'weather temperature environment мороз метель дождь снег жара ветер климат',
    rules: [
      dmg('weather-roll', 'Определение погоды', 'exploration', 'p34-1', ['p34-2','p34-3','p34-5','p34-6','p34-7'], { open: true }),
      dmg('weather-precipitation', 'Сильные осадки и ветер', 'environment', 'p85-15', ['p85-16','p85-17','p85-18','p85-19']),
      dmg('weather-temperature', 'Экстремальная жара и холод', 'environment', 'p85-26', ['p85-27','p85-28','p85-29'], { glossaryIds: ['exhaustion'] }),
      dmg('weather-ice', 'Скользкий и тонкий лёд', 'environment', 'p85-20', ['p85-21','p85-22','p85-23']),
      dmg('weather-altitude', 'Большая высота', 'environment', 'p85-5', ['p85-6','p85-7']),
    ],
  },
  {
    id: 'chases', title: 'Погони', description: 'Инструменты мастера для инициативы, рывков, побега и осложнений.', keywords: 'chase pursuit escape погоня убежать преследование рывок',
    rules: [
      dmg('chases-start', 'Начало погони и рывки', 'chases', 'p64-9', ['p64-10','p64-11','p64-15'], { open: true, glossaryIds: ['dash','exhaustion'] }),
      dmg('chases-attacks', 'Атаки и заклинания в погоне', 'chases', 'p64-16', ['p64-17','p64-18']),
      dmg('chases-escape', 'Когда удаётся скрыться', 'chases', 'p64-19', ['p64-20','p64-21','p65-1','p65-3','p65-4','p65-5']),
      dmg('chases-complications', 'Осложнения: город и дикая местность', 'chases', 'p65-16', ['p65-17','p66-2','p66-3','p66-7','p66-8']),
    ],
  },
];
