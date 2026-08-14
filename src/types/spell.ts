export type SpellLevel = 'cantrip' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type SpellSchool = 'ограждение' | 'вызов' | 'прорицание' | 'очарование' | 'воплощение' | 'иллюзия' | 'некромантия' | 'преобразование';

export interface SpellSource {
  type: 'class' | 'subclass' | 'species' | 'background' | 'feat' | 'other';
  name: string;
}

export interface Spell {
  id: string;
  name: string;
  nameEn: string;
  level: SpellLevel;
  school: SpellSchool;
  castingTime: string;
  range: string;
  components: {
    verbal?: boolean;
    somatic?: boolean;
    material?: string;
  };
  duration: string;
  description: string;
  source: {
    book: string;
    page: number;
  };
  sources: SpellSource[];
}