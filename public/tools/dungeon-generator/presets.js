/* Add a theme here: the controls, generator, 3D view and exports share this catalog.
 * family: fantasy | modern | scifi; defaultLayout: mixed | rectangular | rounded.
 * base uses linear RGB for Three.js; floor/wall/background are sRGB for Canvas. */
'use strict';
globalThis.DungeonPresets = {
  crypt: { title: 'Мшистый склеп', family: 'fantasy', defaultLayout: 'mixed', base: [.31,.34,.32], floor: '#586257', wall: '#303b32', background: '#121714', accent: '#d9b478', lamp: 0xff8c3a, names: ['Забытые катакомбы', 'Пепельные своды', 'Безмолвное святилище'] },
  ember: { title: 'Огненная крепость', family: 'fantasy', defaultLayout: 'mixed', base: [.36,.25,.20], floor: '#725546', wall: '#49352c', background: '#201612', accent: '#edaa63', lamp: 0xff602f, names: ['Медные чертоги', 'Крепость углей', 'Пылающий лабиринт'] },
  glacial: { title: 'Ледяные залы', family: 'fantasy', defaultLayout: 'rounded', base: [.26,.34,.40], floor: '#566e82', wall: '#33495a', background: '#101b24', accent: '#92cbe5', lamp: 0x79bfff, names: ['Своды вечной зимы', 'Ледяное убежище', 'Застывшие чертоги'] },
  office: { title: 'Офисный комплекс', family: 'modern', defaultLayout: 'rectangular', base: [.46,.45,.40], floor: '#9a978a', wall: '#51565a', background: '#181d22', accent: '#74c9b6', lamp: 0xd8f3ff, names: ['Деловой центр «Контур»', 'Закрытый корпус', 'Архивный комплекс'] },
  bunker: { title: 'Военный бункер', family: 'modern', defaultLayout: 'rectangular', base: [.29,.33,.29], floor: '#657164', wall: '#39443c', background: '#151b17', accent: '#dfb261', lamp: 0xffc878, names: ['Бункер «Рубеж»', 'Подземный командный пункт', 'Объект «Гранит»'] },
  station: { title: 'Орбитальная станция', family: 'scifi', defaultLayout: 'rectangular', base: [.28,.36,.43], floor: '#607b8e', wall: '#263c4e', background: '#0d1824', accent: '#64dfeb', lamp: 0x66deff, names: ['Станция «Горизонт»', 'Орбитальный узел «Вектор»', 'Сектор «Аврора»'] },
  reactor: { title: 'Реакторный сектор', family: 'scifi', defaultLayout: 'rounded', base: [.28,.34,.32], floor: '#50746b', wall: '#283f3e', background: '#0b1c1a', accent: '#86f4b3', lamp: 0x77ffad, names: ['Реактор «Прометей»', 'Комплекс «Синтез»', 'Энергетический узел «Пульсар»'] },
};
globalThis.DungeonFamilies = { fantasy: 'Фэнтези', modern: 'Современность', scifi: 'Научная фантастика' };
globalThis.DungeonRoomLabels = {
  fantasy: { entrance: 'Вход', combat: 'Боевой зал', elite: 'Пост стражи', treasure: 'Сокровищница', shrine: 'Святилище', boss: 'Арена главного противника', secret: 'Тайник' },
  modern: { entrance: 'Вестибюль', combat: 'Рабочее помещение', elite: 'Пост охраны', treasure: 'Склад снабжения', shrine: 'Медпункт', boss: 'Командный центр', secret: 'Скрытый архив' },
  scifi: { entrance: 'Входной шлюз', combat: 'Жилой модуль', elite: 'Пост безопасности', treasure: 'Грузовой отсек', shrine: 'Медицинский модуль', boss: 'Центр управления', secret: 'Секретная лаборатория' },
};
