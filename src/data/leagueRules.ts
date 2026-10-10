// Stable rule IDs and destinations, shared by annotations and legacy links.
export const leagueRules = {
  'weapon-restrictions': { title: 'Ограничения оружия', href: '/rules/equipment#weapon-restrictions' },
  'starting-weapons': { title: 'Оружие на старте', href: '/character-guide#starting-weapons' },
  'race-attributes': { title: 'Возраст, рост и вес видов', href: '/races#race-attributes' },
  containers: { title: 'Контейнеры на персонаже', href: '/rules/equipment#containers' },
  'oversized-weapons': { title: 'Увеличенное оружие', href: '/rules/equipment#oversized-weapons' },
  injuries: { title: 'Травмы', href: '/rules/injuries#injuries' },
  'consumable-components': { title: 'Расходуемые компоненты магических предметов', href: '/general-rules#consumable-components' },
} as const;
export type LeagueRuleId = keyof typeof leagueRules;
