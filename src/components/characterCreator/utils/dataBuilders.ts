export function buildBackgroundOptions({
  backgroundsData,
  allTools,
  artisanTools,
  musicalInstruments,
  gamingSets,
  standardLanguages,
  rareLanguages,
  toolOptionsFromDescription,
  languageOptionsForSource,
  languageChoiceCount
}: any) {
  return backgroundsData.map((item: any) => ({
    id: item.id,
    name: item.name,
    nameEn: item.nameEn,
    sourceBook: item.sourceBook,
    lore: item.lore,
    feat: item.proficiencies?.feat ?? item.feat ?? '',
    skills: item.proficiencies?.skills?.description ?? item.skills ?? '',
    tools: item.proficiencies?.tools?.description ?? item.tools ?? '',
    equipment: item.proficiencies?.equipment ?? item.equipment ?? '',
    skillCount: item.proficiencies?.skills?.count ?? 0,
    toolOptions: toolOptionsFromDescription(
      item.proficiencies?.tools?.description ?? item.tools ?? '',
      allTools,
      artisanTools,
      musicalInstruments,
      gamingSets
    ),
    toolCount: String(
      item.proficiencies?.tools?.description ?? item.tools ?? ''
    ).trim()
      ? 1
      : 0,
    languageText:
      item.proficiencies?.languages?.description ?? item.languages ?? '',
    languageOptions: languageOptionsForSource(
      item.proficiencies?.languages?.description ?? item.languages ?? '',
      standardLanguages,
      rareLanguages
    ),
    languageCount: languageChoiceCount(
      item.proficiencies?.languages?.description ?? item.languages ?? ''
    ),
    spellTable: item.spellTable ?? null,
    variants: item.variants ?? null,
    characteristics: item.characteristics ?? null
  }));
}

export function buildFeatOptions(featsData: any[]) {
  return featsData
    .filter((item: any) => item.type === 'origin')
    .map((item: any) => ({
      id: item.id,
      name: item.name,
      nameEn: item.nameEn,
      requirements: Array.isArray(item.requirements)
        ? item.requirements
        : [],
      effects: item.effects ?? []
    }));
}

export function buildCustomLineageGeneralFeatOptions(
  featsData: any[],
  isEligible: (item: any) => boolean
) {
  return featsData
    .filter(isEligible)
    .map((item: any) => ({
      id: item.id,
      name: item.name,
      nameEn: item.nameEn,
      type: item.type,
      requirements: Array.isArray(item.requirements)
        ? item.requirements
        : [],
      effects: Array.isArray(item.effects) ? item.effects : [],
      abilityScoreIncrease: Array.isArray(item.abilityScoreIncrease)
        ? item.abilityScoreIncrease
        : []
    }));
}

export function buildFightingStyleOptions(featsData: any[]) {
  return featsData
    .filter((item: any) => item.type === 'fighting-style')
    .map((item: any) => ({
      id: item.id,
      name: item.name,
      href: `/feats/${item.id}`,
      requirements: Array.isArray(item.requirements) ? item.requirements : [],
      description: Array.isArray(item.effects)
        ? item.effects.join('\n\n')
        : String(item.description ?? '')
    }));
}

export function buildRoll20RowsByName(
  template: any,
  normalizeSpellName: (value: unknown) => string
) {
  const spellRows = new Map<string, any>();
  const attackRows = new Map<string, any>();

  for (const attribute of template?.character?.attribs ?? []) {
    const attackMatch = String(attribute.name ?? '').match(
      /^repeating_attack_([^_]+)_(.+)$/
    );

    if (attackMatch) {
      const [, rowId, field] = attackMatch;
      if (!attackRows.has(rowId)) {
        attackRows.set(rowId, { rowId, fields: {}, attributes: [] });
      }
      const attackRow = attackRows.get(rowId);
      attackRow.fields[field] = attribute.current ?? '';
      attackRow.attributes.push({
        field,
        name: attribute.name,
        current: attribute.current ?? '',
        max: attribute.max ?? ''
      });
      continue;
    }

    const match = String(attribute.name ?? '').match(
      /^repeating_spell-(cantrip|1)_([^_]+)_(.+)$/
    );

    if (!match) continue;

    const [, section, rowId, field] = match;
    const key = `${section}:${rowId}`;

    if (!spellRows.has(key)) {
      spellRows.set(key, {
        section,
        rowId,
        fields: {},
        attributes: []
      });
    }

    const row = spellRows.get(key);
    row.fields[field] = attribute.current ?? '';
    row.attributes.push({
      field,
      name: attribute.name,
      current: attribute.current ?? '',
      max: attribute.max ?? ''
    });
  }

  for (const row of spellRows.values()) {
    const attackRowId = String(row.fields.rollcontent ?? '').match(
      /repeating_attack_([^_]+)_attack/
    )?.[1];
    row.attackAttributes = attackRowId
      ? (attackRows.get(attackRowId)?.attributes ?? [])
      : [];
  }

  const rowsByName = new Map<string, any>();

  for (const row of spellRows.values()) {
    const name = normalizeSpellName(row.fields.spellname);
    if (!name) continue;

    const level = row.section === 'cantrip' ? 'cantrip' : '1';
    const key = `${level}:${name}`;

    if (!rowsByName.has(key)) rowsByName.set(key, row);
  }

  return rowsByName;
}

export function buildClassSpellOptions({
  classOptions,
  spells,
  classSpellNameOverrides = {},
  normalizeSpellLevel,
  normalizeSpellName,
  spellBelongsToClass,
  roll20RowsByName
}: any) {
  return Object.fromEntries(
    classOptions.map((characterClass: any) => {
      const overrideNames = new Set(
        (classSpellNameOverrides[characterClass.id] || [])
          .map((name: unknown) => normalizeSpellName(name))
      );
      const items = spells
        .filter((spell: any) =>
          ['cantrip', '1'].includes(normalizeSpellLevel(spell.level))
        )
        .filter((spell: any) =>
          spellBelongsToClass(spell, characterClass)
          || overrideNames.has(normalizeSpellName(spell.nameEn))
          || overrideNames.has(normalizeSpellName(spell.name))
        )
        .map((spell: any) => {
          const level = normalizeSpellLevel(spell.level);
          const row = roll20RowsByName.get(
            `${level}:${normalizeSpellName(spell.name)}`
          );

          return {
            id: String(
              spell.id ??
                `${level}-${normalizeSpellName(spell.name).replace(/ /g, '-')}`
            ),
            name: spell.name,
            nameEn: spell.nameEn,
            level,
            school: spell.school ?? row?.fields?.spellschool ?? '',
            castingTime:
              spell.castingTime ?? row?.fields?.spellcastingtime ?? '',
            range: spell.range ?? row?.fields?.spellrange ?? '',
            duration: spell.duration ?? row?.fields?.spellduration ?? '',
            components: {
              verbal: Boolean(spell.components?.verbal),
              somatic: Boolean(spell.components?.somatic),
              material: String(spell.components?.material || '').trim()
            },
            description:
              spell.description ?? row?.fields?.spelldescription ?? '',
            roll20Attributes: row?.attributes ?? [],
            roll20AttackAttributes: row?.attackAttributes ?? []
          };
        });

      const unique = Array.from(
        new Map(
          items.map((item: any) => [
            `${item.level}:${normalizeSpellName(item.name)}`,
            item
          ])
        ).values()
      );

      return [
        characterClass.id,
        unique.sort((a: any, b: any) =>
          String(a.name).localeCompare(String(b.name), 'ru')
        )
      ];
    })
  );
}

export function buildClassSpellLimits({
  classOptions,
  spellLimits,
  normalizeSpellName
}: any) {
  return Object.fromEntries(
    classOptions.map((item: any) => {
      const keys = [item.id, item.nameEn, item.name].map((value) =>
        normalizeSpellName(value).replace(/ /g, '')
      );

      const found = Object.entries(spellLimits).find(([key]) =>
        keys.some((value) => value === key || value.includes(key))
      );

      return [item.id, found?.[1] ?? { cantrips: 0, level1: 0 }];
    })
  );
}

export function buildEquipmentShopItems({
  items,
  getEquipmentCategoryGroup,
  parseMoneyToCopper,
  parseWeight
}: any) {
  return items.map((item: any) => ({
    id: item.id,
    name: item.name,
    nameEn: item.nameEn,
    category: item.type || 'Прочее',
    categoryGroup: getEquipmentCategoryGroup(item.type),
    cost: item.cost || '—',
    costCopper: parseMoneyToCopper(item.cost),
    weight: parseWeight(item.weight),
    description: item.description || '',
    sourceBook: item.sourceBook || '',
    href: `/items/${item.id}`
  }));
}
