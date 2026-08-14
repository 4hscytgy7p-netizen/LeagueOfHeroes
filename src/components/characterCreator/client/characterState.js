(function attachCharacterCreatorState(globalScope) {
  'use strict';

  function loadState(storageKey, defaultState, abilityKeys) {
    let state = structuredClone(defaultState);

    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');

      if (saved && typeof saved === 'object') {
        state = {
          ...structuredClone(defaultState),
          ...saved,
          profile: {
            ...structuredClone(defaultState.profile || {}),
            ...(saved.profile && typeof saved.profile === 'object'
              ? saved.profile
              : {})
          },
          backgroundCharacteristics: {
            ...structuredClone(defaultState.backgroundCharacteristics || {}),
            ...(saved.backgroundCharacteristics &&
            typeof saved.backgroundCharacteristics === 'object'
              ? saved.backgroundCharacteristics
              : {})
          },
          physique: {
            ...structuredClone(defaultState.physique),
            ...(saved.physique || {})
          },
          choices:
            saved.choices && typeof saved.choices === 'object'
              ? saved.choices
              : {},
          customDeity: {
            ...structuredClone(defaultState.customDeity || {}),
            ...(saved.customDeity && typeof saved.customDeity === 'object'
              ? saved.customDeity
              : {})
          },
          customPatron: {
            ...structuredClone(defaultState.customPatron || {}),
            ...(saved.customPatron && typeof saved.customPatron === 'object'
              ? saved.customPatron
              : {})
          },
          spells: {
            cantrips: Array.isArray(saved.spells?.cantrips)
              ? saved.spells.cantrips
              : [],
            level1: Array.isArray(saved.spells?.level1)
              ? saved.spells.level1
              : [],
            sources:
              saved.spells?.sources &&
              typeof saved.spells.sources === 'object'
                ? saved.spells.sources
                : {}
          },
          equipment: {
            initializedFor:
              Number(saved.equipment?.version || 0) >= 6
                ? String(saved.equipment?.initializedFor || '')
                : '',
            inventory:
              Number(saved.equipment?.version || 0) >= 6 &&
              Array.isArray(saved.equipment?.inventory)
                ? saved.equipment.inventory
                : [],
            goldCopper:
              Number(saved.equipment?.version || 0) >= 6
                ? Number(saved.equipment?.goldCopper || 0)
                : 0,
            classVariantIndex: Number(
              saved.equipment?.classVariantIndex || 0
            ),
            purchaseConfirmed: Boolean(
              saved.equipment?.purchaseConfirmed
            ),
            version: 7
          },
          abilities: Object.fromEntries(
            abilityKeys.map((key) => {
              const value = saved.abilities?.[key];

              return [
                key,
                typeof value === 'object'
                  ? {
                      base: Number(value.base) || 8,
                      bonus: Number(value.bonus) || 0
                    }
                  : { base: 8, bonus: 0 }
              ];
            })
          ),
          alignment: saved.alignment || null
        };
      }
    } catch (_) {
      return structuredClone(defaultState);
    }

    return state;
  }

  function saveState(storageKey, state) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function findSpecies(state, speciesOptions) {
    return (
      speciesOptions.find((item) => item.id === state.species) || null
    );
  }

  function findVariant(state, species) {
    return (
      species?.variants?.find(
        (item) => item.id === state.speciesVariant
      ) || null
    );
  }

  function findClass(state, classOptions) {
    return classOptions.find((item) => item.id === state.class) || null;
  }

  function findBackground(state, backgroundOptions) {
    return (
      backgroundOptions.find((item) => item.id === state.background) ||
      null
    );
  }

  function getEffectiveAbilities(species, variant) {
    const replaced = new Set(variant?.replacesAbilities || []);
    const base = (species?.abilities || []).filter(
      (ability) => !replaced.has(ability.title)
    );

    return [...base, ...(variant?.abilities || [])];
  }

  function selectedOriginFeatEntries(state, featOptions) {
    const entries = [];
    const backgroundId =
      state.choices?.['background:originFeat']?.[0];
    const speciesId = state.choices?.['species:originFeat']?.[0];

    if (backgroundId) {
      const feat = featOptions.find((item) => item.id === backgroundId);
      if (feat) {
        entries.push({
          source: 'background',
          id: backgroundId,
          feat
        });
      }
    }

    if (speciesId) {
      const feat = featOptions.find((item) => item.id === speciesId);
      if (feat) {
        entries.push({
          source: 'species',
          id: speciesId,
          feat
        });
      }
    }

    return entries;
  }

  function selectedOriginFeats(state, featOptions) {
    const ids = [
      ...(state.choices?.['background:originFeat'] || []),
      ...(state.choices?.['species:originFeat'] || [])
    ];

    return ids
      .map((id) => featOptions.find((item) => item.id === id))
      .filter(Boolean);
  }

  function isHumanSpecies(state, species) {
    return (
      String(species?.id || state.species || '').toLowerCase() ===
        'human' ||
      /человек/i.test(String(species?.name || ''))
    );
  }

  function isCustomLineageSpecies(state, species) {
    const id = String(
      species?.id || state.species || ''
    ).toLocaleLowerCase('ru');
    const name = String(species?.name || '').toLocaleLowerCase('ru');
    const compactId = id.replace(/[^a-zа-я0-9]+/gi, '');

    return (
      compactId === 'customlineage' ||
      /сво[её]\s+происхождение/.test(name)
    );
  }

  function modifier(score) {
    return Math.floor((Number(score) - 10) / 2);
  }

  function totalScore(state, key) {
    const ability = state.abilities?.[key] || { base: 8, bonus: 0 };
    return Number(ability.base || 0) + Number(ability.bonus || 0);
  }

  function usedPointBuy(state, costTable) {
    return Object.values(state.abilities || {}).reduce(
      (sum, item) => sum + Number(costTable[item.base] || 0),
      0
    );
  }

  function usedBackgroundBonus(state) {
    return Object.values(state.abilities || {}).reduce(
      (sum, item) => sum + Number(item.bonus || 0),
      0
    );
  }

  globalScope.CharacterCreatorState = Object.freeze({
    loadState,
    saveState,
    findSpecies,
    findVariant,
    findClass,
    findBackground,
    getEffectiveAbilities,
    selectedOriginFeatEntries,
    selectedOriginFeats,
    isHumanSpecies,
    isCustomLineageSpecies,
    modifier,
    totalScore,
    usedPointBuy,
    usedBackgroundBonus
  });
})(window);
