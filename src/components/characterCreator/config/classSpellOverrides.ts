// В данных заклинаний источники перечисляют официальные классы D&D, поэтому
// дополнительный Апотекарий подключает свой список отдельно. Здесь находятся
// стандартные заклинания SCGtD14, уже представленные в базе сайта. Авторские
// заклинания книги можно будет добавить в этот список после появления их
// полноценных карточек в src/data/spells.
export const CLASS_SPELL_NAME_OVERRIDES: Record<string, readonly string[]> = {
  apothecary: [
    'Acid Splash',
    'Chill Touch',
    'Guidance',
    'Light',
    'Mending',
    'Message',
    'Poison Spray',
    'Resistance',
    'Shocking Grasp',
    'Spare the Dying',
    'Thaumaturgy',
    'Alarm',
    'Comprehend Languages',
    'Create or Destroy Water',
    'Cure Wounds',
    'Detect Evil and Good',
    'Detect Magic',
    'Detect Poison and Disease',
    'False Life',
    'Feather Fall',
    'Tenser’s Floating Disk',
    'Fog Cloud',
    'Grease',
    'Healing Word',
    'Tasha’s Hideous Laughter',
    'Identify',
    'Illusory Script',
    'Jump',
    'Purify Food and Drink',
    'Sleep',
    'Unseen Servant'
  ]
};
