export interface CreatureEntry {
  name: string;
  paragraphs: string[];
}

export interface CreatureImage {
  url: string;
  alt: string;
  sourceHref: string;
  caption: string;
}

export interface Creature {
  kind?: 'creature' | 'object';
  id: string;
  name: string;
  nameEn: string;
  contextLabel?: string;
  calculationNote?: string;
  source: { code: string; name: string; page?: number; edition: '2014' | '2024'; href: string };
  size: string;
  type: string;
  alignment?: string;
  armorClass: string;
  hitPoints: string;
  hitDice?: string;
  speed?: string;
  abilities?: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  savingThrowBonus?: string;
  savingThrows?: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', string>>;
  damageImmunities: string[];
  damageResistances?: string[];
  damageVulnerabilities?: string[];
  skills?: string;
  conditionImmunities: { name: string; glossaryId: string }[];
  senses?: string;
  languages?: string;
  proficiencyBonus?: string;
  challenge?: string;
  traits: CreatureEntry[];
  actions: CreatureEntry[];
  bonusActions?: CreatureEntry[];
  reactions: CreatureEntry[];
  legendaryActions?: CreatureEntry[];
  legendaryNote?: string;
  information: string[];
  token?: CreatureImage;
  image?: CreatureImage;
}
