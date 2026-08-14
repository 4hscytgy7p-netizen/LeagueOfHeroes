import { items } from '../../../data/items/index.ts';

const PACK_IDS = [
  'explorers-pack',
  'dungeoneers-pack',
  'burglars-pack',
  'entertainers-pack',
  'priests-pack',
  'scholars-pack',
  'diplomats-pack'
] as const;

const equipmentPackContents = Object.fromEntries(
  PACK_IDS.map((id) => {
    const pack = items.find((item) => item.id === id);
    if (!pack?.contents?.length) {
      throw new Error(`Для набора ${id} не указан состав в src/data/items/index.ts`);
    }
    return [pack.name.toLocaleLowerCase('ru'), pack.contents];
  })
);

// В некоторых классах набор путешественника назван сокращённо «набор исследователя».
equipmentPackContents['набор исследователя'] = equipmentPackContents['набор путешественника'];

export const EQUIPMENT_PACK_CONTENTS = equipmentPackContents;
