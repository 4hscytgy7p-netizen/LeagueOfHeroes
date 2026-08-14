export const CHARACTER_STORAGE_KEY = 'league-character-creator-clean-v1';

export const CREATOR_STEPS = [
  'identity', 'species', 'class', 'class-features', 'alignment',
  'background', 'origin-feats', 'skills', 'expertise', 'languages', 'tools',
  'equipment', 'abilities', 'spells', 'summary'
] as const;

export const ABILITY_KEYS = [
  'strength', 'dexterity', 'constitution',
  'intelligence', 'wisdom', 'charisma'
] as const;

export const POINT_BUY_COSTS: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9
};

export const DEFAULT_CHARACTER_STATE = {
  step: 0,
  name: '',
  profile: {
    age: '',
    eyes: '',
    skin: '',
    hair: '',
    appearance: '',
    allies: '',
    backstory: ''
  },
  species: null,
  speciesVariant: null,
  class: null,
  background: null,
  backgroundCharacteristics: {
    traits: ['', ''],
    ideal: [''],
    bond: [''],
    flaw: ['']
  },
  choices: {},
  customDeity: {
    name: '',
    title: '',
    alignment: '',
    domains: '',
    portfolio: '',
    pantheon: '',
    symbol: '',
    description: '',
    tenets: ''
  },
  customPatron: {
    name: '',
    title: '',
    type: '',
    alignment: '',
    realm: '',
    source: '',
    description: '',
    pactTerms: '',
    manifestation: '',
    goals: ''
  },
  spells: { cantrips: [], level1: [], sources: {} },
  equipment: {
    initializedFor: '',
    inventory: [],
    goldCopper: 0,
    classVariantIndex: 0,
    purchaseConfirmed: false,
    version: 7
  },
  abilities: Object.fromEntries(
    ABILITY_KEYS.map((key) => [key, { base: 8, bonus: 0 }])
  ),
  alignment: null,
  physique: {
    size: null,
    heightModifier: null,
    weightMultiplier: null,
    heightInches: null,
    weightPounds: null
  }
};
