export const defaultSizeData = {
  средний: {
      baseHeight: { футов: 4, дюймов: 8 },
      baseWeight: 110,
      heightRange: [1, 21],
      weightRange: [2, 8],
      heightDice: null,
      weightDice: null
  },
  маленький: {
      baseHeight: { футов: 2, дюймов: 11 },
      baseWeight: 35,
      heightRange: [1, 8],
      weightRange: [1, 1],
      heightDice: null,
      weightDice: null
  }
};

export const raceData = {
  aarakocra: {
    baseHeight: { футов: 4, дюймов: 6 },
    baseWeight: 60,
    heightRange: [1, 8],
    weightRange: [1, 6],
    size: 'средний'
  },
  aasimar: {
    sizeOptions: ['маленький', 'средний'],
    маленький: {
      baseHeight: { футов: 2, дюймов: 11 },
      baseWeight: 35,
      heightRange: [1, 8],
      weightRange: [1, 1],
      size: 'маленький',
      heightDice: null,
      weightDice: null
    },
    средний: {
      baseHeight: { футов: 4, дюймов: 8 },
      baseWeight: 110,
      heightRange: [1, 21],
      weightRange: [2, 8],
      size: 'средний',
      // Aasimar example: height modifier 2d10, weight multiplier 2d4
      heightDice: '2d10',
      weightDice: '2d4'
    }
  },
  autognome: {
    size: 'маленький',
    baseHeight: defaultSizeData.маленький.baseHeight,
    baseWeight: defaultSizeData.маленький.baseWeight,
    heightRange: defaultSizeData.маленький.heightRange,
    weightRange: defaultSizeData.маленький.weightRange
  },
  bugbear: {
    baseHeight: { футов: 6, дюймов: 0 },
    baseWeight: 200,
    heightRange: [1, 24],
    weightRange: [2, 13],
    size: 'средний'
  },
  centaur: {
    baseHeight: { футов: 6, дюймов: 0 },
    baseWeight: 600,
    heightRange: [1, 12],
    weightRange: [2, 24],
    size: 'средний'
  },
  changeling: {
    sizeOptions: ['маленький', 'средний'],
    маленький: {
      baseHeight: { футов: 2, дюймов: 11 },
      baseWeight: 35,
      heightRange: [1, 8],
      weightRange: [1, 1],
      size: 'маленький'
    },
    средний: {
      baseHeight: { футов: 5, дюймов: 1 },
      baseWeight: 115,
      heightRange: [1, 8],
      weightRange: [2, 8],
      size: 'средний'
    }
  },
  dhampir: {
    sizeOptions: ['маленький', 'средний'],
    средний: {
      baseHeight: defaultSizeData.средний.baseHeight,
      baseWeight: defaultSizeData.средний.baseWeight,
      heightRange: defaultSizeData.средний.heightRange,
      weightRange: defaultSizeData.средний.weightRange
    },
    маленький: {
      baseHeight: defaultSizeData.маленький.baseHeight,
      baseWeight: defaultSizeData.маленький.baseWeight,
      heightRange: defaultSizeData.маленький.heightRange,
      weightRange: defaultSizeData.маленький.weightRange
    }
  },
  dragonborn: {
    baseHeight: { футов: 5, дюймов: 6 },
    baseWeight: 175,
    heightRange: [1, 16],
    weightRange: [2, 13],
    size: 'средний'
  },
  dwarfDuergar: {
    // example of subrace referencing dwarf base (Duergar)
    baseHeight: { футов: 4, дюймов: 0 },
    baseWeight: 130,
    heightRange: [1, 9],
    weightRange: [2, 13],
    size: 'средний',
    baseRace: 'dwarf',
    subraceName: 'Duergar'
  },
  dwarf: {
    baseHeight: { футов: 4, дюймов: 0 },
    baseWeight: 130,
    heightRange: [1, 9],
    weightRange: [2, 13],
    size: 'средний'
  },
  eladrin: {
    baseHeight: { футов: 4, дюймов: 6 },
    baseWeight: 90,
    heightRange: [2, 24],
    weightRange: [1, 4],
    heightDice: '2d12',
    weightDice: '1d4',
    size: 'средний'
  },
  // PHB 2014, Random Height and Weight: high elf.
  // Used as the base entry for the 2024 elf; individual lineages can still
  // choose any value within the sliders instead of rolling.
  elf: {
    baseHeight: { футов: 4, дюймов: 6 },
    baseWeight: 90,
    heightRange: [2, 20],
    weightRange: [1, 4],
    heightDice: '2d10',
    weightDice: '1d4',
    size: 'средний'
  },
  elfDrow: {
    baseHeight: { футов: 4, дюймов: 5 },
    baseWeight: 75,
    heightRange: [2, 12],
    weightRange: [1, 6],
    heightDice: '2d6',
    weightDice: '1d6',
    size: 'средний'
  },
  elfSea: {
    baseHeight: { футов: 4, дюймов: 6 },
    baseWeight: 90,
    heightRange: [2, 16],
    weightRange: [1, 4],
    heightDice: '2d8',
    weightDice: '1d4',
    size: 'средний'
  },
  elfShadarKai: {
    baseHeight: { футов: 4, дюймов: 8 },
    baseWeight: 90,
    heightRange: [2, 16],
    weightRange: [1, 4],
    heightDice: '2d8',
    weightDice: '1d4',
    size: 'средний'
  },
  elfWood: {
    baseHeight: { футов: 4, дюймов: 6 },
    baseWeight: 100,
    heightRange: [2, 20],
    weightRange: [1, 4],
    heightDice: '2d10',
    weightDice: '1d4',
    size: 'средний'
  },
  fairy: {
    size: 'маленький',
    baseHeight: defaultSizeData.маленький.baseHeight,
    baseWeight: defaultSizeData.маленький.baseWeight,
    heightRange: defaultSizeData.маленький.heightRange,
    weightRange: defaultSizeData.маленький.weightRange
  },
  firbolg: {
    baseHeight: { футов: 6, дюймов: 2 },
    baseWeight: 175,
    heightRange: [1, 24],
    weightRange: [2, 13],
    size: 'средний'
  },
  genasi: {
    sizeOptions: ['маленький', 'средний'],
    маленький: {
      baseHeight: { футов: 2, дюймов: 11 },
      baseWeight: 35,
      heightRange: [1, 8],
      weightRange: [1, 1],
      size: 'маленький'
    },
    средний: {
      baseHeight: { футов: 4, дюймов: 8 },
      baseWeight: 110,
      heightRange: [1, 21],
      weightRange: [2, 8],
      size: 'средний'
    }
  },
  giff: {
    baseHeight: { футов: 6, дюймов: 4 },
    baseWeight: 180,
    heightRange: [1, 24],
    weightRange: [2, 16],
    size: 'средний'
  },
  githGithyanki: {
    baseHeight: { футов: 5, дюймов: 0 },
    baseWeight: 100,
    heightRange: [2, 24],
    weightRange: [2, 8],
    heightDice: '2d12',
    weightDice: '2d4',
    size: 'средний',
    baseRace: 'gith',
    subraceName: 'Githyanki'
  },
  githGithzerai: {
    baseHeight: { футов: 4, дюймов: 11 },
    baseWeight: 90,
    heightRange: [2, 24],
    weightRange: [1, 4],
    heightDice: '2d12',
    weightDice: '1d4',
    size: 'средний',
    baseRace: 'gith',
    subraceName: 'Githzerai'
  },
  // Wizards of the Coast UA: Eladrin and Gith. The base entry follows
  // githzerai, the first required variant in the character creator.
  gith: {
    baseHeight: { футов: 4, дюймов: 11 },
    baseWeight: 90,
    heightRange: [2, 24],
    weightRange: [1, 4],
    heightDice: '2d12',
    weightDice: '1d4',
    size: 'средний'
  },
  gnome: {
    baseHeight: { футов: 2, дюймов: 11 },
    baseWeight: 35,
    heightRange: [1, 9],
    weightRange: [1, 1],
    size: 'маленький'
  },
  goblin: {
    baseHeight: { футов: 3, дюймов: 5 },
    baseWeight: 35,
    heightRange: [1, 9],
    weightRange: [1, 1],
    size: 'маленький'
  },
  goliath: {
    baseHeight: { футов: 6, дюймов: 2 },
    baseWeight: 200,
    heightRange: [1, 22],
    weightRange: [2, 13],
    size: 'средний'
  },
  grung: {
    baseHeight: { футов: 2, дюймов: 2 },
    baseWeight: 25,
    heightRange: [1, 16],
    weightRange: [1, 1],
    size: 'маленький'
  },
  hadozee: {
    sizeOptions: ['маленький', 'средний'],
    маленький: {
      baseHeight: { футов: 2, дюймов: 11 },
      baseWeight: 35,
      heightRange: [1, 8],
      weightRange: [1, 1],
      size: 'маленький'
    },
    средний: {
      baseHeight: { футов: 4, дюймов: 8 },
      baseWeight: 110,
      heightRange: [1, 21],
      weightRange: [2, 8],
      size: 'средний'
    }
  },
  halfElf: {
    baseHeight: { футов: 4, дюймов: 9 },
    baseWeight: 110,
    heightRange: [1, 16],
    weightRange: [2, 8],
    size: 'средний'
  },
  halfling: {
    baseHeight: { футов: 2, дюймов: 7 },
    baseWeight: 35,
    heightRange: [1, 9],
    weightRange: [1, 1],
    size: 'маленький'
  },
  halfOrc: {
    baseHeight: { футов: 4, дюймов: 10 },
    baseWeight: 140,
    heightRange: [1, 21],
    weightRange: [2, 13],
    size: 'средний'
  },
  harengon: {
    sizeOptions: ['маленький', 'средний'],
    маленький: {
      baseHeight: { футов: 2, дюймов: 11 },
      baseWeight: 35,
      heightRange: [1, 8],
      weightRange: [1, 1],
      size: 'маленький'
    },
    средний: {
      baseHeight: { футов: 4, дюймов: 8 },
      baseWeight: 110,
      heightRange: [1, 21],
      weightRange: [2, 8],
      size: 'средний'
    }
  },
  hobgoblin: {
    baseHeight: { футов: 4, дюймов: 8 },
    baseWeight: 110,
    heightRange: [1, 21],
    weightRange: [2, 8],
    size: 'средний'
  },
  human: {
    sizeOptions: ['маленький', 'средний'],
    средний: {
      baseHeight: { футов: 4, дюймов: -1 },
      baseWeight: 110,
      heightRange: [1, 37],
      weightRange: [2, 8],
      size: 'средний'
    },
    маленький: {
      baseHeight: { футов: 2, дюймов: 5 },
      baseWeight: 35,
      heightRange: [1, 18],
      weightRange: [1, 4],
      size: 'маленький'
    }
  },
  kalashtar: {
    baseHeight: { футов: 5, дюймов: 4 },
    baseWeight: 110,
    heightRange: [1, 13],
    weightRange: [1, 6],
    size: 'средний'
  },
  kender: {
    size: 'маленький',
    baseHeight: defaultSizeData.маленький.baseHeight,
    baseWeight: defaultSizeData.маленький.baseWeight,
    heightRange: defaultSizeData.маленький.heightRange,
    weightRange: defaultSizeData.маленький.weightRange
  },
  kenku: {
    sizeOptions: ['маленький', 'средний'],
    маленький: {
      baseHeight: { футов: 2, дюймов: 11 },
      baseWeight: 35,
      heightRange: [1, 8],
      weightRange: [1, 1],
      size: 'маленький'
    },
    средний: {
      baseHeight: { футов: 4, дюймов: 4 },
      baseWeight: 50,
      heightRange: [1, 16],
      weightRange: [1, 6],
      size: 'средний'
    }
  },
  kobold: {
    baseHeight: { футов: 2, дюймов: 1 },
    baseWeight: 25,
    heightRange: [1, 9],
    weightRange: [1, 1],
    size: 'маленький'
  },
  leonin: {
    baseHeight: { футов: 5, дюймов: 6 },
    baseWeight: 180,
    heightRange: [1, 21],
    weightRange: [2, 13],
    size: 'средний'
  },
  lizardfolk: {
    baseHeight: { футов: 4, дюймов: 9 },
    baseWeight: 120,
    heightRange: [1, 21],
    weightRange: [2, 13],
    size: 'средний'
  },
  locathah: {
    baseHeight: { футов: 5, дюймов: 1 },
    baseWeight: 115,
    heightRange: [1, 9],
    weightRange: [2, 8],
    size: 'средний'
  },
  loxodon: {
    baseHeight: { футов: 6, дюймов: 7 },
    baseWeight: 295,
    heightRange: [1, 21],
    weightRange: [2, 8],
    size: 'средний'
  },
  minotaur: {
    baseHeight: { футов: 5, дюймов: 4 },
    baseWeight: 175,
    heightRange: [1, 16],
    weightRange: [2, 13],
    size: 'средний'
  },
  orc: {
    baseHeight: { футов: 5, дюймов: 4 },
    baseWeight: 175,
    heightRange: [1, 16],
    weightRange: [2, 13],
    size: 'средний'
  },
  owlin: {
    sizeOptions: ['маленький', 'средний'],
    маленький: {
      baseHeight: { футов: 2, дюймов: 11 },
      baseWeight: 35,
      heightRange: [1, 8],
      weightRange: [1, 1],
      size: 'маленький'
    },
    средний: {
      baseHeight: { футов: 4, дюймов: 8 },
      baseWeight: 110,
      heightRange: [1, 21],
      weightRange: [2, 8],
      size: 'средний'
    }
  },
  plasmoid: {
    sizeOptions: ['маленький', 'средний'],
    маленький: {
      baseHeight: { футов: 2, дюймов: 11 },
      baseWeight: 35,
      heightRange: [1, 8],
      weightRange: [1, 1],
      size: 'маленький'
    },
    средний: {
      baseHeight: { футов: 4, дюймов: 8 },
      baseWeight: 110,
      heightRange: [1, 21],
      weightRange: [2, 8],
      size: 'средний'
    }
  },
  satyr: {
    baseHeight: { футов: 4, дюймов: 8 },
    baseWeight: 100,
    heightRange: [1, 16],
    weightRange: [2, 8],
    size: 'средний'
  },
  shifter: {
    sizeOptions: ['маленький', 'средний'],
    маленький: {
      baseHeight: { футов: 2, дюймов: 5 },
      baseWeight: 35,
      heightRange: [1, 19],
      weightRange: [1, 2],
      size: 'маленький'
    },
    средний: {
      baseHeight: { футов: 4, дюймов: 5 },
      baseWeight: 90,
      heightRange: [2, 28],
      weightRange: [2, 8],
      size: 'средний'
    }
  },
  simichybrid: {
    size: 'средний',
    baseHeight: defaultSizeData.средний.baseHeight,
    baseWeight: defaultSizeData.средний.baseWeight,
    heightRange: defaultSizeData.средний.heightRange,
    weightRange: defaultSizeData.средний.weightRange
  },
  tabaxi: {
    sizeOptions: ['маленький', 'средний'],
    маленький: {
      baseHeight: { футов: 2, дюймов: 11 },
      baseWeight: 35,
      heightRange: [1, 8],
      weightRange: [1, 1],
      size: 'маленький'
    },
    средний: {
      baseHeight: { футов: 4, дюймов: 10 },
      baseWeight: 90,
      heightRange: [1, 11],
      weightRange: [2, 8],
      size: 'средний'
    }
  },
  thrikreen: {
    sizeOptions: ['средний', 'маленький'],
    маленький: {
      size: 'маленький',
      baseHeight: { футов: 2, дюймов: 11 },
      baseWeight: 35,
      heightRange: [1, 8],
      weightRange: [1, 1],
    },
    средний: {
      size: 'средний',
      baseHeight: { футов: 4, дюймов: 8 },
      baseWeight: 110,
      heightRange: [1, 21],
      weightRange: [2, 8],
    }
  },
  tiefling: {
    sizeOptions: ['маленький', 'средний'],
    маленький: {
      baseHeight: { футов: 2, дюймов: 11 },
      baseWeight: 35,
      heightRange: [1, 8],
      weightRange: [1, 1],
      size: 'маленький'
    },
    средний: {
      baseHeight: { футов: 4, дюймов: 9 },
      baseWeight: 110,
      heightRange: [1, 16],
      weightRange: [2, 8],
      size: 'средний'
    }
  },
  tortle: {
    sizeOptions: ['маленький', 'средний'],
    маленький: {
      baseHeight: { футов: 2, дюймов: 11 },
      baseWeight: 35,
      heightRange: [1, 8],
      weightRange: [1, 1],
      size: 'маленький'
    },
    средний: {
      baseHeight: { футов: 4, дюймов: 8 },
      baseWeight: 110,
      heightRange: [1, 21],
      weightRange: [2, 8],
      size: 'средний'
    }
  },
  triton: {
    baseHeight: { футов: 4, дюймов: 6 },
    baseWeight: 90,
    heightRange: [1, 21],
    weightRange: [2, 8],
    size: 'средний'
  },
  vedalken: {
    baseHeight: { футов: 5, дюймов: 4 },
    baseWeight: 110,
    heightRange: [1, 21],
    weightRange: [2, 8],
    size: 'средний'
  },
  verdan: {
    baseHeight: { футов: 2, дюймов: 9 },
    baseWeight: 35,
    heightRange: [1, 16],
    weightRange: [1, 1],
    size: 'маленький'
  },
  warforged: {
    sizeOptions: ['маленький', 'средний'],
      средний: {
      baseHeight: { футов: 5, дюймов: 10 },
      baseWeight: 270,
      heightRange: [1, 26],
      weightRange: [4, 4],
      size: 'средний'
      },
      маленький: {
        baseHeight: { футов: 2, дюймов: 11 },
        baseWeight: 35,
        heightRange: [1, 13],
        weightRange: [2, 3],
        size: 'маленький'
      },
  },
  yuanti: {
    baseHeight: { футов: 4, дюймов: 8 },
    baseWeight: 110,
    heightRange: [1, 21],
    weightRange: [2, 8],
    size: 'средний'
  },
  hexblood: {
    sizeOptions: ['маленький', 'средний'],
    средний: {
      baseHeight: defaultSizeData.средний.baseHeight,
      baseWeight: defaultSizeData.средний.baseWeight,
      heightRange: defaultSizeData.средний.heightRange,
      weightRange: defaultSizeData.средний.weightRange
    },
    маленький: {
      baseHeight: defaultSizeData.маленький.baseHeight,
      baseWeight: defaultSizeData.маленький.baseWeight,
      heightRange: defaultSizeData.маленький.heightRange,
      weightRange: defaultSizeData.маленький.weightRange
    }
  },
  lupin: {
    sizeOptions: ['маленький', 'средний'],
    средний: {
      baseHeight: defaultSizeData.средний.baseHeight,
      baseWeight: defaultSizeData.средний.baseWeight,
      heightRange: defaultSizeData.средний.heightRange,
      weightRange: defaultSizeData.средний.weightRange
    },
    маленький: {
      baseHeight: defaultSizeData.маленький.baseHeight,
      baseWeight: defaultSizeData.маленький.baseWeight,
      heightRange: defaultSizeData.маленький.heightRange,
      weightRange: defaultSizeData.маленький.weightRange
    }
  },
  reborn: {
    sizeOptions: ['маленький', 'средний'],
    средний: {
      baseHeight: defaultSizeData.средний.baseHeight,
      baseWeight: defaultSizeData.средний.baseWeight,
      heightRange: defaultSizeData.средний.heightRange,
      weightRange: defaultSizeData.средний.weightRange
    },
    маленький: {
      baseHeight: defaultSizeData.маленький.baseHeight,
      baseWeight: defaultSizeData.маленький.baseWeight,
      heightRange: defaultSizeData.маленький.heightRange,
      weightRange: defaultSizeData.маленький.weightRange
    }
  },
  // Tasha's Cauldron of Everything defines the size as the player's choice:
  // Small or Medium. It gives no fixed anatomy, so use the shared ranges for
  // those two sizes that the rest of this calculator uses.
  'custom lineage': {
    sizeOptions: ['маленький', 'средний'],
    средний: {
      baseHeight: { футов: 4, дюймов: -1 },
      baseWeight: 110,
      heightRange: [1, 37],
      weightRange: [2, 8],
      size: 'средний'
    },
    маленький: {
      baseHeight: { футов: 2, дюймов: 5 },
      baseWeight: 35,
      heightRange: [1, 18],
      weightRange: [1, 4],
      size: 'маленький'
    }
  }
};

export function getRaceData(race, selectedSize = null) {
  if (!race) return null;
  // direct lookup
  let data = raceData[race];
  // try normalized lookup (case-insensitive, strip -/_)
  if (!data) {
    const norm = String(race).toLowerCase().replace(/[-_]/g, '');
    const foundKey = Object.keys(raceData).find(k => k.toLowerCase() === norm || k.toLowerCase().replace(/[-_]/g, '') === norm);
    if (foundKey) data = raceData[foundKey];
  }
  if (!data) return null;

  if (data.sizeOptions) {
    const size = selectedSize || data.sizeOptions[0];
    const res = data[size] || null;
    if (!res) return null;
    const merged = { ...defaultSizeData[size], ...res };
    merged.size = merged.size || size;
    merged.heightDice = merged.heightDice ?? null;
    merged.weightDice = merged.weightDice ?? null;
    return merged;
  }

  // ensure we always return a merged object with defaults filled
  const sizeKey = data.size || 'средний';
  const merged = { ...defaultSizeData[sizeKey], ...data };
  merged.size = merged.size || sizeKey;
  merged.heightDice = merged.heightDice ?? null;
  merged.weightDice = merged.weightDice ?? null;
  return merged;
}
