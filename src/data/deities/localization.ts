export const pantheonLabels: Record<string, string> = {
  Dwarven: 'Дварфский', Norse: 'Скандинавский', Elven: 'Эльфийский', 'Faerûnian': 'Забытые Королевства',
  'Forgotten Realms': 'Забытые Королевства', Egyptian: 'Египетский', Greek: 'Греческий', Eberron: 'Эберрон',
  Celtic: 'Кельтский', Halfling: 'Полуросликов', 'Dawn War': 'Война Рассвета', Theros: 'Терос',
  Gnome: 'Гномий', Gnomish: 'Гномий', Nonhuman: 'Божества разных народов', Orc: 'Орочий',
  Greyhawk: 'Серый Ястреб', Dragonlance: 'Сага о Копье', Duergar: 'Дуэргарский', 'Yuan-ti': 'Юань-ти',
  Drow: 'Дроу', Unknown: 'Пантеон не указан',
};
export const domainLabels: Record<string, string> = { Trickery: 'Обман', Tempest: 'Буря', Life: 'Жизнь', Arcana: 'Магия', Knowledge: 'Знание', Light: 'Свет', War: 'Война', Peace: 'Мир', Death: 'Смерть', Grave: 'Упокоение', Order: 'Порядок', Nature: 'Природа', Forge: 'Кузня', Twilight: 'Сумрак', Unknown: 'Не указан' };
export const sourceLabels: Record<string, string> = {
  PHB: 'Книга игрока (2014)', DMG: 'Руководство мастера (2014)', XDMG: 'Руководство мастера (2024)',
  SCAG: 'Путеводитель приключенца по Побережью Меча', MTF: 'Том Морденкайнена о противниках',
  VGM: 'Справочник Воло по монстрам', ERLW: 'Эберрон: Восхождение после Последней войны',
  MOT: 'Мифические одиссеи Тероса', DSotDQ: 'Сага о Копье: Тень Королевы Драконов',
  FRHoF: 'Забытые Королевства: Герои Фаэруна', VRGR: 'Руководство Ван Рихтена по Равенлофту', GoS: 'Призраки Солтмарша',
};
export const categoryLabels: Record<string, string> = {
  'The Mordinsamman': 'Морндинсамман', 'The Seldarine': 'Селдарин', 'The Dark Seldarine': 'Тёмный Селдарин',
  'The Sovereign Host': 'Сонм Владык', 'The Dark Six': 'Тёмная Шестёрка', 'Other Faiths of Eberron': 'Другие верования Эберрона',
  Good: 'Добрые боги', 'The Gods of Good': 'Добрые боги', Evil: 'Злые боги', 'The Gods of Evil': 'Злые боги',
  Neutral: 'Нейтральные боги', 'The Gods of Neutrality': 'Нейтральные боги', Unknown: 'Не указана',
};

const words: Record<string, [string, string]> = Object.fromEntries(`
abjuration|ограждение|ограждения
abundance|изобилие|изобилия
adventure|приключения|приключений
affliction|недуги|недугов
aging|старение|старения
agriculture|земледелие|земледелия
air|воздух|воздуха
ambition|честолюбие|честолюбия
animal life|животный мир|животного мира
archery|стрельба из лука|стрельбы из лука
arrogance|высокомерие|высокомерия
art|искусство|искусства
artifice|изобретательство|изобретательства
arts|искусства|искусств
assassination|убийства исподтишка|убийств исподтишка
athletics|атлетика|атлетики
battle|битва|битвы
beasts|звери|зверей
beauty|красота|красоты
betrayal|предательство|предательства
birth|рождение|рождения
bloodshed|кровопролитие|кровопролития
brewing|пивоварение|пивоварения
buried secrets|погребённые тайны|погребённых тайн
cats|кошки|кошек
change|перемены|перемен
chaos|хаос|хаоса
chivalry|рыцарство|рыцарства
civilization|цивилизация|цивилизации
clan|клан|клана
combat prowess|боевое мастерство|боевого мастерства
commerce|торговля|торговли
common sense|здравый смысл|здравого смысла
community|община|общины
conquest|завоевание|завоевания
courage|мужество|мужества
craft|ремесло|ремесла
crafts|ремёсла|ремёсел
creation|созидание|созидания
creativity|творчество|творчества
dance|танец|танца
dark magic|тёмная магия|тёмной магии
darkness|тьма|тьмы
desert storms|бури в пустыне|бурь в пустыне
dawn|рассвет|рассвета
death|смерть|смерти
deception|обман|обмана
destiny|предначертание|предначертания
destruction|разрушение|разрушения
discovery|открытия|открытий
disease|болезни|болезней
discord|раздор|раздора
divination|прорицание|прорицания
dreams|сны|снов
earth|земля|земли
earthquakes|землетрясения|землетрясений
elven ancestors|предки эльфов|предков эльфов
enchantment|очарование|очарования
endurance|стойкость|стойкости
envy|зависть|зависти
eternal darkness|вечная тьма|вечной тьмы
evil|зло|зла
evil dragons|злые драконы|злых драконов
evil magic|злая магия|злой магии
evil secrets|зловещие тайны|зловещих тайн
explorers|исследователи|исследователей
family|семья|семьи
fate|судьба|судьбы
fertility|плодородие|плодородия
festivity|празднества|празднеств
fire|огонь|огня
fire giants|огненные великаны|огненных великанов
forests|леса|лесов
forge|кузня|кузни
forges|кузни|кузниц
freedom|свобода|свободы
frost giants|ледяные великаны|ледяных великанов
frustration|разочарование|разочарования
gardens|сады|садов
good|добро|добра
good dragons|добрые драконы|добрых драконов
good fortune|удача|удачи
good magic|добрая магия|доброй магии
greed|жадность|жадности
grief|скорбь|скорби
growth|рост|роста
guardians|стражи|стражей
harsh weather|суровая погода|суровой погоды
harvests|урожаи|урожаев
hatred|ненависть|ненависти
healing|исцеление|исцеления
hearth|домашний очаг|домашнего очага
hedonism|наслаждения|наслаждений
hills|холмы|холмов
history|история|истории
home|дом|дома
honor|честь|чести
horizons|горизонты|горизонтов
hunger|голод|голода
hunting|охота|охоты
childbirth|роды|родов
ill luck|неудача|неудачи
insanity|помешательство|помешательства
illusion|иллюзии|иллюзий
immortality|бессмертие|бессмертия
independence|независимость|независимости
indulgence|потворство желаниям|потворства желаниям
intrigue|интриги|интриг
invention|изобретения|изобретений
joy|радость|радости
judgment|суд|суда
justice|справедливость|справедливости
keen senses|острые чувства|острых чувств
knowledge|знания|знаний
labor|труд|труда
lakes|озёра|озёр
law|закон|закона
liberty|свобода|свободы
lies|ложь|лжи
life|жизнь|жизни
light|свет|света
loss|утрата|утраты
lost treasures|потерянные сокровища|потерянных сокровищ
love|любовь|любви
luck|удача|удачи
luck in battle|удача в бою|удачи в бою
lust|страсть|страсти
madness|безумие|безумия
magic|магия|магии
marriage|брак|брака
medicine|медицина|медицины
meditation|медитация|медитации
memory|память|памяти
metalwork|обработка металла|обработки металла
mining|горное дело|горного дела
carving stone|резьба по камню|резьбы по камню
mirth|веселье|веселья
wine|вино|вина
mischief|проказничество|проказничества
misfortune|несчастья|несчастий
molten rock|расплавленный камень|расплавленного камня
moonlight|лунный свет|лунного света
moon|луна|луны
mountains|горы|гор
peaks|вершины|вершин
murder|убийство|убийства
music|музыка|музыки
motherhood|материнство|материнства
mysteries|тайны|тайн
mythals|мифали|мифалей
natural balance|природное равновесие|природного равновесия
nature|природа|природы
nature's wrath|гнев природы|гнева природы
necromancy|некромантия|некромантии
neutral magic|нейтральная магия|нейтральной магии
night|ночь|ночи
nobility|благородство|благородства
oaths|клятвы|клятв
oceans|океаны|океанов
sea creatures|морские существа|морских существ
oozes|аморфные существа|аморфных существ
order|порядок|порядка
outcasts|изгои|изгоев
outlawry|жизнь вне закона|жизни вне закона
pain|боль|боли
oppression|угнетение|угнетения
passage|переход в загробный мир|перехода в загробный мир
passion|страсть|страсти
peace|мир|мира
reason|разум|разума
plague|чума|чумы
famine|голод|голода
poetry|поэзия|поэзии
song|песни|песен
songs|песни|песен
poison|яд|яда
protection|защита|защиты
psionics|псионика|псионики
quarrying|добыча камня|добычи камня
rain|дождь|дождя
rebellion|мятеж|мятежа
revelations|откровения|откровений
revelry|буйное веселье|буйного веселья
revenge|месть|мести
retribution|возмездие|возмездия
rivers|реки|рек
livestock|домашний скот|домашнего скота
romance|романтическая любовь|романтической любви
ruler of the gods|власть над богами|власти над богами
rulers|правители|правителей
runes|руны|рун
sailors|моряки|моряков
sea|море|моря
seas|моря|морей
secrecy|сокрытие тайн|сокрытия тайн
self-improvement|самосовершенствование|самосовершенствования
self-sacrifice|самопожертвование|самопожертвования
slaughter|резня|резни
slavery|рабство|рабства
slimes|слизи|слизей
smithing|кузнечное дело|кузнечного дела
smiths|кузнецы|кузнецов
solitude|одиночество|одиночества
speech|речь|речи
writing|письменность|письменности
spellcasting|заклинания|заклинаний
spiders|пауки|пауков
stars|звёзды|звёзд
wanderers|странники|странников
stealth|скрытность|скрытности
stone carving|резьба по камню|резьбы по камню
stone giants|каменные великаны|каменных великанов
storms|бури|бурь
thunder|гром|грома
strategy|стратегия|стратегии
hordes|орды|орд
streams|ручьи|ручьёв
strength|сила|силы
strength at arms|воинская сила|воинской силы
strife|вражда|вражды
suffering|страдания|страданий
sun|солнце|солнца
sunlight|солнечный свет|солнечного света
survival|выживание|выживания
sword fighting|бой на мечах|боя на мечах
dead|мёртвые|мёртвых
harvest|урожай|урожая
hunt|охота|охоты
lost|заблудившиеся|заблудившихся
mists|туманы|туманов
polis|город-государство|города-государства
seasons|времена года|времён года
sky|небо|неба
undead|нежить|нежити
underdark|Подземье|Подземья
underworld|подземный мир|подземного мира
thievery|воровство|воровства
thieves|воры|воров
thought|мысль|мысли
time|время|времени
tracking|выслеживание|выслеживания
trade|торговля|торговли
travel|путешествия|путешествий
trickery|хитрость|хитрости
gems|самоцветы|самоцветов
wiles|уловки|уловок
truth|истина|истины
tyranny|тирания|тирании
vengeance|месть|мести
victory|победа|победы
vigilance|бдительность|бдительности
violence|насилие|насилия
treachery|вероломство|вероломства
war|война|войны
warriors|воины|воинов
war-luck|удача в войне|удачи в войне
watchfulness|бдительность|бдительности
loyalty|верность|верности
water|вода|воды
crocodiles|крокодилы|крокодилов
wealth|богатство|богатства
weather|погода|погоды
crops|посевы|посевов
wild magic|дикая магия|дикой магии
wild nature|дикая природа|дикой природы
wild places|дикие места|диких мест
wilderness|дикие земли|диких земель
winter|зима|зимы
wisdom|мудрость|мудрости
wizardry|волшебство|волшебства
wizards|волшебники|волшебников
woodlands|леса|лесов
wrath|ярость|ярости
valor|доблесть|доблести
sport|спорт|спорта
zeal|рвение|рвения
renewal|обновление|обновления
cold|холод|холода
warmth|тепло|тепла
healing|исцеление|исцеления
secrets|тайны|тайн
serpents|змеи|змей
philosophy|философия|философии
wind|ветер|ветра
primary deity of dwarves|верховное божество дварфов|верховного божества дварфов
primary god of drow|верховное божество дроу|верховного божества дроу
primary god of elves|верховное божество эльфов|верховного божества эльфов
primary god of gnomes|верховное божество гномов|верховного божества гномов
primary goddess of halflings|верховное божество полуросликов|верховного божества полуросликов
`.trim().split('\n').map(line => { const [key, normal, genitive] = line.split('|'); return [key, [normal, genitive]]; }));

const epithets: Record<string, string> = Object.fromEntries(`
Elven ancestors|Предки эльфов
He Who Watches|Тот, Кто Наблюдает
Heart of Oerth|Сердце Оэрта
Kuo-toa goddess|Богиня куо-тоа
Oathbreaker|Клятвопреступник
Philosophy of immortality and undeath|Философия бессмертия и нежизни
Philosophy of light and self-improvement|Философия света и самосовершенствования
Sailor of Sea and Sky|Мореход Моря и Неба
Scourge of Battle|Бич Битвы
Scribe of the dead|Писец Мёртвых
Weaver of Our Fate|Ткачиха Нашей Судьбы
of the Blinding Light|Ослепительного Света
of the Cudgel|Дубины
of the Forests|Лесов
of the Hearth|Домашнего Очага
the Bejeweled|Украшенный Самоцветами
the Black Rider|Чёрный Всадник
the Brawler|Драчун
the Cave Mother|Пещерная Мать
the Dweller on the Horizon|Обитатель Горизонта
the Eater of Worlds|Пожиратель Миров
the Evil|Злой
the Far Wanderer|Дальний Странник
the Invincible|Непобедимый
the Laughing Rogue|Смеющийся Плут
the Leg Breaker|Ломающий Ноги
the Many|Многоликий
the Mediator|Посредник
the Night Lord|Владыка Ночи
the Radiant Sun|Сияющее Солнце
the Reaper|Жнец
the Shalm|Шалм
the Summoner|Призыватель
the Uncaring, Archmage of the Gods|Безразличный, Архимаг Богов
the Unlooked For|Нежданный
the War Maker|Творец Войны
the Whispered One|Тот, о Ком Шепчут
the White Hand|Белая Рука
the Witch|Ведьма
`.trim().split('\n').map(line => line.split('|')));

export function translateConcept(value: string, genitive = false): string {
  const key = value.toLowerCase().trim().replace(/^and\s+/, '').replace(/^the\s+/, '');
  const direct = words[key];
  if (direct) return direct[genitive ? 1 : 0];
  if (key.includes(',')) return key.split(',').map(part => translateConcept(part, genitive)).join(', ');
  if (key.includes(' and ')) return key.split(' and ').map(part => translateConcept(part, genitive)).join(' и ');
  throw new Error(`Missing deity concept translation: ${value}`);
}

export function translateTitle(value: string, neutralGod = false): string {
  if (!value) return '';
  if (epithets[value]) return epithets[value];
  const match = value.match(/^(.*?)\b(god|goddess|deity|deities) of (.+)$/i);
  if (!match) throw new Error(`Missing deity title translation: ${value}`);
  const prefixes: Record<string, string> = { '': '', 'Bugbear': 'Багбирский ', 'Centaur and satyr': 'Бог кентавров и сатиров: ', 'Dragon': 'Драконий ', 'Drow': 'Божество дроу: ', 'Duergar': 'Божество дуэргаров: ', 'Dwarf': 'Дварфский ', 'Elf': 'Эльфийский ', 'Gnome': 'Гномий ', 'Goblinoid': 'Бог гоблиноидов: ', 'Halfling': 'Богиня полуросликов: ', 'Hill giant': 'Бог холмовых великанов: ', 'Kobold': 'Бог кобольдов: ', 'Lizardfolk': 'Божество людоящеров: ', 'Merfolk': 'Божество мерфолков: ', 'Mother-': 'Мать-', 'Northlander': 'Бог северян: ', 'Orc': 'Орочий ', 'Sahuagin': 'Бог сахуагинов: ', 'Triple': 'Триединая ', 'Troglodyte': 'Бог троглодитов: ', 'Wood elf': 'Бог лесных эльфов: ' };
  const prefix = prefixes[match[1].trim()];
  if (prefix === undefined) throw new Error(`Missing deity title prefix: ${match[1]}`);
  const gender = match[2].toLowerCase();
  const noun = gender === 'god' ? (neutralGod ? 'божество' : 'бог') : gender === 'goddess' ? 'богиня' : gender === 'deities' ? 'божества' : 'божество';
  const content = prefix.endsWith(': ') ? translateConcept(match[3]) : `${noun} ${translateConcept(match[3], true)}`;
  // Match adjective gender in the few prefixed feminine/neuter deity titles.
  const adaptedPrefix = noun === 'богиня' && prefix === 'Драконий ' ? 'Драконья ' : noun === 'божество' && prefix === 'Эльфийский ' ? 'Эльфийское ' : prefix;
  return `${adaptedPrefix}${content}`.replace(/^./, char => char.toLocaleUpperCase('ru'));
}

export function titlePortfolio(title: string): string {
  const match = title.match(/\b(?:god|goddess|deity|deities) of (.+)$/i);
  return match ? translateConcept(match[1]) : '';
}
