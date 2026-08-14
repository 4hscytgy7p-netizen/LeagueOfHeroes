export interface SpeciesVariant {
  id?: string;
  name: string;
  nameEn: string;
  sourceBook: string;
  abilities?: {
    title: string;
    description: string;
  }[];
  replacesAbilities?: string[];
  tableData?: {
    title: string;
    headers: string[];
    rows: string[][];
  };
  lore?: string;
  speed?: number | {
    walk?: number;
    swimming?: number;
    flying?: number;
  };
}

export interface Species {
  id: string;
  name: string;
  nameEn: string;
  sourceBook: string;
  lore: string;
  portrait: string;
  type: string;
  size: string;
  speed: number;
  abilities?: {
    title: string;
    description: string;
  }[];
  variants?: SpeciesVariant[];
  variantMode?: 'required' | 'optional';
  traits?: {
    abilities: string[];
  };
}
