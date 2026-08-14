(function attachRoll20EquipmentEnhancer(globalScope) {
  'use strict';

  const exporter = globalScope.CharacterCreatorRoll20;
  if (!exporter?.buildPayload) {
    console.error('Не удалось подключить улучшенный экспорт снаряжения: основной модуль Roll20 не найден.');
    return;
  }

  const originalBuildPayload = exporter.buildPayload.bind(exporter);

  function createRoll20Id() {
    const alphabet = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let id = '-';
    for (let index = 0; index < 19; index += 1) {
      id += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return id;
  }

  function addAttribute(payload, name, current, max = '') {
    payload.character.attribs.push({
      name,
      current: current ?? '',
      max,
      id: createRoll20Id()
    });
  }

  function addRepeatingRow(payload, section, rowId, fields) {
    Object.entries(fields).forEach(([field, current]) => {
      addAttribute(payload, `repeating_${section}_${rowId}_${field}`, current);
    });
  }

  function cleanText(value) {
    return String(value ?? '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeDice(value) {
    return String(value || '')
      .toLocaleLowerCase('ru')
      .replace(/(\d*)[дк](\d+)/g, (_, count, size) => `${count || 1}d${size}`);
  }

  function roll20Weight(value) {
    const match = String(value ?? '').replace(',', '.').match(/[\d.]+/);
    const weight = match ? Number(match[0]) : 0;
    return Number.isFinite(weight) ? String(weight) : '0';
  }

  function roll20ItemWeight(item) {
    const weight = Number(roll20Weight(item?.weight));
    const bundleMatch = cleanText(item?.name).match(/\((\d+)\)\s*$/);
    const bundleSize = bundleMatch ? Number(bundleMatch[1]) : 1;
    const unitWeight = bundleSize > 1 ? weight / bundleSize : weight;

    return Number.isFinite(unitWeight)
      ? String(Number(unitWeight.toFixed(6)))
      : '0';
  }

  function damageTypeFromDescription(description) {
    const text = String(description || '').toLocaleLowerCase('ru');
    if (/дробящ/.test(text)) return 'дробящий';
    if (/колющ/.test(text)) return 'колющий';
    if (/рубящ/.test(text)) return 'рубящий';
    if (/огн/.test(text)) return 'огонь';
    if (/холод/.test(text)) return 'холод';
    if (/яд/.test(text)) return 'яд';
    return '';
  }

  function parseWeapon(item) {
    const description = cleanText(item.description);
    const diceSource = normalizeDice(description);
    const damageMatch = diceSource.match(/(?:^|\s)(\d+d\d+|\d+)(?=\s|,)/i);
    const damage = damageMatch?.[1] || '';
    const damageType = damageTypeFromDescription(description);
    const rangeMatch = description.match(/(?:дистанция|дальность)\s*(\d+\s*\/\s*\d+)/i);
    const range = rangeMatch ? rangeMatch[1].replace(/\s+/g, '') : '';
    const isRanged = /дальнобойное оружие/i.test(item.category) || /боеприпасы\s*\(/i.test(description);
    const isFinesse = /фехтовальн/i.test(description);
    const attackAbility = isRanged && !/метательн/i.test(description)
      ? '@{dexterity_mod}'
      : '@{strength_mod}';

    const propertyPart = description
      .replace(/^\s*(?:\d+d\d+|\d+)\s+[^,]+,?\s*/i, '')
      .trim();

    return {
      damage,
      damageType,
      range,
      properties: propertyPart,
      attackAbility,
      isFinesse,
      itemType: isRanged ? 'Ranged Weapon' : 'Melee Weapon'
    };
  }

  function parseArmor(item) {
    const description = cleanText(item.description);
    const category = String(item.category || '');
    const isShield = /щит/i.test(category);
    const acMatch = description.match(/КД\s*:\s*(\d+)/i);
    const ac = isShield ? '2' : (acMatch?.[1] || '');
    const maxDexMatch = description.match(/макс\.?\s*(\d+)/i);
    const strengthMatch = description.match(/Сила\s*:\s*(\d+)/i);
    const stealthDisadvantage = /Скрытность\s*:\s*Помеха/i.test(description);
    const armorType = /тяж[её]л/i.test(category)
      ? 'Heavy Armor'
      : /средн/i.test(category)
        ? 'Medium Armor'
        : /л[её]гк/i.test(category)
          ? 'Light Armor'
          : /щит/i.test(category)
            ? 'Shield'
            : 'Armor';

    let acFormula = ac;
    if (isShield) acFormula = '+2';
    else if (/л[её]гк/i.test(category)) acFormula = `${ac} + DEX`;
    else if (/средн/i.test(category)) acFormula = `${ac} + DEX (макс. ${maxDexMatch?.[1] || 2})`;

    const properties = [
      stealthDisadvantage ? 'Stealth Disadvantage' : '',
      strengthMatch ? 'Strength Requirement' : ''
    ].filter(Boolean).join(', ');

    const modifiers = [
      `Item Type: ${armorType}`,
      ac ? `AC: ${ac}` : '',
      stealthDisadvantage ? 'Stealth:Disadvantage' : '',
      maxDexMatch ? `Max Dex: ${maxDexMatch[1]}` : ''
    ].filter(Boolean).join(', ');

    return {
      ac,
      acFormula,
      armorType,
      properties,
      modifiers,
      strengthMinimum: strengthMatch?.[1] || '',
      stealthDisadvantage
    };
  }

  function buildWeaponContent(item, weapon) {
    return [
      item.nameEn || item.name,
      item.category || '',
      cleanText(item.description),
      weapon.damage ? `Урон: ${weapon.damage}` : '',
      weapon.damageType ? `Тип урона: ${weapon.damageType}` : '',
      weapon.range ? `Дистанция: ${weapon.range}` : '',
      `Вес: ${item.weight || 0}`,
      item.sourceBook ? `Источник: ${item.sourceBook}` : ''
    ].filter(Boolean).join('\n');
  }

  function buildArmorContent(item, armor) {
    return [
      item.nameEn || item.name,
      item.category || '',
      cleanText(item.description),
      armor.acFormula ? `КД: ${armor.acFormula}` : '',
      armor.stealthDisadvantage ? 'Скрытность: Помеха' : '',
      armor.strengthMinimum ? `Минимальная Сила: ${armor.strengthMinimum}` : '',
      `Вес: ${item.weight || 0}`,
      item.sourceBook ? `Источник: ${item.sourceBook}` : ''
    ].filter(Boolean).join('\n');
  }

  function addWeapon(payload, item, quantity) {
    const inventoryRowId = createRoll20Id();
    const attackRowId = createRoll20Id();
    const weapon = parseWeapon(item);
    const itemModifiers = [
      `Item Type: ${weapon.itemType}`,
      weapon.damage ? `Damage: ${weapon.damage}` : '',
      weapon.damageType ? `Damage Type: ${weapon.damageType}` : '',
      weapon.range ? `Range: ${weapon.range}` : '',
      'Critical Range: 20'
    ].filter(Boolean).join(', ');

    addRepeatingRow(payload, 'inventory', inventoryRowId, {
      itemname: item.name,
      itemcount: String(quantity),
      itemproperties: weapon.properties,
      itemweight: roll20ItemWeight(item),
      itemcontent: buildWeaponContent(item, weapon),
      itemmodifiers: itemModifiers,
      hasattack: '1',
      useasresource: '0',
      itemattackid: attackRowId,
      inventorysubflag: '0',
      equipped: '0'
    });

    const damage = weapon.damage || '1d4';
    const damageType = weapon.damageType || '';
    const range = weapon.range || (weapon.itemType === 'Melee Weapon' ? '5' : '');
    const ability = weapon.attackAbility;

    addRepeatingRow(payload, 'attack', attackRowId, {
      'options-flag': '0',
      itemid: inventoryRowId,
      atkname: item.name,
      dmgbase: damage,
      dmgtype: damageType,
      atkrange: range,
      atkattr_base: ability,
      dmgattr: ability,
      atkmagic: '',
      atkdmgtype: `${damage} ${damageType}`.trim(),
      atkbonus: '+2',
      atkcritrange: '20',
      rollbase_dmg: `@{wtype}&{template:dmg} {{rname=@{atkname}}} @{atkflag} {{range=@{atkrange}}} @{dmgflag} {{dmg1=[[${damage}+@{dmgattr}]]}} {{dmg1type=${damageType}}} @{dmg2flag} {{dmg2=[[0]]}} {{dmg2type=}} @{saveflag} @{hldmg} {{spelllevel=@{spelllevel}}} {{innate=@{spell_innate}}} {{globaldamage=@{global_damage_mod_roll}}} {{globaldamagetype=@{global_damage_mod_type}}} @{charname_output}`,
      rollbase_crit: `@{wtype}&{template:dmg} {{crit=1}} {{rname=@{atkname}}} @{atkflag} {{range=@{atkrange}}} @{dmgflag} {{dmg1=[[${damage}+@{dmgattr}]]}} {{dmg1type=${damageType}}} @{dmg2flag} {{dmg2=[[0]]}} {{dmg2type=}} {{crit1=[[${damage}]]}} {{crit2=[[0]]}} @{saveflag} @{hldmg} {{spelllevel=@{spelllevel}}} {{innate=@{spell_innate}}} {{globaldamage=@{global_damage_mod_roll}}} {{globaldamagecrit=@{global_damage_mod_crit}}} {{globaldamagetype=@{global_damage_mod_type}}} @{charname_output}`,
      rollbase: `@{wtype}&{template:atk} {{mod=@{atkbonus}}} {{rname=[@{atkname}](~repeating_attack_attack_dmg)}} {{rnamec=[@{atkname}](~repeating_attack_attack_crit)}} {{r1=[[@{d20}cs>@{atkcritrange}+@{atkattr_base}+2[PROF]]]}} @{rtype}cs>@{atkcritrange}+@{atkattr_base}+2[PROF]]]}} {{range=@{atkrange}}} {{spelllevel=@{spelllevel}}} {{innate=@{spell_innate}}} {{globalattack=@{global_attack_mod}}} @{charname_output}`
    });
  }

  function parseNaturalAttack(feature) {
    const name = cleanText(feature?.title || feature?.name);
    const description = cleanText(feature?.description);
    if (!name || !description) return null;
    if (!/(?:безоружн|природн\w*\s+(?:рукопашн\w*\s+)?оруж)/i.test(description)) return null;

    const damageMatch = normalizeDice(description).match(/\b(\d+d\d+)\b/i);
    const damageType = damageTypeFromDescription(description);
    if (!damageMatch || !damageType) return null;

    let damageAbility = '@{strength_mod}';
    if (/модификатор\s+телосложен/i.test(description)) damageAbility = '@{constitution_mod}';
    else if (/модификатор\s+ловкост/i.test(description)) damageAbility = '@{dexterity_mod}';

    // Укус дампира является способом нанести урон Безоружным ударом:
    // бросок атаки по-прежнему использует Силу, а особое правило вида
    // заменяет только модификатор урона на Телосложение.
    const isDhampirBite = /(?:укус\s+вампира|vampiric\s+bite)/i.test(name);
    const attackAbility = isDhampirBite ? '@{strength_mod}' : damageAbility;

    return {
      name,
      damage: damageMatch[1],
      damageType,
      attackAbility,
      damageAbility,
      range: '5'
    };
  }

  function addNaturalAttack(payload, attack) {
    const attackRowId = createRoll20Id();
    const { name, damage, damageType, attackAbility, damageAbility, range } = attack;

    addRepeatingRow(payload, 'attack', attackRowId, {
      'options-flag': '0',
      itemid: '',
      atkname: name,
      dmgbase: damage,
      dmgtype: damageType,
      atkrange: range,
      atkattr_base: attackAbility,
      dmgattr: damageAbility,
      atkmagic: '',
      atkdmgtype: `${damage} ${damageType}`,
      atkbonus: '+2',
      atkcritrange: '20',
      rollbase_dmg: `@{wtype}&{template:dmg} {{rname=@{atkname}}} @{atkflag} {{range=@{atkrange}}} @{dmgflag} {{dmg1=[[${damage}+@{dmgattr}]]}} {{dmg1type=${damageType}}} @{dmg2flag} {{dmg2=[[0]]}} {{dmg2type=}} @{saveflag} @{hldmg} {{spelllevel=@{spelllevel}}} {{innate=@{spell_innate}}} {{globaldamage=@{global_damage_mod_roll}}} {{globaldamagetype=@{global_damage_mod_type}}} @{charname_output}`,
      rollbase_crit: `@{wtype}&{template:dmg} {{crit=1}} {{rname=@{atkname}}} @{atkflag} {{range=@{atkrange}}} @{dmgflag} {{dmg1=[[${damage}+@{dmgattr}]]}} {{dmg1type=${damageType}}} @{dmg2flag} {{dmg2=[[0]]}} {{dmg2type=}} {{crit1=[[${damage}]]}} {{crit2=[[0]]}} @{saveflag} @{hldmg} {{spelllevel=@{spelllevel}}} {{innate=@{spell_innate}}} {{globaldamage=@{global_damage_mod_roll}}} {{globaldamagecrit=@{global_damage_mod_crit}}} {{globaldamagetype=@{global_damage_mod_type}}} @{charname_output}`,
      rollbase: `@{wtype}&{template:atk} {{mod=@{atkbonus}}} {{rname=[@{atkname}](~repeating_attack_attack_dmg)}} {{rnamec=[@{atkname}](~repeating_attack_attack_crit)}} {{r1=[[@{d20}cs>@{atkcritrange}+@{atkattr_base}+2[PROF]]]}} @{rtype}cs>@{atkcritrange}+@{atkattr_base}+2[PROF]]]}} {{range=@{atkrange}}} {{spelllevel=@{spelllevel}}} {{innate=@{spell_innate}}} {{globalattack=@{global_attack_mod}}} @{charname_output}`
    });
  }

  function addArmor(payload, item, quantity) {
    const rowId = createRoll20Id();
    const armor = parseArmor(item);

    addRepeatingRow(payload, 'inventory', rowId, {
      itemname: item.name,
      itemcount: String(quantity),
      itemproperties: armor.properties,
      itemweight: roll20ItemWeight(item),
      itemcontent: buildArmorContent(item, armor),
      itemmodifiers: armor.modifiers,
      hasattack: '0',
      useasresource: '0',
      itemattackid: '',
      inventorysubflag: '0',
      equipped: '0'
    });
  }

  function addOrdinaryItem(payload, item, quantity) {
    const rowId = createRoll20Id();
    addRepeatingRow(payload, 'inventory', rowId, {
      itemname: item.name,
      itemcount: String(quantity),
      itemproperties: '',
      itemweight: roll20ItemWeight(item),
      itemcontent: [
        item.nameEn || '',
        item.category || '',
        cleanText(item.description),
        item.sourceBook ? `Источник: ${item.sourceBook}` : ''
      ].filter(Boolean).join('\n'),
      itemmodifiers: '',
      hasattack: '0',
      useasresource: '0',
      itemattackid: '',
      inventorysubflag: '0',
      equipped: '0'
    });
  }

  function enhanceEquipment(payload, context) {
    const {
      state,
      equipmentShopItems,
      EQUIPMENT_PACK_CONTENTS,
      findSpecies,
      findVariant,
      getEffectiveAbilities
    } = context;
    if (!payload?.character || !Array.isArray(payload.character.attribs)) return payload;

    // Основной экспорт создаёт упрощённые строки. Заменяем только инвентарь
    // и связанные с ним атаки на полноценные карточки Roll20.
    payload.character.attribs = payload.character.attribs.filter((attribute) =>
      !/^repeating_inventory_/.test(String(attribute.name || ''))
      && !/^repeating_attack_/.test(String(attribute.name || ''))
    );

    const items = equipmentShopItems || [];
    const itemById = new Map(items.map((item) => [String(item.id), item]));
    const normalizeName = (value) => cleanText(value)
      .toLocaleLowerCase('ru')
      .replace(/ё/g, 'е')
      .replace(/[()«»"']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const itemByName = new Map();
    items.forEach((item) => {
      [item.name, item.nameEn].filter(Boolean).forEach((name) => itemByName.set(normalizeName(name), item));
    });

    // В наборах названия часто стоят в родительном падеже или отличаются от
    // названия той же вещи в каталоге. Без этих соответствий предмет создавался
    // в Roll20 с запасным весом 0.
    const packItemAliases = new Map(Object.entries({
      'спальный мешок': 'спальник',
      'факелов': 'факел',
      'факела': 'факел',
      'рационов': 'рацион',
      'рациона': 'рацион',
      'бурдюк': 'бурдюк полный',
      'фляги масла': 'масло',
      'фляга масла': 'масло',
      'костюма': 'костюм',
      'костюмов': 'костюм',
      'свечей': 'свеча',
      'писчих перьев': 'писчее перо',
      'футляра для карт или свитков': 'футляр для карт или свитков',
      'листов бумаги': 'бумага',
      'листов пергамента': 'пергамент'
    }));
    const packItemFallbacks = new Map(Object.entries({
      'пеньковая веревка 50 футов': {
        name: 'Пеньковая верёвка (50 футов)',
        weight: 10
      },
      'котелок': {
        name: 'Котелок',
        weight: 1
      }
    }));

    function resolvePackItem(name) {
      const normalized = normalizeName(name);
      const alias = packItemAliases.get(normalized);
      return itemByName.get(normalized)
        || (alias ? itemByName.get(normalizeName(alias)) : null)
        || null;
    }

    const packs = EQUIPMENT_PACK_CONTENTS || {};
    function packParts(name) {
      const normalized = normalizeName(name);
      const key = Object.keys(packs).find((candidate) => {
        const normalizedCandidate = normalizeName(candidate);
        return normalized === normalizedCandidate || normalized.includes(normalizedCandidate);
      });
      return key ? packs[key] : null;
    }

    let totalWeight = 0;
    function exportItem(item, quantity) {
      if (!item) return;
      const parts = packParts(item.name);
      if (Array.isArray(parts)) {
        parts.forEach((part) => {
          const text = cleanText(part);
          const match = text.match(/^(\d+)\s+(.+)$/);
          const partQuantity = match ? Number(match[1]) : 1;
          const partName = match ? match[2] : text;
          const partItem = resolvePackItem(partName);
          if (partItem) exportItem(partItem, partQuantity * quantity);
          else {
            const exportedQuantity = partQuantity * quantity;
            const fallback = packItemFallbacks.get(normalizeName(partName));
            const fallbackWeight = Number(fallback?.weight || 0);
            totalWeight += fallbackWeight * exportedQuantity;
            addOrdinaryItem(payload, {
              name: fallback?.name || partName,
              nameEn: '',
              category: 'Снаряжение приключенца',
              categoryGroup: 'gear',
              weight: fallbackWeight,
              description: '',
              sourceBook: ''
            }, exportedQuantity);
          }
        });
        return;
      }

      totalWeight += Number(roll20ItemWeight(item)) * quantity;
      if (item.categoryGroup === 'weapon') addWeapon(payload, item, quantity);
      else if (item.categoryGroup === 'armor') addArmor(payload, item, quantity);
      else addOrdinaryItem(payload, item, quantity);
    }

    for (const entry of state?.equipment?.inventory || []) {
      const item = itemById.get(String(entry.id));
      if (!item) continue;
      exportItem(item, Math.max(1, Number(entry.quantity || 1)));
    }

    const species = typeof findSpecies === 'function' ? findSpecies() : null;
    const variant = typeof findVariant === 'function' ? findVariant(species) : null;
    const speciesFeatures = typeof getEffectiveAbilities === 'function'
      ? getEffectiveAbilities(species, variant)
      : [];

    speciesFeatures
      .map(parseNaturalAttack)
      .filter(Boolean)
      .forEach((attack) => addNaturalAttack(payload, attack));

    const weightAttribute = payload.character.attribs.find((item) => item.name === 'weighttotal');
    if (weightAttribute) weightAttribute.current = totalWeight;
    else addAttribute(payload, 'weighttotal', totalWeight);

    return payload;
  }

  globalScope.CharacterCreatorRoll20 = Object.freeze({
    buildPayload(context) {
      const payload = originalBuildPayload(context);
      return enhanceEquipment(payload, context);
    }
  });
})(window);
