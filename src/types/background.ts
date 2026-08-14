interface CharacteristicEntry {
  roll: number;
  trait?: string;
  ideal?: string;
  bond?: string;
  flaw?: string;
}

interface SpellTable {
  name: string;
  prerequisite?: string;
  description: string;
  spells: {
    level: string;
    spells: string[];
  }[];
  note?: string;
}

export interface Background {
  id: string;
  name: string;
  nameEn: string;
  sourceBook: string;
  lore: string;
  proficiencies: {
    abilityScores: {
      description: string;
    };
    feat: string;
    skills: {
      count: number;
      description: string;
    };
    tools: {
      description: string;
    };
    equipment: string;
  };
  spellTable?: SpellTable;
  variants?: {
    title: string;
    description?: string;
    table: {
      roll: number;
      result: string;
    }[];
  };
  characteristics: {
    personalityTraits: CharacteristicEntry[];
    ideals: CharacteristicEntry[];
    bonds: CharacteristicEntry[];
    flaws: CharacteristicEntry[];
  };
}
