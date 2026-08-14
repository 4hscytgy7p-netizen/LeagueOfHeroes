import { items } from '../data/items';
import {
  getEquipmentCategoryGroup,
  parseMoneyToCopper,
  parseWeight
} from '../components/characterCreator/utils/dataPreparation';

export interface CharacterShopItem {
  id: string;
  name: string;
  nameEn: string;
  category: string;
  categoryGroup: string;
  cost: string;
  costCopper: number;
  weight: number;
  href: string;
}

export interface CharacterInventoryEntry {
  id: string;
  name: string;
  quantity: number;
  source: 'starting' | 'purchased' | 'imported' | 'custom';
  weight?: number;
}

export interface CharacterMarketState {
  inventory: CharacterInventoryEntry[];
  currencyCopper: number;
}

export const characterShopItems: CharacterShopItem[] = items.map((item) => ({
  id: item.id,
  name: item.name,
  nameEn: item.nameEn,
  category: item.type || 'Прочее',
  categoryGroup: getEquipmentCategoryGroup(item.type),
  cost: item.cost || '—',
  costCopper: parseMoneyToCopper(item.cost),
  weight: parseWeight(item.weight),
  href: `/items/${item.id}`
}));

const shopById = new Map(characterShopItems.map((item) => [item.id, item]));

function plainText(value: unknown) {
  if (typeof document === 'undefined') {
    return String(value ?? '').replace(/<[^>]*>/g, ' ');
  }
  const element = document.createElement('div');
  element.innerHTML = String(value ?? '');
  return element.textContent || '';
}

export function normalizeItemName(value: unknown) {
  return plainText(value)
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[()«»"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchShopItem(name: unknown) {
  const normalized = normalizeItemName(name);
  if (!normalized) return null;
  return characterShopItems.find((item) => {
    const russian = normalizeItemName(item.name);
    const english = normalizeItemName(item.nameEn);
    return normalized === russian || normalized === english;
  }) || null;
}

function safePortrait(value: unknown) {
  const url = String(value ?? '').trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(url) && url.length <= 2_000_000) return url;
  return '';
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function positiveQuantity(value: unknown) {
  return Math.max(1, Math.min(9999, Number.parseInt(String(value ?? 1), 10) || 1));
}

function draftMarket(state: Record<string, any>): CharacterMarketState {
  const equipment = asObject(state.equipment);
  const inventory = Array.isArray(equipment.inventory)
    ? equipment.inventory.map((entry: any) => {
        const source = asObject(entry);
        const item = shopById.get(String(source.id || '')) || matchShopItem(source.name);
        return {
          id: item?.id || String(source.id || `custom:${crypto.randomUUID()}`),
          name: item?.name || String(source.name || 'Неизвестный предмет'),
          quantity: positiveQuantity(source.quantity),
          source: source.source === 'starting' ? 'starting' : 'imported',
          weight: item?.weight || Number(source.weight || 0)
        } as CharacterInventoryEntry;
      })
    : [];
  return {
    inventory,
    currencyCopper: Math.max(0, Math.round(Number(equipment.goldCopper || 0)))
  };
}

function roll20Attributes(payload: Record<string, any>) {
  return Array.isArray(payload.character?.attribs) ? payload.character.attribs : [];
}

function roll20Attribute(payload: Record<string, any>, name: string) {
  return roll20Attributes(payload).find((attribute: any) => String(attribute?.name || '') === name)?.current ?? '';
}

function roll20Market(payload: Record<string, any>): CharacterMarketState {
  const rows = new Map<string, Record<string, any>>();
  for (const attribute of roll20Attributes(payload)) {
    const match = String(attribute?.name || '').match(/^repeating_inventory_([^_]+)_(.+)$/i);
    if (!match) continue;
    const row = rows.get(match[1]) || {};
    row[match[2]] = attribute.current;
    rows.set(match[1], row);
  }
  const inventory = [...rows.entries()].flatMap(([rowId, row]) => {
    const name = String(row.itemname || '').trim();
    if (!name) return [];
    const item = matchShopItem(name);
    return [{
      id: item?.id || `roll20:${rowId}`,
      name: item?.name || name,
      quantity: positiveQuantity(row.itemcount),
      source: item ? 'imported' : 'custom',
      weight: item?.weight || Number(String(row.itemweight || '0').replace(',', '.')) || 0
    } as CharacterInventoryEntry];
  });
  const currencyCopper =
    Math.max(0, Number(roll20Attribute(payload, 'cp')) || 0) +
    Math.max(0, Number(roll20Attribute(payload, 'sp')) || 0) * 10 +
    Math.max(0, Number(roll20Attribute(payload, 'ep')) || 0) * 50 +
    Math.max(0, Number(roll20Attribute(payload, 'gp')) || 0) * 100 +
    Math.max(0, Number(roll20Attribute(payload, 'pp')) || 0) * 1000;
  return { inventory, currencyCopper: Math.round(currencyCopper) };
}

export function parseCharacterJson(raw: unknown) {
  const payload = asObject(raw);
  const wrappedDraft = asObject(payload.state);
  const isDraft = String(payload.schema || '').startsWith('league-character-draft')
    || Boolean(payload.equipment && payload.abilities)
    || Boolean(wrappedDraft.equipment && wrappedDraft.abilities);
  const isRoll20 = Number(payload.schema_version) > 0
    && payload.type === 'character'
    && Array.isArray(payload.character?.attribs);

  if (!isDraft && !isRoll20) {
    throw new Error('Поддерживаются JSON конструктора League of Heroes и экспорт персонажа Roll20 (VTTES).');
  }

  if (isRoll20) {
    const name = String(payload.character?.name || roll20Attribute(payload, 'character_name') || 'Безымянный герой').trim();
    const summary = {
      species: String(roll20Attribute(payload, 'race') || ''),
      class: String(roll20Attribute(payload, 'class') || ''),
      background: String(roll20Attribute(payload, 'background') || ''),
      level: Number(roll20Attribute(payload, 'level')) || 1,
      portraitUrl: safePortrait(payload.character?.avatar),
      source: 'roll20'
    };
    return {
      name: name || 'Безымянный герой',
      draftData: {},
      roll20Data: payload,
      playState: {
        market: roll20Market(payload),
        identity: {
          hp: Number(roll20Attribute(payload, 'hp')) || null,
          hpMax: Number(roll20Attributes(payload).find((item: any) => item?.name === 'hp')?.max) || null,
          armorClass: Number(roll20Attribute(payload, 'ac')) || null
        },
        source: 'roll20',
        importedAt: new Date().toISOString()
      },
      summary
    };
  }

  const state = Object.keys(wrappedDraft).length ? wrappedDraft : payload;
  const abilities = asObject(state.abilities);
  const summary = {
    species: String(state.species || ''),
    class: String(state.class || ''),
    background: String(state.background || ''),
    level: Number(state.level) || 1,
    portraitUrl: safePortrait(state.portrait || state.avatar || state.profile?.portrait),
    source: 'constructor'
  };
  return {
    name: String(state.name || 'Безымянный герой').trim() || 'Безымянный герой',
    draftData: payload,
    roll20Data: {},
    playState: {
      market: draftMarket(state),
      identity: { abilities },
      source: 'constructor',
      importedAt: new Date().toISOString()
    },
    summary
  };
}

export function getCharacterMarket(character: Record<string, any>): CharacterMarketState {
  const stored = asObject(asObject(character.play_state).market);
  if (Array.isArray(stored.inventory) && Number.isFinite(Number(stored.currencyCopper))) {
    return {
      inventory: stored.inventory.map((entry: any) => ({
        id: String(entry.id || `custom:${crypto.randomUUID()}`),
        name: String(entry.name || shopById.get(String(entry.id))?.name || 'Неизвестный предмет'),
        quantity: positiveQuantity(entry.quantity),
        source: entry.source || 'custom',
        weight: Number(entry.weight || shopById.get(String(entry.id))?.weight || 0)
      })),
      currencyCopper: Math.max(0, Math.round(Number(stored.currencyCopper)))
    };
  }
  const draft = asObject(character.draft_data);
  const state = Object.keys(asObject(draft.state)).length ? asObject(draft.state) : draft;
  if (state.equipment) return draftMarket(state);
  return roll20Market(asObject(character.roll20_data));
}

function updateRoll20Currency(payload: Record<string, any>, copper: number) {
  if (!Array.isArray(payload.character?.attribs)) return payload;
  const next = structuredClone(payload);
  const values: Record<string, number> = {
    pp: Math.floor(copper / 1000),
    gp: Math.floor((copper % 1000) / 100),
    ep: 0,
    sp: Math.floor((copper % 100) / 10),
    cp: copper % 10
  };
  for (const [name, current] of Object.entries(values)) {
    const attribute = next.character.attribs.find((item: any) => item?.name === name);
    if (attribute) attribute.current = String(current);
    else next.character.attribs.push({ name, current: String(current), max: '' });
  }
  return next;
}

function updateRoll20Market(payload: Record<string, any>, market: CharacterMarketState) {
  const next = updateRoll20Currency(payload, market.currencyCopper);
  if (!Array.isArray(next.character?.attribs)) return next;
  next.character.attribs = next.character.attribs.filter((attribute: any) =>
    !/^repeating_inventory_/i.test(String(attribute?.name || ''))
  );
  market.inventory.forEach((entry, index) => {
    const item = shopById.get(entry.id);
    const rowId = `lohmarket${index + 1}`;
    const fields: Record<string, unknown> = {
      itemname: item?.name || entry.name,
      itemcount: entry.quantity,
      itemweight: item?.weight ?? entry.weight ?? 0,
      itemcontent: item?.category || 'Пользовательский предмет',
      itemproperties: '',
      itemmodifiers: '',
      hasattack: '0',
      useasresource: '0',
      inventorysubflag: '0',
      equipped: '0'
    };
    for (const [field, current] of Object.entries(fields)) {
      next.character.attribs.push({
        name: `repeating_inventory_${rowId}_${field}`,
        current: String(current),
        max: ''
      });
    }
  });
  return next;
}

export function buildMarketUpdate(character: Record<string, any>, market: CharacterMarketState) {
  const playState = { ...asObject(character.play_state), market };
  const draftData = structuredClone(asObject(character.draft_data));
  const draftState = Object.keys(asObject(draftData.state)).length ? draftData.state : draftData;
  if (draftState && typeof draftState === 'object' && draftState.equipment) {
    draftState.equipment = {
      ...asObject(draftState.equipment),
      inventory: market.inventory
        .filter((entry) => shopById.has(entry.id))
        .map((entry) => ({ id: entry.id, quantity: entry.quantity, source: entry.source })),
      goldCopper: market.currencyCopper
    };
  }
  return {
    play_state: playState,
    draft_data: draftData,
    roll20_data: updateRoll20Market(asObject(character.roll20_data), market),
    revision: Math.max(1, Number(character.revision || 1)) + 1
  };
}

export function salePrice(itemId: string) {
  const item = shopById.get(itemId);
  if (!item) return 1;
  return Math.max(1, Math.floor(Math.max(0, item.costCopper) / 2));
}

export function formatCopper(total: number) {
  let rest = Math.max(0, Math.round(total));
  const values = [
    ['пм', 1000],
    ['зм', 100],
    ['см', 10],
    ['мм', 1]
  ] as const;
  const parts: string[] = [];
  for (const [label, rate] of values) {
    const amount = Math.floor(rest / rate);
    if (amount) parts.push(`${amount} ${label}`);
    rest %= rate;
  }
  return parts.join(' ') || '0 зм';
}
