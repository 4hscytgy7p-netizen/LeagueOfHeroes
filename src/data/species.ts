interface Species {
  id: string;
  name: string;
  nameEn: string;
  sourceBook: string;
  lore: string;
  portrait: string;
  type: string;
  size: string;
  speed: number;
  abilities: {
    title: string;
    description: string;
  }[];
}

export const speciesData: Species[] = [];