import type { MaterialAnnotation } from '../types/material';
import { leagueRules, type LeagueRuleId } from './leagueRules.ts';

const restriction = (id: LeagueRuleId, note: string) => ({ href: leagueRules[id].href, type: 'restriction' as const, note });

// How to add annotations: docs/material-marking.md.
export const materialAnnotations: MaterialAnnotation[] = [
  ...['pistol', 'musket'].map(id => ({
    kind: 'item' as const, id,
    errata: [
      restriction('weapon-restrictions', 'Из огнестрела разрешены только Пистоль и Мушкет.'),
      restriction('starting-weapons', 'Нельзя брать как стартовое снаряжение.'),
    ],
  })),
  ...['backpack', 'waterskin', 'quiver', 'pouch', 'case-crossbow-bolt', 'case-map-or-scroll'].map(id => ({
    kind: 'item' as const, id,
    errata: [restriction('containers', 'Для быстрого доступа на персонаже действуют общие ограничения количества контейнеров и их содержимого.')],
  })),
  ...['bag-of-holding', 'quiver-of-ehlonna'].map(id => ({
    kind: 'magic-item' as const, id,
    errata: [restriction('containers', 'Для быстрого доступа на персонаже действуют общие ограничения количества контейнеров и их содержимого.')],
  })),
  // These seven species are explicitly listed in the existing oversized-weapon rule.
  // A link does not grant a missing trait or remove the rule's trait requirement.
  ...['bugbear', 'orc', 'firbolg', 'centaur', 'giff', 'goliath', 'loxodon'].map(id => ({
    kind: 'species' as const, id,
    errata: [restriction('oversized-weapons', 'Использование увеличенного оружия регулируется отдельным правилом Лиги; учитывайте условие об особенности телосложения.')],
  })),
  // Published examples named by the component rule; never infer every casting item's behavior.
  ...['weapon', 'armor', 'staff'].flatMap(family => ['cantrip', ...Array.from({ length: 8 }, (_, i) => `${i + 1}-level`)].map(level => ({
    kind: 'magic-item' as const, id: `enspelled-${family}-${level}`,
    errata: [restriction('consumable-components', 'Предмет не предоставляет расходуемый материальный компонент заклинания, если в описании не сказано иного.')],
  }))),
];
