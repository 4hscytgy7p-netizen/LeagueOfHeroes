function dictionary(text: string): Record<string, string> {
  return Object.fromEntries(text.trim().split('\n').map(line => line.split('|')));
}

// Established Russian forms where available; transliterations retain the English search name.
export const deityNames = dictionary(`
Abbathor|Аббатор
Aegir|Эгир
Aerdrie Faenya|Аэрдри Фэния
Akadi|Акади
Alathrien Druanna|Алатриэн Друанна
Alobal Lorfiril|Алобал Лорфирил
Amaunator|Амаунатор
Angharradh|Ангаррад
Anubis|Анубис
Apep|Апоп
Aphrodite|Афродита
Apollo|Аполлон
Araleth Letheranil|Аралет Летеранил
Arawai|Аравай
Arawn|Араун
Ares|Арес
Artemis|Артемида
Arvoreen|Арворин
Asmodeus|Асмодей
Athena|Афина
Athreos|Атреос
Aureon|Ауреон
Auril|Ауриль
Avandra|Авандра
Azuth|Азут
Baervan Wildwanderer|Баэрван Дикий Странник
Bahamut|Бахамут
Bahgtru|Багтру
Balder|Бальдр
Balinor|Балинор
Bane|Бэйн
Baravar Cloakshadow|Баравар Плащ Теней
Bast|Баст
Belenus|Беленус
Beory|Беори
Berei|Берей
Berronar Truesilver|Берронар Истинное Серебро
Bes|Бес
Beshaba|Бешаба
Bhaal|Баал
Bleredd|Блередд
Blibdoolpoolp|Блибдулпулп
Boccob|Боккоб
Boldrei|Болдри
Branchala|Бранчала
Brandobaris|Брандобарис
Brigantia|Бригантия
Callarduran Smoothhands|Каллардюран Гладкие Руки
Celestian|Селестиан
Charmalaine|Шармалайн
Chauntea|Чонтиа
Chemosh|Чемош
Chislev|Числев
Clangeddin Silverbeard|Клангеддин Серебряная Борода
Corellon|Кореллон
Corellon Larethian|Кореллон Ларетиан
Cults of the Dragon Below|Культы Дракона Внизу
Cuthbert|Святой Кутберт
Cyric|Сирик
Cyrrollalee|Цирроллали
Darahl Tilvenar|Дарал Тилвенар
Deep Duerra|Глубинная Дуэрра
Deep Sashelas|Глубинный Сашелас
Demeter|Деметра
Dendar|Дендар
Deneir|Денеир
Diancecht|Диан Кехт
Dionysus|Дионис
Dol Arrah|Дол Арра
Dol Dorn|Дол Дорн
Dugmaren Brightmantle|Дугмарен Светлая Мантия
Dumathoin|Думатойн
Dunatis|Дунатис
Eadro|Эадро
Ehlonna|Элонна
Eilistraee|Эйлистри
Eldath|Эльдат
Elebrin Liothiel|Элебрин Лиотиэль
Ephara|Эфара
Erathis|Эратис
Erebos|Эребос
Erevan Ilesere|Эреван Илисер
Erythnul|Эритнул
Ezra|Эзра
Fenmarel Mestarine|Фенмарел Местарин
Fharlanghn|Фарланг
Flandal Steelskin|Фландал Стальная Кожа
Forseti|Форсети
Frey|Фрейр
Freya|Фрейя
Frigga|Фригг
Gadhelyn|Гаделин
Gaerdal Ironhand|Гаэрдал Железная Рука
Garl Glittergold|Гарл Златоблеск
Gelf Darkhearth|Гельф Тёмный Очаг
Ghaunadaur|Гонадор
Gilean|Гилеан
Goibhniu|Гоибниу
Gond|Гонд
Gorm Gulthyn|Горм Гултин
Grolantor|Гролантор
Grumbar|Грумбар
Gruumsh|Груумш
Gwaeron Windstrom|Гваэрон Буреветер
Habbakuk|Хаббакук
Hades|Аид
Haela Brightaxe|Хаэла Сияющий Топор
Hanali Celanil|Ханали Селанил
Hanseath|Хансит
Hathor|Хатхор
Hecate|Геката
Heimdall|Хеймдалль
Heironeous|Хейронеус
Hel|Хель
Heliod|Гелиод
Helm|Хельм
Hephaestus|Гефест
Hera|Гера
Hercules|Геракл
Hermes|Гермес
Hermod|Хермод
Hestia|Гестия
Hextor|Гекстор
Hiddukel|Хиддукель
Hoar|Хоар
Hruggek|Хруггек
Ilmater|Ильматер
Ilneval|Ильневал
Imhotep|Имхотеп
Incabulos|Инкабулос
Ioun|Йоун
Iroas|Ироас
Isis|Исида
Istishia|Истишия
Istus|Истус
Iuz|Иуз
Jergal|Джергал
Karametra|Караметра
Kelemvor|Келемвор
Keptolo|Кептоло
Keranos|Керанос
Kiaransalee|Киарансали
Kiri-Jolith|Кири-Джолит
Kirith Sotheril|Кирит Сотерил
Klothys|Клотис
Kol Korran|Кол Корран
Kord|Корд
Kossuth|Коссут
Kruphix|Круфикс
Kurtulmak|Куртулмак
Labelas Enoreth|Лабелас Энорет
Laduguer|Ладугуэр
Laogzed|Лаогзед
Lathander|Латандер
Leira|Лейра
Lliira|Ллиира
Loki|Локи
Lolth|Ллос
Loviatar|Ловиатар
Lugh|Луг
Lunitari|Лунитари
Luthic|Лутик
Maglubiyet|Маглубиет
Majere|Маджере
Malar|Малар
Malyk|Малик
Manannan mac Lir|Мананнан мак Лир
Marthammor Duin|Мартаммор Дуин
Mask|Маска
Math Mathonwy|Мат Матонви
Melira Taralen|Мелира Тарален
Melora|Мелора
Merrshaulk|Мершолк
Mielikki|Майликки
Milil|Милил
Mishakal|Мишакаль
Mogis|Могис
Moradin|Морадин
Morgion|Моргион
Morrigan|Морриган
Muamman Duathal|Муамман Дуатал
Mya|Мия
Myrkul|Миркул
Mystra|Мистра
Mythrien Sarath|Митриэн Сарат
Naralis Analor|Наралис Аналор
Nebelun|Небелун
Nephthys|Нефтида
Nerull|Нерулл
Nike|Ника
Njord|Ньёрд
Nuada|Нуада
Nuitari|Нуитари
Nylea|Нилея
Obad-Hai|Обад-Хай
Odin|Один
Odur|Од
Oghma|Огма
Olidammara|Олидаммара
Olladra|Олладра
Onatar|Онатар
Osiris|Осирис
Paladine|Паладайн
Pan|Пан
Pelor|Пелор
Pharika|Фарика
Phenax|Фенакс
Pholtus|Фолтус
Poseidon|Посейдон
Procan|Прокан
Ptah|Птах
Purphoros|Пирфор
Ralishaz|Ралишаз
Rao|Рао
Raven Queen|Королева Воронов
Re-Horakhty|Ра-Хорахти
Rellavar Danuvien|Реллавар Данувиэн
Reorx|Реоркс
Rill Cleverthrush|Рилл Мудрый Дрозд
Rillifane Rallathil|Риллифэйн Раллатил
Roknar|Рокнар
Sargonnas|Саргоннас
Sarula Iliene|Сарула Илиэн
Savras|Саврас
Segojan Earthcaller|Сегожан Зовущий Землю
Sehanine|Сеханин
Sehanine Moonbow|Сеханин Лунный Лук
Sekolah|Секола
Selvetarm|Сельветарм
Selûne|Селунэ
Semuanya|Семуанья
Set|Сет
Shar|Шар
Shargaas|Шаргаас
Sharindlar|Шариндлар
Shaundakul|Шаундакул
Sheela Peryroyl|Шила Периройл
Shevarash|Шевараш
Sheyanna Flaxenstrand|Шейянна Льняная Прядь
Shinare|Шинаре
Sif|Сиф
Silvanus|Сильванус
Sirrion|Сиррион
Skadi|Скади
Skerrit|Скеррит
Skoraeus Stonebones|Скореус Каменные Кости
Sobek|Себек
Solinari|Солинари
Solonor Thelandira|Солонор Теландира
Sseth|Ссет
St. Cuthbert|Святой Кутберт
Sune|Сьюн
Surtur|Сурт
Syrul|Сирул
Takhisis|Такхизис
Talona|Талона
Talos|Талос
Tarsellis Meunniduin|Тарселлис Меуннидуин
Tempus|Темпус
Tethrin Veraldé|Тетрин Веральдэ
Thard Harr|Тард Харр
Tharizdun|Тариздун
Tharmekhûl|Тармекул
Thassa|Тасса
Thautam|Таутам
The Blood of Vol|Кровь Вол
The Daghdha|Дагда
The Devourer|Пожиратель
The Fury|Ярость
The Keeper|Хранитель
The Mockery|Насмешник
The Path of Light|Путь Света
The Red Knight|Красный Рыцарь
The Shadow|Тень
The Silver Flame|Серебряное Пламя
The Spirits of the Past|Духи Прошлого
The Traveler|Странник
The Undying Court|Бессмертный Двор
Thor|Тор
Thoth|Тот
Thrym|Трюм
Tiamat|Тиамат
Torm|Торм
Torog|Торог
Trithereon|Тритереон
Tyche|Тихе
Tymora|Тимора
Tyr|Тир
Ulaa|Улаа
Uller|Улль
Umberlee|Амберли
Urdlen|Урдлен
Urogalan|Урогалан
Valkauna|Валкауна
Valkur|Валкур
Vandria Gilmadrith|Вандрия Гилмадрит
Vecna|Векна
Vergadain|Вергадейн
Vhaeraun|Ваэрон
Waukeen|Воки
Wee Jas|Ви Джас
Ye'Cind|Йе’Синд
Yondalla|Йондалла
Yurtrus|Юртрус
Zandilar|Зандилар
Zeboim|Зебоим
Zehir|Зехир
Zeus|Зевс
Zinzerena|Зинзерена
Zivilyn|Зивилин
`);
