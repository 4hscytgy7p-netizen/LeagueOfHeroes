export interface ClassFeature {
  name: string;
  level: number;
  description: string;
  collapsible?: {
    title: string;
    description: string;
    tableData?: {
      headers: string[];
      rows: string[][];
    };
  }[];
}

export interface Subclass {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  features: ClassFeature[];
}

export interface ClassLevel {
  level: number;
  profBonus: string;
  features: string[];
  cantrips?: number;
  preparedSpells?: number;
  spellSlots?: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, number>>;
  [key: string]: unknown;
}

interface Equipment {
  choice: string;
  items: string[];
}

export interface Class {
  id: string;
  name: string;
  nameEn: string;
  sourceBook: string;
  portrait: string;
  description: string;
  primaryAbility: string;
  hitDice: number;
  subclasses: Subclass[];
  hitPoints: {
    level1: string;
    higherLevels: string;
  };
  proficiencies: {
    armor: string[];
    weapons: string[];
    savingThrows: string[];
    tools?: string[];
    skills: {
      count: number;
      list: string[];
    };
  };
  equipment: {
    default: Equipment[];
  };
  levels: ClassLevel[];
  features: ClassFeature[];
  multiclass?: {
    /** Список пунктов (bullets) описывающих особенности при мультиклассе в этот класс */
    bullets: string[];
  };
}
