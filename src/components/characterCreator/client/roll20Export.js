(function attachCharacterCreatorRoll20(globalScope) {
  'use strict';

  function buildPayload(context) {
    const {
      roll20Template,
      state,
      findSpecies,
      findVariant,
      findClass,
      findBackground,
      ALIGNMENTS,
      modifier,
      totalScore,
      getHitDieSize,
      getSpeciesSpeed,
      selectedOriginFeats,
      selectedOriginFeatEntries,
      getEffectiveAbilities,
      normalizeEquipmentName,
      equipmentShopItems,
      abilityKeys,
      ROLL20_SKILLS,
      ROLL20_SKILL_ABILITIES,
      creatorOptions,
      getClassFeatureGroups,
      WEAPON_MASTERY_DESCRIPTIONS,
      EQUIPMENT_PACK_CONTENTS,
      getClassSpells,
      getSpellSources
    } = context;

    const payload = structuredClone(roll20Template);
    payload.schema_version = 3;
    payload.type = 'character';
    payload.character = payload.character || {};
    // Roll20 использует oldId при импорте, чтобы переписать внутренние ссылки
    // между карточками заклинаний и строками атак на новый ID персонажа.
    payload.character.oldId = createRoll20Id();
    payload.character.name = state.name || 'Безымянный герой';
    payload.character.avatar = '';
    payload.character.defaulttoken = '';
    payload.character.attribs = Array.isArray(payload.character.attribs)
      ? payload.character.attribs.map((attribute) => ({ ...attribute }))
      : [];
    payload.character.abilities = [];

    const species = findSpecies();
    const variant = findVariant(species);
    const characterClass = findClass();
    const background = findBackground();
    const className = characterClass?.name || characterClass?.nameEn || state.class || '';
    const roll20ClassName = characterClass?.nameEn || characterClass?.name || state.class || '';
    const normalizedClassId = String(characterClass?.id || state.class || '').toLocaleLowerCase('en');
    const isRangerClass = normalizedClassId === 'ranger';
    const isApothecaryClass = normalizedClassId === 'apothecary';
    const isBloodHunterClass = normalizedClassId === 'bloodhunter';
    const usesCustomClass = isRangerClass || isApothecaryClass || isBloodHunterClass;
    const baseSpeciesName = species?.name || species?.nameEn || state.species || '';
    const variantSpeciesName = variant?.name || variant?.nameEn || '';
    const speciesName = [baseSpeciesName, variantSpeciesName].filter(Boolean).join(' — ');
    const backgroundName = background?.name || background?.nameEn || state.background || '';

    const selectedSubclassId =
      state.subclass
      || state.choices?.['class:subclass']?.[0]
      || state.choices?.['subclass']?.[0]
      || '';

    const subclassRecord = Array.isArray(characterClass?.subclasses)
      ? characterClass.subclasses.find((item) =>
          String(item?.id || item?.name || '') === String(selectedSubclassId)
        )
      : null;

    const subclassName =
      subclassRecord?.nameEn
      || subclassRecord?.name
      || state.subclassName
      || selectedSubclassId
      || '';

    const creatureType = species?.type || 'Гуманоид';
    const creatureSize = state.physique.size || species?.size || '';
    const profile = state.profile && typeof state.profile === 'object'
      ? state.profile
      : {};
    const profileSize = creatureSize;

    const classFeatureGroups = getClassFeatureGroups();
    const selectedClassFeatureOption = (groupId) => {
      const group = classFeatureGroups.find((item) => item.id === groupId);
      const selectedId = state.choices?.[`classFeature:${groupId}`]?.[0];
      return group?.options?.find((option) => option.id === selectedId) || null;
    };
    const selectedOath = selectedClassFeatureOption('paladin-oath');
    const selectedDeity = selectedClassFeatureOption('faith');
    const selectedPatron = selectedClassFeatureOption('warlock-patron');
    const selectedEsotericTheory = selectedClassFeatureOption('esoteric-theory');
    const selectedEsotericTheoryName = String(selectedEsotericTheory?.name || '').trim();
    const describeRelationship = (label, option) => {
      if (!option) return '';
      const details = option.exportDescription
        ? [option.exportDescription]
        : [
            option.detail,
            option.type ? `Вид: ${option.type}` : '',
            option.alignment ? `Мировоззрение: ${option.alignment}` : '',
            Array.isArray(option.domains) && option.domains.length
              ? `Домены: ${option.domains.join(', ')}`
              : '',
            option.realm ? `Обитель: ${option.realm}` : '',
            option.description
          ].filter(Boolean);
      return `${label}: ${option.name || option.id}${details.length ? `\n${details.join('\n')}` : ''}`;
    };
    const alliesAndOrganizations = [
      String(profile.allies || '').trim(),
      describeRelationship('Священная клятва', selectedOath),
      describeRelationship('Божество или духовный путь', selectedDeity),
      describeRelationship('Потусторонний покровитель', selectedPatron)
    ].filter(Boolean).join('\n\n');

    const alignment = ALIGNMENTS[state.alignment] || '';
    const conModifier = modifier(totalScore('constitution'));
    const hitDieSize = getHitDieSize(characterClass);
    const speed = getSpeciesSpeed(species);
    const languages = [...new Set([...(state.choices['languages:fixed'] || ['Общий']), ...(state.choices['languages:selected'] || [])])];
    const tools = [...new Set([
      ...(state.choices['background:tools'] || []),
      ...(state.choices['class:tools'] || []),
      ...(state.choices['species:tools'] || []),
      ...(state.choices['feat:tools'] || [])
    ])];
    const skillsWithoutBedsideManners = [...new Set([
      ...(state.choices['class:skills'] || []),
      ...(state.choices['background:skills'] || []),
      ...(state.choices['species:skill'] || []),
      ...(state.choices['species:adaptiveSkill'] || []),
      ...(state.choices['feat:skills'] || [])
    ])];
    const bedsideMannersSkills = selectedEsotericTheoryName === 'Прикроватные манеры'
      ? ['Проницательность', 'Убеждение']
      : [];
    const skills = [...new Set([...skillsWithoutBedsideManners, ...bedsideMannersSkills])];
    const expertiseSkills = new Set([
      ...(state.choices['class:expertise'] || []),
      ...bedsideMannersSkills.filter((skill) => skillsWithoutBedsideManners.includes(skill))
    ]);
    const originFeatEntries = typeof selectedOriginFeatEntries === 'function'
      ? selectedOriginFeatEntries()
      : selectedOriginFeats().map((feat) => ({ source: 'background', id: feat.id, feat }));
    const effectiveSpeciesAbilities = getEffectiveAbilities(species, variant);
    const speciesIdentity = `${species?.id || ''} ${species?.name || ''} ${species?.nameEn || ''}`;
    const hasPowerfulBuild = effectiveSpeciesAbilities.some((feature) => {
      const title = String(feature?.title || feature?.name || '');
      const description = String(feature?.description || '');
      return /(?:мощное|лошадиное|крупное)\s+телосложение/i.test(title)
        || /считаетесь\s+на\s+один\s+размер\s+больше[\s\S]{0,180}(?:грузопод[ъь]ёмност|толкать|тянуть)/i.test(description);
    });
    const speciesDarkvisionDistance = (() => {
      if (
        /custom.?lineage|сво[её]\s+происхождени/i.test(speciesIdentity)
        && (state.choices?.['species:customLineageFeature'] || [])[0] !== 'darkvision'
      ) return 0;

      // У базовых эльфов дальность задаётся происхождением: у дроу она
      // увеличивается до 120 футов, у всех остальных эльфов остаётся 60.
      // Не полагаемся здесь только на текст карточек — часть вариантов
      // заменяет описание происхождения и из-за этого Token Editor мог
      // получить пустое или устаревшее значение.
      const normalizedSpeciesIdentity = speciesIdentity
        .toLocaleLowerCase('ru')
        .replace(/ё/g, 'е');
      if (/(?:^|\s|[-_])(?:elf|эльф)(?:$|\s|[-_])/.test(normalizedSpeciesIdentity)) {
        const variantIdentity = `${variant?.id || ''} ${variant?.name || ''} ${variant?.nameEn || ''}`
          .toLocaleLowerCase('ru')
          .replace(/ё/g, 'е');
        return /(?:^|\s|[-_])(?:drow|дроу)(?:$|\s|[-_])/.test(variantIdentity) ? 120 : 60;
      }

      return effectiveSpeciesAbilities.reduce((maximum, feature) => {
        const text = `${feature?.title || feature?.name || ''} ${feature?.description || ''}`
          .toLocaleLowerCase('ru')
          .replace(/ё/g, 'е');
        if (!/(?:темн(?:ое|ого)\s+зрени|darkvision)/i.test(text)) return maximum;
        const distance = text.match(/(?:темн(?:ое|ого)\s+зрени|darkvision)[\s\S]{0,100}?(\d+)\s*(?:фут|ft|feet)/i);
        return Math.max(maximum, Number(distance?.[1] || 60));
      }, 0);
    })();
    const hasHalflingLuck = /(?:^|\s)(?:halfling|полурослик)(?:\s|$)/i.test(speciesIdentity)
      && effectiveSpeciesAbilities.some((feature) => {
        const title = String(feature?.title || feature?.name || '');
        const description = String(feature?.description || '');
        return /(?:везучий|удача\s+полурослика)/i.test(title)
          || /выбрасываете\s+1[\s\S]{0,140}переброс/i.test(description);
      });
    const hasIntegratedProtection = /(?:^|\s)(?:warforged|кован(?:ый|ая|ое|ые)?)(?:\s|$)/i.test(speciesIdentity)
      && effectiveSpeciesAbilities.some((feature) =>
        /(?:встроенная\s+защита|integrated\s+protection)/i.test(
          String(feature?.title || feature?.name || '')
        )
      );
    const hasOriginFeat = (featId) => originFeatEntries.some((entry) => entry?.feat?.id === featId || entry?.id === featId);
    const hasDwarvenToughness = effectiveSpeciesAbilities.some((feature) =>
      /дварфийская выдержка/i.test(String(feature?.title || feature?.name || ''))
    );
    const maxHpBonus = (hasOriginFeat('tough') ? 2 : 0) + (hasDwarvenToughness ? 1 : 0);
    const maxHp = Math.max(1, hitDieSize + conModifier + maxHpBonus);
    const magicInitiateClassNames = {
      cleric: 'Жрец',
      druid: 'Друид',
      wizard: 'Волшебник'
    };
    const scionPlanDetails = {
      chaotic: { name: 'Хаотичный', resistance: 'Яд', cantrip: 'Малая иллюзия' },
      evil: { name: 'Злой', resistance: 'Некротическая энергия', cantrip: 'Леденящее прикосновение' },
      good: { name: 'Добрый', resistance: 'Излучение', cantrip: 'Священное пламя' },
      lawful: { name: 'Законный', resistance: 'Силовое поле', cantrip: 'Наставление' },
      outlands: { name: 'Внешние земли', resistance: 'Психическая энергия', cantrip: 'Волшебная рука' }
    };
    const giantStrikeDetails = {
      hill: 'Холмовой удар — дополнительно 1д6 урона того же вида, что и урон оружием; спасбросок Силы или цель сбита с ног.',
      stone: 'Каменный удар — дополнительно 1д6 силового урона; спасбросок Силы или цель оттолкнута на 10 футов.',
      frost: 'Ледяной удар — дополнительно 1д6 урона холодом; спасбросок Телосложения или скорость цели становится 0.',
      fire: 'Огненный удар — дополнительно 1д10 урона огнём.',
      cloud: 'Облачный удар — дополнительно 1д4 урона звуком; спасбросок Мудрости или вы становитесь невидимым для цели.',
      storm: 'Штормовой удар — дополнительно 1д6 урона электричеством; спасбросок Телосложения или цель совершает атаки с Помехой.'
    };
    const strixhavenCollegeDetails = {
      lorehold: {
        name: 'Лорхолд',
        cantrips: 'Выберите два: Свет, Священное пламя и Чудотворство',
        level1: 'Выберите заклинание 1-го уровня из списка заклинаний жреца или волшебника'
      },
      prismari: {
        name: 'Призмари',
        cantrips: 'Выберите два: Огненный снаряд, Фокусы и Луч холода',
        level1: 'Выберите заклинание 1-го уровня из списка заклинаний барда или чародея'
      },
      quandrix: {
        name: 'Квандрикс',
        cantrips: 'Выберите два: Искусство друидов, Наставление и Волшебная рука',
        level1: 'Выберите заклинание 1-го уровня из списка заклинаний друида или волшебника'
      },
      silverquill: {
        name: 'Сильверквилл',
        cantrips: 'Выберите два: Священное пламя, Чудотворство и Злая насмешка',
        level1: 'Выберите заклинание 1-го уровня из списка заклинаний барда или жреца'
      },
      witherbloom: {
        name: 'Визерблум',
        cantrips: 'Выберите два: Леденящее прикосновение, Искусство друидов и Уход за умирающим',
        level1: 'Выберите заклинание 1-го уровня из списка заклинаний друида или волшебника'
      }
    };
    const strixhavenCollege = (() => {
      const identity = `${background?.id || ''} ${backgroundName}`.toLocaleLowerCase('ru');
      if (/lorehold|лорхолд/.test(identity)) return strixhavenCollegeDetails.lorehold;
      if (/prismari|призмари/.test(identity)) return strixhavenCollegeDetails.prismari;
      if (/quandrix|квандрикс/.test(identity)) return strixhavenCollegeDetails.quandrix;
      if (/silverquill|сильверквилл/.test(identity)) return strixhavenCollegeDetails.silverquill;
      if (/witherbloom|визерблум/.test(identity)) return strixhavenCollegeDetails.witherbloom;
      return null;
    })();
    const originFeatDisplayName = (entry) => {
      const feat = entry?.feat;
      if (!feat) return '';
      if (feat.id !== 'magic-initiate') return feat.name;
      const listId = state.choices[`feat:${entry.source}:magic-list`]?.[0] || '';
      const ability = state.choices[`feat:${entry.source}:spell-ability`]?.[0] || '';
      const details = [magicInitiateClassNames[listId] || listId, ability].filter(Boolean);
      return details.length ? `${feat.name} (${details.join(', ')})` : feat.name;
    };
    const featName = originFeatEntries.map(originFeatDisplayName).filter(Boolean).join(', ');
    const speciesTraits = effectiveSpeciesAbilities
      .map((item) => [item?.title, item?.description].filter(Boolean).join(': '))
      .filter(Boolean);

    const abilityAcAttribute = {
      strength: '@{strength_mod}',
      dexterity: '@{dexterity_mod}',
      constitution: '@{constitution_mod}',
      intelligence: '@{intelligence_mod}',
      wisdom: '@{wisdom_mod}',
      charisma: '@{charisma_mod}'
    };
    const abilityAcPart = {
      strength: 'Strength',
      dexterity: 'Dexterity',
      constitution: 'Constitution',
      intelligence: 'Intelligence',
      wisdom: 'Wisdom',
      charisma: 'Charisma'
    };

    function buildUnarmoredAcCandidates() {
      const candidates = [];
      const addCandidate = (base, abilities, allowsShield, source, priority = 0) => {
        const abilityList = [...new Set(abilities.filter(Boolean))].slice(0, 2);
        const value = Number(base) + abilityList.reduce(
          (total, ability) => total + modifier(totalScore(ability)),
          0
        );
        candidates.push({
          base: Number(base),
          abilities: abilityList,
          allowsShield: Boolean(allowsShield),
          source,
          priority: Number(priority) || 0,
          value
        });
      };

      const classIdentity = [
        characterClass?.id,
        characterClass?.name,
        characterClass?.nameEn,
        state.class,
        className,
        roll20ClassName
      ].filter(Boolean).join(' ').toLocaleLowerCase('ru');
      if (/\bbarbarian\b|(?:^|\s)варвар(?:$|\s)/i.test(classIdentity)) {
        addCandidate(10, ['dexterity', 'constitution'], true, 'Защита без доспехов варвара', 10);
      } else if (/\bmonk\b|(?:^|\s)монах(?:$|\s)/i.test(classIdentity)) {
        addCandidate(10, ['dexterity', 'wisdom'], false, 'Защита без доспехов монаха', 10);
      }

      // Панцирь тортла всегда задаёт самостоятельную формулу КД:
      // 17 + None + None, при этом бонус щита разрешён. Не полагаемся
      // только на текст особенности, чтобы изменение описания вида не
      // возвращало ошибочную формулу варвара/монаха при экспорте.
      if (/(?:^|\s)(?:tortle|тортл)(?:\s|$)/i.test(speciesIdentity)) {
        addCandidate(17, [], true, 'Природный доспех тортла', 20);
      }

      effectiveSpeciesAbilities.forEach((feature) => {
        const name = String(feature?.title || feature?.name || '');
        const description = htmlToRoll20Text(feature?.description || '');
        // Названия отличаются от вида к виду: «Природный доспех»,
        // «Панцирь-хамелеон», «Усиленный каркас» и т. п. Определяем
        // защиту по формуле КД в описании, а не по ограниченному списку имён.
        if (!/(?:КД|Класс\s+Доспеха)/i.test(description)) return;

        const baseMatch = description.match(
          /(?:базов(?:ый|ого)\s+)?(?:КД|Класс\s+Доспеха)\s*[,—:-]?\s*(?:(?:равен|равно|равный|составляет)\s*)?(1[0-9])/i
        );
        const base = Number(baseMatch?.[1] || 0);
        if (!base) return;

        const abilities = [];
        if (/модификатор(?:ы|а)?\s+Ловкост/i.test(description)) abilities.push('dexterity');
        if (/модификатор(?:ы|а)?\s+Телосложен/i.test(description)) abilities.push('constitution');
        if (/модификатор(?:ы|а)?\s+Мудрост/i.test(description)) abilities.push('wisdom');
        if (/Ловкости\s+не\s+влияет/i.test(description)) {
          const dexterityIndex = abilities.indexOf('dexterity');
          if (dexterityIndex >= 0) abilities.splice(dexterityIndex, 1);
        }
        addCandidate(base, abilities, /щит/i.test(description), name);
      });

      return candidates.sort((left, right) =>
        (right.value - left.value)
        || (right.priority - left.priority)
        || (Number(right.allowsShield) - Number(left.allowsShield))
      );
    }

    const standardUnarmoredAc = 10 + modifier(totalScore('dexterity'));
    const bestSpecialAc = buildUnarmoredAcCandidates()[0] || null;
    // Особые формулы КД не складываются. При равном текущем результате
    // сохраняем классовую/видовую формулу: иначе, например, монах с Мудростью
    // 10 экспортируется как обычные 10 + Ловкость и КД больше не растёт после
    // последующего повышения Мудрости на листе Roll20.
    const unarmoredAc = bestSpecialAc?.value >= standardUnarmoredAc
      ? bestSpecialAc
      : null;

    function createRoll20Id() {
      // В repeating-секциях Roll20 символ "_" отделяет ID строки от имени поля.
      const alphabet = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
      let id = '-';
      for (let index = 0; index < 19; index += 1) {
        id += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      return id;
    }

    function upsert(name, current, max = '') {
      const normalized = current ?? '';
      const existing = payload.character.attribs.find((item) => item.name === name);
      if (existing) {
        existing.current = normalized;
        existing.max = max;
        if (!existing.id) existing.id = createRoll20Id();
      } else {
        payload.character.attribs.push({
          name,
          current: normalized,
          max,
          id: createRoll20Id()
        });
      }
    }


    function addRepeatingRow(section, fields) {
      const rowId = createRoll20Id();
      Object.entries(fields).forEach(([field, current]) => {
        payload.character.attribs.push({
          name: `repeating_${section}_${rowId}_${field}`,
          current: current ?? '',
          max: '',
          id: createRoll20Id()
        });
      });
      return rowId;
    }

    function htmlToRoll20Text(value) {
      const html = String(value ?? '');
      if (!html) return '';

      const container = document.createElement('div');
      container.innerHTML = html;

      // Roll20 не отображает HTML-таблицы внутри описаний черт. Превращаем
      // таблицу в вертикальные пары «Название поля / значение». Такой формат
      // остаётся читаемым даже в узкой колонке листа Roll20.
      container.querySelectorAll('table').forEach((table) => {
        const rows = [...table.querySelectorAll('tr')]
          .map((row) => [...row.querySelectorAll('th, td')]
            .map((cell) => String(cell.textContent || '').replace(/\s+/g, ' ').trim()))
          .filter((cells) => cells.some(Boolean));

        if (!rows.length) {
          table.remove();
          return;
        }

        const headers = rows[0];
        const bodyRows = rows.slice(1);
        const blocks = [];

        if (bodyRows.length && headers.length > 1) {
          bodyRows.forEach((cells) => {
            const pairs = [];
            headers.forEach((header, index) => {
              const value = cells[index] || '';
              if (!header && !value) return;

              if (index === 0) {
                // Первая колонка выглядит компактно: «Наследие Левистус».
                pairs.push([header, value].filter(Boolean).join(' '));
              } else {
                if (header) pairs.push(header);
                if (value) pairs.push(value);
              }
            });
            if (pairs.length) blocks.push(pairs.join('\n'));
          });
        } else {
          rows.forEach((cells) => {
            const values = cells.filter(Boolean);
            if (values.length) blocks.push(values.join('\n'));
          });
        }

        table.replaceWith(document.createTextNode(`\n${blocks.join('\n\n')}\n`));
      });

      container.querySelectorAll('br').forEach((br) => br.replaceWith(document.createTextNode('\n')));
      container.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6').forEach((node) => {
        node.append(document.createTextNode('\n'));
      });

      return String(container.textContent || '')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
    }

    function stripHtml(value) {
      return htmlToRoll20Text(value).replace(/\s+/g, ' ').trim();
    }

    function abilityKeyFromRussian(value) {
      const map = {
        'Сила': 'strength', 'Ловкость': 'dexterity', 'Телосложение': 'constitution',
        'Интеллект': 'intelligence', 'Мудрость': 'wisdom', 'Харизма': 'charisma'
      };
      return map[String(value ?? '').trim()] || '';
    }

    const pendingTraits = [];

    function traitGroup(source, sourceType) {
      const normalizedSource = String(source || '').toLocaleLowerCase('ru');
      const normalizedType = String(sourceType || '').toLocaleLowerCase('ru');
      const normalizedClassName = String(className || '').toLocaleLowerCase('ru');

      if (normalizedSource === 'раса') return 'species';
      if (
        normalizedSource === 'класс'
        || normalizedSource.includes('умение класса')
        || (normalizedClassName && normalizedType.includes(normalizedClassName))
      ) return 'class';
      if (normalizedSource === 'предыстория') return 'background';
      if (normalizedSource === 'черта' || normalizedSource.includes('черта')) return 'feat';
      return 'other';
    }

    function addTrait(name, description, source, sourceType) {
      if (!name) return;
      pendingTraits.push({
        name: String(name),
        source: String(source || ''),
        sourceType: String(sourceType || ''),
        description: htmlToRoll20Text(description || ''),
        group: traitGroup(source, sourceType)
      });
    }

    function writeTraits() {
      const groups = [
        { id: 'species', divider: '═════⊹⊱≼Раса≽⊰⊹═════' },
        { id: 'class', divider: '════⊹⊱≼Класс≽⊰⊹═════' },
        { id: 'background', divider: '═══⊹⊱≼Предыстория≽⊰⊹═══' },
        { id: 'feat', divider: '════⊹⊱≼Черты≽⊰⊹════' },
        { id: 'other', divider: '═══⊹⊱≼Прочее≽⊰⊹════' }
      ];
      const rowOrder = [];

      groups.forEach((group) => {
        const traits = pendingTraits.filter((trait) => trait.group === group.id);
        if (!traits.length) return;

        rowOrder.push(addRepeatingRow('traits', {
          name: group.divider,
          'options-flag': '0'
        }));

        traits.forEach((trait) => {
          rowOrder.push(addRepeatingRow('traits', {
            name: trait.name,
            source: trait.source,
            source_type: trait.sourceType,
            description: trait.description,
            'options-flag': '0',
            display_flag: 'on'
          }));
        });
      });

      if (rowOrder.length) {
        upsert('_reporder_repeating_traits', rowOrder.join(','));
      }
    }

    function addProficiency(type, name) {
      if (!name) return;
      addRepeatingRow('proficiencies', {
        prof_type: type,
        name,
        'options-flag': '0'
      });
    }

    function addTool(name) {
      if (!name) return;
      addRepeatingRow('tool', {
        toolname: name,
        toolattr: 'QUERY',
        toolbonus: '?{Attribute?|Strength,@{strength_mod}|Dexterity,@{dexterity_mod}|Constitution,@{constitution_mod}|Intelligence,@{intelligence_mod}|Wisdom,@{wisdom_mod}|Charisma,@{charisma_mod}}+0+@{pb}',
        toolbonus_display: '?',
        toolroll: '@{wtype}&{template:simple} {{rname=@{toolname}}} {{mod=@{toolbonus}}} {{r1=[[@{d20}+@{toolbonus}[Mods]@{pbd_safe}]]}} @{advantagetoggle}+@{toolbonus}[Mods]@{pbd_safe}]]}} {{global=@{global_skill_mod}}} @{charname_output}',
        toolattr_base: '?{Attribute?|Strength,@{strength_mod}|Dexterity,@{dexterity_mod}|Constitution,@{constitution_mod}|Intelligence,@{intelligence_mod}|Wisdom,@{wisdom_mod}|Charisma,@{charisma_mod}}',
        tool_mod: '0',
        'options-flag': '0'
      });
    }

    const restResources = [];
    const restResourceKeys = new Set();

    function resourceAbilityKey(value) {
      const normalized = String(value || '').toLocaleLowerCase('ru');
      const aliases = {
        strength: ['сила', 'силы'],
        dexterity: ['ловкость', 'ловкости'],
        constitution: ['телосложение', 'телосложения'],
        intelligence: ['интеллект', 'интеллекта'],
        wisdom: ['мудрость', 'мудрости'],
        charisma: ['харизма', 'харизмы']
      };
      return Object.entries(aliases).find(([, names]) =>
        names.some((name) => normalized.includes(name))
      )?.[0] || '';
    }

    function inferRestResourceMaximum(description) {
      const text = String(description || '');
      if (
        /(?:количеств[оа]\s+(?:раз|очк(?:ов|а))|числ[оа]\s+(?:использований|раз))[^.!?\n]{0,90}бонус(?:у|а|ом)?\s+мастерств/i.test(text)
        || /бонус(?:у|а|ом)?\s+мастерств[^.!?\n]{0,90}(?:количеств[оа]\s+раз|числ[оа]\s+использований)/i.test(text)
      ) return 2;

      const modifierMatch = text.match(
        /(?:количеств[оа]\s+раз|числ[оа]\s+использований)[^.!?\n]{0,90}модификатор(?:у|а|ом)?\s+(Силы|Ловкости|Телосложения|Интеллекта|Мудрости|Харизмы)/i
      );
      if (modifierMatch) {
        const key = resourceAbilityKey(modifierMatch[1]);
        if (key) return Math.max(1, modifier(totalScore(key)));
      }

      const numericMatch = text.match(
        /(?:можете\s+использовать|использовать\s+(?:эту|это)|можете\s+(?:наложить|сотворить))[^.!?\n]{0,90}?\b([1-9])\s*(?:раз|раза)\b/i
      );
      if (numericMatch) return Math.max(1, Number(numericMatch[1]));

      const wordMatch = text.match(
        /(?:можете\s+использовать|можете\s+(?:наложить|сотворить))[^.!?\n]{0,90}?\b(один|два|три|четыре)\s+раз/i
      );
      if (wordMatch) {
        return { один: 1, два: 2, три: 3, четыре: 4 }[wordMatch[1].toLocaleLowerCase('ru')] || 1;
      }

      const adverbMatch = text.match(
        /(?:можете\s+использовать|можете\s+(?:наложить|сотворить))[^.!?\n]{0,90}?\b(однажды|дважды|трижды|четырежды)\b/i
      );
      if (adverbMatch) {
        return { однажды: 1, дважды: 2, трижды: 3, четырежды: 4 }[adverbMatch[1].toLocaleLowerCase('ru')] || 1;
      }

      return 1;
    }

    function inferRestResourceName(fallbackName, description) {
      const text = String(description || '').trim();
      // У земного дженази расходуется ускоренное применение конкретного
      // заговора, поэтому в ресурсе нужно короткое название заклинания, а не
      // целое первое предложение «Вам известен заговор ...».
      const knownCantripMatch = text.match(/^(?:вам\s+известен|вы\s+знаете)\s+заговор\s+([^.!?\n]{2,60})[.!?]/i);
      if (knownCantripMatch) return knownCantripMatch[1].trim();

      const titledMatch = text.match(/^([^:.!?\n]{2,45})\.\s+/);
      if (titledMatch && !/^(?:вы|вам)\s/i.test(titledMatch[1])) return titledMatch[1].trim();

      const firstSentence = text.split(/[.!?]\s/)[0]?.trim() || '';
      const colonMatch = firstSentence.match(/^([^:\n]{2,45}):\s*/);
      if (colonMatch && !/^вы\s/i.test(colonMatch[1])) return colonMatch[1].trim();

      return String(fallbackName || 'Ресурс').trim();
    }

    function collectRestResource(name, description, source, maximumOverride = null) {
      const text = htmlToRoll20Text(description || '');
      if (!text) return;

      const restoresOnRest =
        /(?:коротк|продолжительн)[а-яё]*\s+отдых/i.test(text)
        || /отдых[а-яё]*[^.!?\n]{0,35}(?:коротк|продолжительн)/i.test(text);
      if (!restoresOnRest) return;

      // Не превращаем в счётчики постоянные эффекты и выборы, которые просто
      // меняются после отдыха. Нужен явный расход применения, заряда или кости.
      const spendsUses =
        /количеств[оа]\s+раз/i.test(text)
        || /числ[оа]\s+(?:использований|раз)/i.test(text)
        || /очк(?:о|а|ов)\s+[^.!?\n]{0,35}(?:равн|трат|потрачен)/i.test(text)
        || /кост(?:ь|и|ей)\s+[^.!?\n]{0,45}(?:трат|израсход|восстанавлив)/i.test(text)
        || /не\s+можете\s+(?:использовать|сделать|применить|наложить|сотворить)[^.!?\n]{0,100}(?:снова|вновь|повторно)/i.test(text)
        || /прежде\s+чем\s+сможете\s+(?:вновь|снова)/i.test(text)
        || /необходимо\s+закончить[^.!?\n]{0,70}отдых[^.!?\n]{0,70}(?:вновь|снова)/i.test(text)
        || /можете\s+(?:использовать|наложить|сотворить)[^.!?\n]{0,90}\b(?:1|один)\s+раз\b/i.test(text)
        || /можете\s+(?:использовать|наложить|сотворить)[^.!?\n]{0,90}\b(?:однажды|дважды|трижды|четырежды)\b/i.test(text)
        || /использовав\s+(?:это|эту)\s+(?:умение|особенность|способность|черту)/i.test(text);
      if (!spendsUses && maximumOverride == null) return;

      // Если расходуемая часть явно открывается только позднее первого уровня,
      // она пока не должна появляться в листе персонажа первого уровня.
      const limitedUseIndex = text.search(
        /количеств[оа]\s+раз|числ[оа]\s+(?:использований|раз)|не\s+можете\s+(?:использовать|сделать|применить|наложить|сотворить)|прежде\s+чем\s+сможете/i
      );
      const levelGate = text.match(/начиная\s+с\s+([2-9]|1\d|20)[-\s]?(?:го|го)?\s*уров/i);
      if (levelGate && limitedUseIndex >= 0 && levelGate.index < limitedUseIndex) return;

      const resourceName = inferRestResourceName(name, text);
      const key = resourceName.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
      if (!key || restResourceKeys.has(key)) return;
      restResourceKeys.add(key);
      restResources.push({
        name: resourceName,
        maximum: String(maximumOverride ?? inferRestResourceMaximum(text)),
        source: String(source || ''),
        // Если описание упоминает оба отдыха (например, Ярость), в меню
        // Roll20 выбираем полный сброс после продолжительного отдыха.
        reset: /продолжительн[а-яё]*\s+отдых/i.test(text) ? 'long' : 'short'
      });
    }

    function writeRestResources() {
      const resources = restResources.slice();
      if (!resources.length) return;

      const first = resources.shift();
      upsert('class_resource_name', first.name);
      upsert('class_resource', first.maximum, first.maximum);
      upsert('options-flag-resource', 'on');
      upsert('class_resource_reset', first.reset);

      const second = resources.shift();
      if (second) {
        upsert('other_resource_name', second.name);
        upsert('other_resource', second.maximum, second.maximum);
        upsert('options-flag-resource2', 'on');
        upsert('other_resource_reset', second.reset);
      }

      while (resources.length) {
        const rowId = createRoll20Id();
        ['left', 'right'].forEach((side) => {
          const resource = resources.shift();
          if (!resource) return;
          payload.character.attribs.push(
            {
              name: `repeating_resource_${rowId}_resource_${side}_name`,
              current: resource.name,
              max: '',
              id: createRoll20Id()
            },
            {
              name: `repeating_resource_${rowId}_resource_${side}`,
              current: resource.maximum,
              max: resource.maximum,
              id: createRoll20Id()
            },
            {
              name: `repeating_resource_${rowId}_options-flag-${side}`,
              current: 'on',
              max: '',
              id: createRoll20Id()
            },
            {
              name: `repeating_resource_${rowId}_resource_${side}_reset`,
              current: resource.reset,
              max: '',
              id: createRoll20Id()
            }
          );
        });
      }
    }

    // Каждая выбранная предыстория даёт персонажу 50 зм.
    // Остальные деньги из снаряжения прибавляются ниже.
    const currencyTotals = {
      cp: 0,
      sp: 0,
      ep: 0,
      gp: background ? 50 : 0,
      pp: 0
    };

    // Комплекты снаряжения раскрываются в отдельные предметы Roll20.
    // Само название комплекта в инвентарь не добавляется.
    const EQUIPMENT_PACKS = EQUIPMENT_PACK_CONTENTS;

    function normalizeEquipmentPackName(value) {
      return String(value ?? '')
        .toLocaleLowerCase('ru')
        .replace(/ё/g, 'е')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[()«»"']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function getEquipmentPackItems(value) {
      const normalized = normalizeEquipmentPackName(value)
        .replace(/\s*↗\s*$/g, '')
        .trim();

      if (EQUIPMENT_PACKS[normalized]) return EQUIPMENT_PACKS[normalized];

      const matchedKey = Object.keys(EQUIPMENT_PACKS).find((key) =>
        normalized === key
        || normalized.startsWith(`${key} `)
        || normalized.includes(key)
      );

      return matchedKey ? EQUIPMENT_PACKS[matchedKey] : null;
    }

    function findShopItemByDisplayName(value) {
      const normalized = normalizeEquipmentName(value)
        .replace(/^\d+\s+/, '')
        .trim();

      return equipmentShopItems.find((candidate) => {
        const candidateNames = [
          candidate.name,
          candidate.nameEn
        ].map(normalizeEquipmentName);

        return candidateNames.includes(normalized)
          || candidateNames.some((name) =>
            name
            && normalized
            && (name.includes(normalized) || normalized.includes(name))
          );
      }) || null;
    }

    function parsePackPart(value) {
      const text = stripHtml(value);
      const countMatch = text.match(/^(\d+)\s+(.+)$/);
      return {
        count: countMatch ? Math.max(1, Number(countMatch[1])) : 1,
        name: countMatch ? countMatch[2] : text
      };
    }

    function addInventoryItem(rawItem, multiplier = 1) {
      const text = stripHtml(rawItem);
      if (!text) return;

      const packItems = getEquipmentPackItems(text);
      if (Array.isArray(packItems)) {
        packItems.forEach((part) => {
          const parsed = parsePackPart(part);
          addInventoryItem(parsed.name, parsed.count * Math.max(1, Number(multiplier) || 1));
        });
        return;
      }

      // Деньги Roll20 хранит в отдельных полях, а не в инвентаре.
      const currencyMatch = text.match(/^(\d+)\s*(мм|см|эм|зм|пм|cp|sp|ep|gp|pp)$/i);
      if (currencyMatch) {
        const currencyMap = {
          'мм': 'cp', 'см': 'sp', 'эм': 'ep', 'зм': 'gp', 'пм': 'pp',
          'cp': 'cp', 'sp': 'sp', 'ep': 'ep', 'gp': 'gp', 'pp': 'pp'
        };
        const key = currencyMap[currencyMatch[2].toLowerCase()];
        currencyTotals[key] += Number(currencyMatch[1]) * Math.max(1, Number(multiplier) || 1);
        return;
      }

      const parsed = parsePackPart(text);
      const count = parsed.count * Math.max(1, Number(multiplier) || 1);
      const shopItem = findShopItemByDisplayName(parsed.name);

      addRepeatingRow('inventory', {
        itemname: shopItem?.name || parsed.name,
        itemcount: String(count),
        itemweight: String(shopItem?.weight || 0),
        equipped: '1',
        inventorysubflag: '0',
        hasattack: '0',
        itemattackid: ''
      });
    }

    upsert('character_name', payload.character.name);
    upsert('class', roll20ClassName);
    upsert('class_display', `${usesCustomClass ? className : roll20ClassName} 1`);
    upsert('base_level', '1');
    upsert('level', '1');

    // В актуальном листе D&D 5E by Roll20 встроенный Ranger использует иную
    // конфигурацию. Через «Использовать кастомный класс» первый уровень
    // следопыта корректно получает d10, спасброски Силы/Ловкости,
    // половинную прогрессию заклинаний и Мудрость.
    if (isRangerClass) {
      upsert('custom_class', '1');
      upsert('cust_classname', className || 'Следопыт');
      upsert('cust_hitdietype', '10');
      upsert('cust_strength_save_prof', '(@{pb})');
      upsert('cust_dexterity_save_prof', '(@{pb})');
      upsert('cust_wisdom_save_prof', '0');
      upsert('cust_spellslots', 'half');
      upsert('cust_spellcasting_ability', '@{wisdom_mod}+');
    }

    // В Roll20 нет встроенного Apothecary. Экспортируем его через те же поля
    // пользовательского класса: d8, спасброски Интеллекта/Мудрости и ручные
    // ячейки. Лист не предлагает pact-прогрессию для пользовательского класса,
    // поэтому точное число ячеек записывается ниже напрямую.
    if (isApothecaryClass) {
      upsert('custom_class', '1');
      upsert('cust_classname', className || 'Апотекарий');
      upsert('cust_hitdietype', '8');
      upsert('cust_strength_save_prof', '0');
      upsert('cust_dexterity_save_prof', '0');
      upsert('cust_constitution_save_prof', '0');
      upsert('cust_intelligence_save_prof', '(@{pb})');
      upsert('cust_wisdom_save_prof', '(@{pb})');
      upsert('cust_charisma_save_prof', '0');
      upsert('cust_spellslots', 'none');
      upsert('cust_spellcasting_ability', '@{intelligence_mod}+');
      // При ручной прогрессии кастомного класса Roll20 выводит в настройках
      // значения lvlN_slots_mod, а на листе использует lvlN_slots_total.
      // На 1-м уровне у Апотекария одна ячейка 1-го уровня.
      upsert('lvl1_slots_mod', '1');
      upsert('lvl1_slots_total', '1');
      upsert('lvl1_slots_expended', '0');
    }

    // Кровавого охотника нет среди встроенных классов листа Roll20.
    // Экспортируем его как пользовательский класс с костью хитов d10,
    // без ячеек заклинаний и с его классовыми спасбросками.
    if (isBloodHunterClass) {
      upsert('custom_class', '1');
      upsert('cust_classname', className || 'Кровавый охотник');
      upsert('cust_hitdietype', '10');
      upsert('cust_strength_save_prof', '0');
      upsert('cust_dexterity_save_prof', '(@{pb})');
      upsert('cust_constitution_save_prof', '0');
      upsert('cust_intelligence_save_prof', '(@{pb})');
      upsert('cust_wisdom_save_prof', '0');
      upsert('cust_charisma_save_prof', '0');
      upsert('cust_spellslots', 'none');
      upsert('cust_spellcasting_ability', '@{intelligence_mod}+');
    }

    // Поддерживаем поля разных версий листа D&D 5E by Roll20.
    upsert('subclass', subclassName);
    upsert('subclass_display', subclassName);
    upsert('race', speciesName);
    upsert('creature_type', creatureType);
    upsert('type', creatureType);
    upsert('size', profileSize);
    upsert('character_size', profileSize);
    upsert('age', String(profile.age || '').trim());
    upsert('eyes', String(profile.eyes || '').trim());
    upsert('skin', String(profile.skin || '').trim());
    upsert('hair', String(profile.hair || '').trim());
    upsert('character_appearance', String(profile.appearance || '').trim());
    upsert('character_backstory', String(profile.backstory || '').trim());
    upsert('allies_and_organizations', alliesAndOrganizations);

    upsert('background', backgroundName);
    upsert('alignment', alignment);
    upsert('pb', '2');
    upsert('experience', '0');
    // В листе Roll20 значение "off" означает обычную нагрузку (Сила × 15),
    // а "disabled" полностью отключает её.
    upsert('encumberance_setting', 'off');
    // Современный лист Roll20 использует длинное имя, старые ревизии —
    // сокращённое. Оба атрибута безопасны и оставляют настройку включённой
    // после импорта в соответствующую версию листа.
    upsert('ignore_non_equipped_items_weight', '1');
    upsert('ignore_non_equipped_weight', '1');
    // В актуальной русской версии листа Roll20 имя этого атрибута содержит
    // историческую опечатку `ingore`. Без неё галочка визуально остаётся
    // выключенной, даже если два корректно написанных варианта уже заданы.
    upsert('ingore_non_equipped_weight', '1');
    if (hasPowerfulBuild) {
      // Roll20 использует этот флаг для удвоенной грузоподъёмности. Проверка
      // выше учитывает разные названия одной механики, включая кентаврское
      // «Лошадиное телосложение».
      upsert('powerful_build', '1');
      upsert('powerful_build_flag', '1');
    }
    if (hasHalflingLuck) {
      // Одного флага недостаточно при JSON-импорте: обработчик листа может не
      // запуститься. Поэтому сразу сохраняем и рассчитанное выражение d20.
      upsert('halflingluck_flag', '1');
      upsert('core_die', '1d20');
      upsert('d20', '1d20ro<1');
    }
    upsert('hp', String(maxHp), String(maxHp));
    upsert('hit_dice', '1', '1');
    upsert('hitdietype', String(hitDieSize));
    upsert('hitdieroll', String(hitDieSize));
    upsert('hitdie_final', '@{hitdietype}');
    const integratedProtectionBonus = hasIntegratedProtection ? 1 : 0;
    const exportedAc = (unarmoredAc?.value ?? (10 + modifier(totalScore('dexterity'))))
      + integratedProtectionBonus;
    // В пустом шаблоне Roll20 этот флаг отсутствует, поэтому после импорта
    // блок «Общий модификатор КД» может быть скрыт. Он нужен независимо от
    // выбранной формулы КД: для временных эффектов, заклинаний и предметов.
    upsert('global_ac_mod_flag', '1');
    upsert('ac', String(exportedAc));
    if (hasIntegratedProtection) {
      // Встроенная защита кованого — постоянный общий модификатор КД, а не
      // отдельная формула доспеха. Так бонус +1 совместим и с обычной бронёй,
      // и с Защитой без доспехов, и с другими вариантами расчёта КД.
      addRepeatingRow('acmod', {
        global_ac_val: '1',
        global_ac_name: 'Встроенная защита',
        global_ac_active_flag: '1',
        'options-flag': 'on'
      });
    }
    if (unarmoredAc) {
      // Поля настройки «Кастомный КД» листа D&D 5E by Roll20. Итоговый `ac`
      // записывается отдельно, поэтому КД верен сразу после импорта, а эти
      // поля сохраняют формулу для последующих изменений характеристик.
      upsert('ac_style', 'custom');
      upsert('ac_base', String(unarmoredAc.base));
      upsert('ac_attr1', abilityAcAttribute[unarmoredAc.abilities[0]] || '0');
      upsert('ac_attr2', abilityAcAttribute[unarmoredAc.abilities[1]] || '0');
      upsert('ac_shield', unarmoredAc.allowsShield ? '@{shield_ac}' : '0');
      upsert('customacwarningflag', 'hide');
      upsert('custom_ac_source', unarmoredAc.source);
      // Это штатные поля интерфейса D&D 5E by Roll20. Без них итоговый `ac`
      // верен, но в настройках остаётся не выбран «Кастомный вариант».
      upsert('custom_ac_flag', '1');
      upsert('custom_ac_base', String(unarmoredAc.base));
      upsert('armorwarningflag', 'hide');
      upsert('custom_ac_part1', abilityAcPart[unarmoredAc.abilities[0]] || 'None');
      upsert('custom_ac_part2', abilityAcPart[unarmoredAc.abilities[1]] || 'None');
    }
    upsert('speed', speed);
    const hasHarengonInitiative = /harengon|зайцегон/i.test(
      `${species?.id || ''} ${species?.name || ''} ${species?.nameEn || ''}`
    );
    const hasAlertInitiative = hasOriginFeat('alert') || originFeatEntries.some((entry) =>
      /^(?:бдительный|alert)$/i.test(
        String(entry?.feat?.name || entry?.feat?.nameEn || entry?.name || '').trim()
      )
    );
    const initiativeProficiencyBonus = (hasAlertInitiative || hasHarengonInitiative) ? 2 : 0;
    const dexterityScore = totalScore('dexterity');
    // `initmod` управляет отдельным полем «Бонус к инициативе» в настройках
    // листа. `initiative_bonus` ниже — уже итоговое значение броска.
    upsert('initmod', String(initiativeProficiencyBonus));
    // В интерфейсе это отдельное поле «Бонус к инициативе», однако лист
    // Roll20 хранит его в составном формате: полный итог инициативы и после
    // точки значение Ловкости. Поэтому при Ловкости 16 (+3) и бонусе +2
    // записываем 5.16 — тогда в отдельном поле лист показывает именно 2.
    upsert(
      'initiative_bonus',
      modifier(dexterityScore) + initiativeProficiencyBonus + (dexterityScore / 100)
    );

    abilityKeys.forEach((key) => {
      const score = totalScore(key);
      upsert(`${key}_base`, score);
      upsert(key, score);
      upsert(`${key}_mod`, modifier(score));
      upsert(`${key}_save_prof`, '0');
      upsert(`${key}_save_bonus`, modifier(score));
    });

    const proficientSkillIds = new Set(
      skills.map((skillName) => ROLL20_SKILLS[skillName]).filter(Boolean)
    );

    Object.values(ROLL20_SKILLS).forEach((roll20Name) => {
      const abilityKey = ROLL20_SKILL_ABILITIES[roll20Name];
      if (!abilityKey) return;

      const localizedSkill = Object.entries(ROLL20_SKILLS).find(([, id]) => id === roll20Name)?.[0];
      const hasExpertise = Boolean(localizedSkill && expertiseSkills.has(localizedSkill));
      const isProficient = hasExpertise || proficientSkillIds.has(roll20Name);
      const abilityModifier = modifier(totalScore(abilityKey));
      const proficiencyBonus = hasExpertise ? 4 : (isProficient ? 2 : 0);
      const totalBonus = abilityModifier + proficiencyBonus;

      // `_type` — это множитель бонуса мастерства, а не флаг владения.
      // Даже у невладенного навыка он должен быть 1, чтобы Roll20 мог
      // позже включить владение обычной галочкой. Для компетентности нужен 2.
      upsert(`${roll20Name}_type`, hasExpertise ? '2' : '1');
      upsert(
        `${roll20Name}_prof`,
        isProficient ? `(@{pb}*@{${roll20Name}_type})` : '0'
      );
      upsert(`${roll20Name}_bonus`, String(totalBonus));
      upsert(
        `${roll20Name}_roll`,
        `@{wtype}&{template:simple} {{rname=^{${roll20Name.replaceAll('_', '-')}-u}}} {{mod=@{${roll20Name}_bonus}}} {{r1=[[@{d20}+@{${roll20Name}_bonus}[Mods]@{pbd_safe}]]}} @{advantagetoggle}+@{${roll20Name}_bonus}[Mods]@{pbd_safe}]]}} {{global=@{global_skill_mod}}} @{charname_output}`
      );
    });

    upsert(
      'passive_wisdom',
      String(10 + modifier(totalScore('wisdom')) + (expertiseSkills.has('Восприятие') ? 4 : (proficientSkillIds.has('perception') ? 2 : 0)))
    );



    const classProficiencies = characterClass?.proficiencies || {};
    const classSavingThrows = Array.isArray(classProficiencies.savingThrows)
      ? classProficiencies.savingThrows
      : [];
    classSavingThrows.forEach((saveName) => {
      const key = abilityKeyFromRussian(saveName);
      if (!key) return;
      upsert(`${key}_save_prof`, '(@{pb})');
      upsert(`${key}_save_bonus`, modifier(totalScore(key)) + 2);
    });

    const selectedClassOptions = getClassFeatureGroups().flatMap((group) => {
      const selected = state.choices[`classFeature:${group.id}`] || [];
      return group.options.filter((option) => selected.includes(option.id));
    });
    const selectedClassEffects = selectedClassOptions.flatMap((option) => option.effects || []);

    const hasDuelingFightingStyle = selectedClassOptions.some((option) =>
      option?.id === 'dueling'
      || /^дуэлянт$/i.test(String(option?.name || '').trim())
      || /^dueling$/i.test(String(option?.nameEn || '').trim())
    );

    const globalDamageModifiers = [];
    const addGlobalDamageModifier = ({ name, damage, type = '' }) => {
      if (!name || !damage) return;
      const existingNameAttribute = payload.character.attribs.find((attribute) =>
        /^repeating_damagemod_[^_]+_global_damage_name$/.test(String(attribute.name || ''))
        && String(attribute.current || '') === name
      );
      const unusedTemplateRow = payload.character.attribs.find((attribute) => {
        const match = String(attribute.name || '').match(/^repeating_damagemod_([^_]+)_global_damage_active_flag$/);
        if (!match) return false;
        return !payload.character.attribs.some((candidate) =>
          candidate.name === `repeating_damagemod_${match[1]}_global_damage_name`
          && String(candidate.current || '').trim()
        );
      });
      const rowId = existingNameAttribute?.name.match(/^repeating_damagemod_([^_]+)_/)?.[1]
        || unusedTemplateRow?.name.match(/^repeating_damagemod_([^_]+)_/)?.[1]
        || createRoll20Id();
      const rowPrefix = `repeating_damagemod_${rowId}_`;

      upsert('global_damage_mod_flag', '1');
      upsert(`${rowPrefix}options-flag`, 'on');
      upsert(`${rowPrefix}global_damage_active_flag`, '1');
      upsert(`${rowPrefix}global_damage_name`, name);
      upsert(`${rowPrefix}global_damage_damage`, damage);
      upsert(`${rowPrefix}global_damage_crit`, '');
      upsert(`${rowPrefix}global_damage_type`, type);
      globalDamageModifiers.push({ name, damage, type });
    };

    if (hasDuelingFightingStyle) {
      // «Дуэлянт» добавляет только +2 к обычному урону подходящего оружия.
      addGlobalDamageModifier({
        name: 'Дуэлянт если рукопашное оружие в 1 руке и не держите других оружий',
        damage: '2'
      });
    }

    const damageModifierClassId = String(characterClass?.id || '').toLocaleLowerCase('ru');
    const damageModifierLevelOne = Array.isArray(characterClass?.levels)
      ? characterClass.levels.find((level) => Number(level?.level) === 1)
      : null;

    if (damageModifierClassId === 'barbarian') {
      addGlobalDamageModifier({
        name: 'Ярость',
        damage: String(damageModifierLevelOne?.rageDamage || '2').replace(/^\+/, '')
      });
    }

    if (damageModifierClassId === 'rogue') {
      addGlobalDamageModifier({
        name: 'Скрытая атака',
        damage: String(damageModifierLevelOne?.sneakAttack || '1d6').replace(/д/gi, 'd'),
        type: 'Sneak'
      });
    }

    if (globalDamageModifiers.length) {
      // Эти сводные поля обычно обновляет worker листа Roll20. Заполняем их
      // заранее, чтобы строки работали сразу после JSON-импорта.
      upsert(
        'global_damage_mod_roll',
        globalDamageModifiers.map((modifier) => `[[${modifier.damage}[${modifier.name}]]]`).join(' ')
      );
      upsert('global_damage_mod_crit', '');
      upsert(
        'global_damage_mod_type',
        globalDamageModifiers.map((modifier) => modifier.type).filter(Boolean).join(', ')
      );
    }
    const grantedArmor = selectedClassEffects.filter((effect) => effect.type === 'armorTraining').flatMap((effect) => effect.categories || []);
    const grantedWeapons = selectedClassEffects.filter((effect) => effect.type === 'weaponProficiency').flatMap((effect) => effect.categories || []);
    const armorProficiencies = [...new Set([...(Array.isArray(classProficiencies.armor) ? classProficiencies.armor : []), ...grantedArmor])];
    const weaponProficiencies = [...new Set([...(Array.isArray(classProficiencies.weapons) ? classProficiencies.weapons : []), ...grantedWeapons])];
    const classTools = Array.isArray(classProficiencies.tools) ? classProficiencies.tools : [];
    // В массиве класса могут быть не конкретные владения, а инструкции выбора
    // вроде «3 музыкальных инструмента». Такие строки не экспортируем отдельным инструментом:
    // выбранные пользователем инструменты уже находятся в `tools`.
    const fixedClassTools = classTools.filter((toolName) => creatorOptions.allTools.includes(String(toolName).trim()));
    upsert('other_armor', armorProficiencies.join(', '));
    upsert('other_weapon', weaponProficiencies.join(', '));
    addProficiency('ДОСПЕХИ', armorProficiencies.join(', '));
    addProficiency('ОРУЖИЕ', weaponProficiencies.join(', '));

    [...new Set([...fixedClassTools, ...tools])].forEach(addTool);
    // В Roll20 языки должны отображаться одной строкой, а не отдельной
    // repeating-карточкой для каждого языка.
    addProficiency('ЯЗЫК', [...new Set(languages)].join(', '));

    const level1Features = Array.isArray(characterClass?.level1Features)
      ? characterClass.level1Features
      : (Array.isArray(characterClass?.features)
          ? characterClass.features.filter((feature) => Number(feature?.level ?? 0) === 1)
          : []);
    const firstClassLevel = Array.isArray(characterClass?.levels)
      ? characterClass.levels.find((level) => Number(level?.level) === 1)
      : null;
    const classResourceMaximum = (featureName) => {
      const normalizedName = String(featureName || '').toLocaleLowerCase('ru').replace(/ё/g, 'е');
      const classId = String(characterClass?.id || '').toLocaleLowerCase('ru');
      if (classId === 'fighter' && normalizedName.includes('второе дыхание')) {
        return Number(firstClassLevel?.secondWind || 2);
      }
      if (classId === 'barbarian' && normalizedName === 'ярость') {
        return Number(firstClassLevel?.rage || 2);
      }
      if (classId === 'ranger' && normalizedName.includes('избранный враг')) {
        return Number(firstClassLevel?.favoredEnemy || 2);
      }
      return null;
    };
    level1Features.forEach((feature) => {
      const featureName = feature?.name || 'Особенность класса';
      const featureDescription = feature?.description || '';
      if (/^Божественный порядок$/i.test(featureName) && selectedClassFeatureOption('divine-order')) {
        return;
      }
      addTrait(featureName, featureDescription, 'Класс', `${className} 1 уровень`);
      collectRestResource(
        featureName,
        featureDescription,
        `${className} 1 уровень`,
        classResourceMaximum(featureName)
      );
    });

    function selectedSpellNamesForSource(sourceId, level) {
      const source = typeof getSpellSources === 'function'
        ? getSpellSources().find((item) => item.id === sourceId)
        : null;
      if (!source) return [];

      const selected = state.spells?.sources?.[sourceId] || { cantrip: [], level1: [] };
      const bucket = level === 'cantrip' ? 'cantrip' : 'level1';
      const selectedIds = new Set(selected[bucket] || []);
      return (source.options || [])
        .filter((spell) => spell.level === level && selectedIds.has(spell.id))
        .map((spell) => spell.name)
        .filter(Boolean);
    }

    function classFeatureDescription(group, option) {
      let baseDescription = option?.exportDescription || option?.description || '';
      const isPactOfTheTome = group?.id === 'eldritch-invocation'
        && (option?.id === 'pact-of-the-tome' || /Договор гримуара/i.test(String(option?.name || '')));
      if (!isPactOfTheTome) return baseDescription;

      // В некоторых наборах данных у выбранного воззвания хранится только
      // название. Не допускаем, чтобы в Roll20 осталось одно перечисление
      // выбранных заклинаний без полного текста особенности.
      if (!String(baseDescription).trim()) {
        baseDescription = [
          'Договор гримуара',
          '',
          'Переплетая теневые нити между собой, в конце Короткого или Продолжительного отдыха вы создаёте в своей руке книгу. Эта книга теней (её внешний вид определяете вы) содержит тайную магию, доступную только вам, и позволяет вам получить перечисленные ниже эффекты. Книга исчезает, если вы создаёте новую книгу при помощи этого умения или если вы умираете.',
          '',
          'Заговоры и ритуалы. Когда книга появится, то выберите 3 заговора и 2 заклинания 1 уровня с меткой «ритуал». Заклинания могут быть из списка заклинаний любого класса, и это должны быть заклинания, которые у вас ещё не подготовлены. Пока книга находится рядом с вами, то выбранные заклинания считаются подготовленными и действуют как заклинания колдуна.',
          '',
          'Заклинательная фокусировка. Вы можете использовать книгу в качестве заклинательной фокусировки.'
        ].join('\n');
      }

      const cantrips = selectedSpellNamesForSource('class-feature-pact-tome', 'cantrip');
      const level1 = selectedSpellNamesForSource('class-feature-pact-tome', '1');
      const selection = [
        'Выбрано:',
        '',
        'Заговоры:',
        ...(cantrips.length ? cantrips : ['—']),
        '',
        'Заклинания 1 уровня:',
        ...(level1.length ? level1 : ['—'])
      ].join('\n');

      return [baseDescription, selection].filter(Boolean).join('\n\n');
    }

    getClassFeatureGroups().forEach((group) => {
      const selectedIds = state.choices[`classFeature:${group.id}`] || [];

      selectedIds.forEach((selectedId) => {
        const option = group.options.find((item) => item.id === selectedId);
        if (!option) return;
        const optionDescription = classFeatureDescription(group, option);

        if (group.id === 'weapon-mastery') {
          const masteryName = option.detail || 'Оружейный приём';
          const description = WEAPON_MASTERY_DESCRIPTIONS[option.masteryId] || '';
          addTrait(
            `${masteryName} (${option.name})`,
            description,
            'Класс',
            `${className} 1 уровень`
          );
          return;
        }

        if (group.id === 'fighting-style') {
          addTrait(
            option.name,
            optionDescription,
            'Черта боевого стиля',
            `${className} 1 уровень`
          );
          collectRestResource(option.name, optionDescription, `${className} 1 уровень`);
          return;
        }

        if (group.id === 'blood-curse') {
          addTrait(
            option.name,
            optionDescription,
            'Проклятие крови',
            `${className} 1 уровень`
          );
          collectRestResource(option.name, optionDescription, `${className} 1 уровень`);
          return;
        }

        addTrait(
          group.id === 'divine-order' ? `${group.name} (${option.name})` : option.name,
          optionDescription,
          group.id === 'divine-order' ? 'Класс' : (group.name || 'Умение класса'),
          `${className} 1 уровень`
        );
        collectRestResource(
          option.name,
          optionDescription,
          `${className} 1 уровень`
        );
      });
    });

    effectiveSpeciesAbilities.forEach((feature) => {
      const featureName = feature?.title || feature?.name || 'Особенность вида';
      const featureDescription = feature?.description || '';
      const normalizedFeatureName = String(featureName)
        .toLocaleLowerCase('ru')
        .replace(/ё/g, 'е')
        .trim();
      const isElfSpecies = /(?:^|\s|[-_])(?:elf|эльф)(?:$|\s|[-_])/.test(
        speciesIdentity.toLocaleLowerCase('ru').replace(/ё/g, 'е')
      );
      // Эта карточка нужна только в конструкторе для объяснения выбора
      // происхождения. В Roll20 выбранное происхождение экспортируется
      // отдельной полноценной чертой, поэтому общую инструкцию не дублируем.
      if (isElfSpecies && normalizedFeatureName === 'происхождения эльфов') return;
      addTrait(featureName, featureDescription, 'Раса', speciesName);
      collectRestResource(featureName, featureDescription, speciesName);
    });

    if (background?.feature) {
      addTrait(
        background.feature,
        background.featureDescription || '',
        'Предыстория',
        backgroundName
      );
    }

    originFeatEntries.forEach((originFeatEntry) => {
      const originFeat = originFeatEntry.feat;
      if (!originFeat) return;
      const fromSpecies = originFeatEntry.source === 'species';
      const source = fromSpecies ? speciesName : (backgroundName || 'Предыстория');
      const featEffects = Array.isArray(originFeat.effects) ? originFeat.effects : [];
      const exportedEffects = fromSpecies && originFeat.type === 'general'
        ? featEffects.filter((effect) => !/^\s*Повышение характеристики[.:]/i.test(String(effect)))
        : featEffects;
      // Для «Наследника внешних планов» выбранный вариант записывается выше
      // отдельными строками. Общая HTML-таблица всех пяти планов в Roll20
      // только дублирует выбор и сильно растягивает карточку черты.
      const hidesGeneralChoiceTable = originFeat.id === 'scion-of-the-outer-planes'
        || originFeat.id === 'strixhaven-initiate';
      const traitEffects = hidesGeneralChoiceTable
        ? exportedEffects.filter((effect) => !/<table\b/i.test(String(effect)))
        : exportedEffects;
      const traitName = originFeatDisplayName(originFeatEntry);
      const magicInitiateDetails = originFeat.id === 'magic-initiate'
        ? [
            `Список заклинаний: ${magicInitiateClassNames[state.choices[`feat:${originFeatEntry.source}:magic-list`]?.[0]] || 'не выбран'}.`,
            `Заклинательная характеристика: ${state.choices[`feat:${originFeatEntry.source}:spell-ability`]?.[0] || 'не выбрана'}.`
          ]
        : [];
      const selectedScionPlan = originFeat.id === 'scion-of-the-outer-planes'
        ? scionPlanDetails[state.choices[`feat:${originFeatEntry.source}:scion-plane`]?.[0]]
        : null;
      const scionDetails = selectedScionPlan
        ? [
            `Выбранный план: ${selectedScionPlan.name}.`,
            `Сопротивление урону: ${selectedScionPlan.resistance}.`,
            `Заговор: ${selectedScionPlan.cantrip}.`,
            `Заклинательная характеристика: ${state.choices[`feat:${originFeatEntry.source}:scion-spell-ability`]?.[0] || 'не выбрана'}.`
          ]
        : [];
      const giantStrike = originFeat.id === 'strike-of-the-giants'
        ? giantStrikeDetails[state.choices[`feat:${originFeatEntry.source}:giant-strike`]?.[0]]
        : '';
      const strixhavenCantrips = originFeat.id === 'strixhaven-initiate'
        ? selectedSpellNamesForSource('feat-strixhaven', 'cantrip')
        : [];
      const strixhavenLevel1 = originFeat.id === 'strixhaven-initiate'
        ? selectedSpellNamesForSource('feat-strixhaven', '1')
        : [];
      const strixhavenSelection = originFeat.id === 'strixhaven-initiate' && strixhavenCollege
        ? [
            `Факультет: ${strixhavenCollege.name}`,
            'Заговоры:',
            ...(strixhavenCantrips.length ? strixhavenCantrips : ['—']),
            'Заклинание 1-го уровня:',
            ...(strixhavenLevel1.length ? strixhavenLevel1 : ['—'])
          ].join('\n')
        : '';
      const selectedCollegeDescription = originFeat.id === 'strixhaven-initiate' && strixhavenCollege
        ? [
            `Заклинания Стриксхейвена ${strixhavenCollege.name}`,
            'Заговоры',
            strixhavenCollege.cantrips,
            'Заклинание 1-го уровня',
            strixhavenCollege.level1
          ].join('\n')
        : '';
      addTrait(
        traitName,
        [
          ...magicInitiateDetails,
          ...scionDetails,
          giantStrike ? `Выбранное преимущество: ${giantStrike}` : '',
          strixhavenSelection,
          ...traitEffects,
          selectedCollegeDescription
        ].filter(Boolean).join('\n\n'),
        'Черта',
        source
      );
      traitEffects.forEach((effect) => {
        collectRestResource(traitName, effect, source);
      });
    });

    // «Посвящённый в магию» даёт одно бесплатное применение выбранного
    // заклинания 1-го уровня за продолжительный отдых. Карточка заклинания
    // экспортируется ниже, а здесь создаём отдельный счётчик этого бесплатного
    // применения. Заговоры не расходуют применение и ресурсами не становятся.
    const spellSourcesForResources = typeof getSpellSources === 'function'
      ? getSpellSources()
      : [];
    const spellSourceById = new Map(
      spellSourcesForResources.map((spellSource) => [spellSource.id, spellSource])
    );

    originFeatEntries
      .filter((entry) => entry?.feat?.id === 'magic-initiate' || entry?.id === 'magic-initiate')
      .forEach((entry) => {
        const spellSource = spellSourceById.get(`feat-${entry.source}`);
        if (!spellSource) return;

        const selectedLevel1Ids = new Set(
          state.spells?.sources?.[spellSource.id]?.level1 || []
        );
        const availableSpells = [
          ...(spellSource.fixed || []),
          ...(spellSource.options || [])
        ];

        availableSpells
          .filter((spell) => spell?.level === '1' && selectedLevel1Ids.has(spell.id))
          .forEach((spell) => {
            collectRestResource(
              spell.name || spell.id,
              'Вы можете наложить это заклинание один раз без траты ячейки заклинаний. Вы восстанавливаете это использование после Продолжительного отдыха.',
              spellSource.spellLabel || spellSource.title || 'Черта: Посвящённый в магию',
              1
            );
          });
      });

    writeTraits();
    writeRestResources();

    // Экспортируем только фактический инвентарь конструктора.
    // Старый прямой экспорт первого набора класса удалён: он создавал дубли.
    currencyTotals.cp = Math.floor(Number(state.equipment.goldCopper || 0) % 10);
    currencyTotals.sp = Math.floor((Number(state.equipment.goldCopper || 0) % 100) / 10);
    currencyTotals.ep = 0;
    currencyTotals.gp = Math.floor(Number(state.equipment.goldCopper || 0) / 100);
    currencyTotals.pp = 0;

    for (const entry of state.equipment?.inventory || []) {
      const shopItem = equipmentShopItems.find((item) => item.id === entry.id);
      if (!shopItem) continue;

      const quantity = Math.max(1, Number(entry.quantity || 1));
      const packItems = getEquipmentPackItems(shopItem.name);

      if (Array.isArray(packItems)) {
        packItems.forEach((part) => {
          const parsed = parsePackPart(part);
          addInventoryItem(parsed.name, parsed.count * quantity);
        });
      } else {
        addRepeatingRow('inventory', {
          itemname: shopItem.name,
          itemcount: String(quantity),
          itemweight: String(shopItem.weight || 0),
          equipped: '1',
          inventorysubflag: '0',
          hasattack: '0',
          itemattackid: ''
        });
      }
    }

    Object.entries(currencyTotals).forEach(([currency, amount]) => {
      upsert(currency, String(amount));
    });

    upsert('other_languages', languages.join(', '));
    upsert('other_tool', tools.join(', '));
    upsert('race', baseSpeciesName);
    upsert('race_display', variantSpeciesName || baseSpeciesName);
    upsert('subrace', variantSpeciesName);
    upsert('creaturetype', creatureType);
    upsert('creature_type', creatureType);
    upsert('creature_type_display', creatureType);
    upsert('type', creatureType);
    upsert('size_display', creatureSize);
    // Поля биографии листа D&D 5e by Roll20.
    if (state.physique.heightInches) {
      upsert('height', `${Math.floor(state.physique.heightInches / 12)} фут. ${state.physique.heightInches % 12} дюйм.`);
    }
    if (state.physique.weightPounds) {
      upsert('weight', `${state.physique.weightPounds} фунтов`);
    }
    upsert('personality_traits', (state.choices['background:traits'] || state.personalityTraits || []).join ? (state.choices['background:traits'] || state.personalityTraits || []).join('\n\n') : String(state.personalityTraits || ''));
    upsert('ideals', state.choices['background:ideal']?.[0] || state.ideals || '');
    upsert('bonds', state.choices['background:bond']?.[0] || state.bonds || '');
    upsert('flaws', state.choices['background:flaw']?.[0] || state.flaws || '');
    upsert('other_other', [
      featName ? `Черта происхождения: ${featName}` : '',
      background?.lore ? `История предыстории:\n${htmlToRoll20Text(background.lore)}` : '',
      speciesTraits.length ? `Особенности вида:\n${speciesTraits.join('\n')}` : '',
      state.physique.heightInches ? `Рост: ${Math.floor(state.physique.heightInches / 12)} фт. ${state.physique.heightInches % 12} дюйм.` : '',
      state.physique.weightPounds ? `Вес: ${state.physique.weightPounds} фунт.` : ''
    ].filter(Boolean).join('\n\n'));


    const spellSources = typeof getSpellSources === 'function' ? getSpellSources() : [];
    const exportedSpellKeys = new Set();
    let exportedSpellCount = 0;

    function spellInnateLabel(source) {
      const raw = String(source?.spellLabel || source?.title || '').trim();
      return raw
        .replace(/^Класс:\s*/i, '')
        .replace(/^Вид:\s*/i, '')
        .replace(/^Черта:\s*/i, '')
        .replace(/^Предыстория:\s*/i, '')
        .replace(/^Умение класса:\s*/i, '')
        .replace(/^Эзотерическая теория:\s*/i, '')
        .trim();
    }

    function selectedSpellsForSource(source) {
      const selected = state.spells?.sources?.[source.id] || { cantrip: [], level1: [] };
      const selectedIds = new Set([
        ...(selected.cantrip || []),
        ...(selected.level1 || [])
      ]);
      return [
        ...(source.fixed || []),
        ...(source.options || []).filter((spell) => selectedIds.has(spell.id))
      ];
    }

    function inferSpellDamageProfile(spell) {
      const text = stripHtml(spell?.description || '')
        .replace(/\u00a0/g, ' ')
        .replace(/(\d+)\s*[дd]\s*(\d+)/gi, '$1d$2');
      // JavaScript `\b` понимает только латинские word-символы, поэтому
      // граница перед кириллическим словом «урон» никогда не совпадала.
      // Из-за этого новые русскоязычные заклинания оставались SPELLCARD.
      const diceMatch = text.match(/\b(\d+d\d+(?:\s*[+-]\s*\d+)?)\b(?=[^.!?\n]{0,120}урон)/i)
        || text.match(/урон[^.!?\n]{0,120}?\b(\d+d\d+(?:\s*[+-]\s*\d+)?)\b/i);
      if (!diceMatch) return null;

      const dice = String(diceMatch[1] || '').replace(/\s+/g, '');
      const diceIndex = Number(diceMatch.index || 0);
      const damageSentence = text.slice(
        Math.max(0, text.lastIndexOf('.', diceIndex) + 1),
        Math.min(text.length, diceIndex + 180)
      ).toLocaleLowerCase('ru');
      const damageTypes = [
        [/кислот/i, 'Кислотой'],
        [/дробящ/i, 'Дробящий'],
        [/огн/i, 'Огнём'],
        [/холод/i, 'Холодом'],
        [/электрич/i, 'Электричеством'],
        [/звуков/i, 'Звуком'],
        [/яд(?:ом|а|овит)/i, 'Ядом'],
        [/некротическ/i, 'Некротический'],
        [/психическ/i, 'Психический'],
        [/излучен/i, 'Излучением'],
        [/силов/i, 'Силовой'],
        [/колющ/i, 'Колющий'],
        [/рубящ/i, 'Рубящий']
      ];
      const damageType = damageTypes.find(([pattern]) => pattern.test(damageSentence))?.[1] || '';

      const lower = text.toLocaleLowerCase('ru');
      const attackType = /(?:дальнобойн[а-яё]*\s+атак[а-яё]*\s+заклинанием|атак[а-яё]*\s+заклинанием\s+дальн[а-яё]*\s+бо[а-яё]*|дальн[а-яё]*\s+атак[а-яё]*\s+заклинанием)/i.test(lower)
        ? 'Ranged'
        : /(?:рукопашн[а-яё]*\s+атак[а-яё]*\s+заклинанием|атак[а-яё]*\s+заклинанием\s+ближн[а-яё]*\s+бо[а-яё]*)/i.test(lower)
          ? 'Melee'
          : '';
      const saveAbilities = [
        [/спасброс[а-яё]*\s+силы/i, 'Strength', 'STR'],
        [/спасброс[а-яё]*\s+ловкости/i, 'Dexterity', 'DEX'],
        [/спасброс[а-яё]*\s+телосложения/i, 'Constitution', 'CON'],
        [/спасброс[а-яё]*\s+интеллекта/i, 'Intelligence', 'INT'],
        [/спасброс[а-яё]*\s+мудрости/i, 'Wisdom', 'WIS'],
        [/спасброс[а-яё]*\s+харизмы/i, 'Charisma', 'CHA']
      ];
      const save = saveAbilities.find(([pattern]) => pattern.test(lower));
      const die = dice.match(/d(\d+)/i)?.[1] || '';

      return {
        dice,
        die,
        damageType,
        attackType,
        saveAbility: save?.[1] || '',
        saveShort: save?.[2] || '',
        saveEffect: /половин[а-яё]*\s+урон/i.test(lower)
          ? 'Половина урона при успехе'
          : 'Нет урона при успехе'
      };
    }

    function addSpellCard(spell, source) {
      if (!spell) return;
      const section = spell.level === 'cantrip' ? 'cantrip' : '1';
      const uniqueKey = `${section}:${spell.id || spell.name}`;
      if (exportedSpellKeys.has(uniqueKey)) return;
      exportedSpellKeys.add(uniqueKey);

      const newRowId = createRoll20Id();
      const sourceAttributes = Array.isArray(spell.roll20Attributes) ? spell.roll20Attributes : [];
      const sourceAttackAttributes = Array.isArray(spell.roll20AttackAttributes)
        ? spell.roll20AttackAttributes
        : [];
      const normalizedSourceAttributes = sourceAttributes
        .map((sourceAttribute) => {
          const field = String(sourceAttribute?.field || '').trim()
            || String(sourceAttribute?.name || '').match(/^repeating_spell-(?:cantrip|1)_[^_]+_(.+)$/)?.[1]
            || '';
          return field ? { ...sourceAttribute, field } : null;
        })
        .filter(Boolean);
      const normalizedSourceAttackAttributes = sourceAttackAttributes
        .map((sourceAttribute) => {
          const field = String(sourceAttribute?.field || '').trim()
            || String(sourceAttribute?.name || '').match(/^repeating_attack_[^_]+_(.+)$/)?.[1]
            || '';
          return field ? { ...sourceAttribute, field } : null;
        })
        .filter(Boolean);
      const healingSpell = /^(?:лечение ран|лечащее слово)$/i.test(String(spell.name || '').trim());
      const inferredDamage = inferSpellDamageProfile(spell);
      // Only create an attack link when we can also export the linked attack
      // row. Roll20 connects it back to the spell through repeating_attack's
      // spellid field and the spell row's rollcontent macro.
      const attackRowId = (normalizedSourceAttackAttributes.length || healingSpell || inferredDamage) ? createRoll20Id() : '';
      const copiedFields = new Set();
      const isCureWounds = /^лечение ран$/i.test(String(spell.name || '').trim());
      const healingDice = isCureWounds ? '2d8' : '2d4';
      const healingDie = isCureWounds ? 'd8' : 'd4';

      normalizedSourceAttributes.forEach((sourceAttribute) => {
        const field = sourceAttribute.field;
        copiedFields.add(field);
        let current = sourceAttribute.current ?? '';
        if (field === 'rollcontent' && attackRowId) {
          current = `%{${payload.character.oldId}|repeating_attack_${attackRowId}_attack}`;
        } else if (field === 'spellattackid' && attackRowId) {
          current = attackRowId;
        } else if (field === 'spelllevel') {
          // Roll20 uses the literal "cantrip" here. A numeric 0 makes its
          // sheet worker write links to repeating_spell-0 instead of the real
          // repeating_spell-cantrip row, so a cantrip attack never appears.
          current = section;
        } else if (field === 'spell_damage_progression' && section === 'cantrip' && attackRowId) {
          current = 'Cantrip Dice';
        } else if (field === 'spelloutput' && healingSpell) {
          current = 'ATTACK';
        } else if (field === 'spelloutput' && inferredDamage) {
          current = 'ATTACK';
        } else if (field === 'spellattack' && inferredDamage) {
          current = inferredDamage.attackType || 'None';
        } else if (field === 'spellsave' && inferredDamage) {
          // В карточке заклинания Roll20 ожидает полное английское имя
          // характеристики (Dexterity, Constitution и т. п.), как в
          // all-spells.json. Сокращения DEX/CON поле не распознаёт.
          current = inferredDamage.saveAbility;
        } else if (field === 'spelldamage' && inferredDamage) {
          current = inferredDamage.dice;
        } else if (field === 'spelldamagetype' && inferredDamage) {
          current = inferredDamage.damageType;
        } else if (healingSpell && field === 'spelldmgmod') {
          current = 'Yes';
        } else if (healingSpell && field === 'spellhealing') {
          current = healingDice;
        } else if (healingSpell && field === 'spellhldie') {
          current = '2';
        } else if (healingSpell && field === 'spellhldietype') {
          current = healingDie;
        } else if (field === 'spellcomp_v') {
          current = spell.components?.verbal ? '{{v=1}}' : 0;
        } else if (field === 'spellcomp_s') {
          current = spell.components?.somatic ? '{{s=1}}' : 0;
        } else if (field === 'spellcomp_m') {
          current = spell.components?.material ? '{{m=1}}' : 0;
        } else if (field === 'spellcomp_materials') {
          current = String(spell.components?.material || '').trim();
        }
        payload.character.attribs.push({
          name: `repeating_spell-${section}_${newRowId}_${field}`,
          current,
          max: sourceAttribute.max ?? '',
          id: createRoll20Id()
        });
      });

      const componentFields = {
        spellcomp_v: spell.components?.verbal ? '{{v=1}}' : 0,
        spellcomp_s: spell.components?.somatic ? '{{s=1}}' : 0,
        spellcomp_m: spell.components?.material ? '{{m=1}}' : 0,
        spellcomp_materials: String(spell.components?.material || '').trim()
      };
      Object.entries(componentFields).forEach(([field, current]) => {
        if (copiedFields.has(field)) return;
        copiedFields.add(field);
        payload.character.attribs.push({
          name: `repeating_spell-${section}_${newRowId}_${field}`,
          current,
          max: '',
          id: createRoll20Id()
        });
      });

      if (attackRowId && !copiedFields.has('spellattackid')) {
        copiedFields.add('spellattackid');
        payload.character.attribs.push({
          name: `repeating_spell-${section}_${newRowId}_spellattackid`,
          current: attackRowId,
          max: '',
          id: createRoll20Id()
        });
      }

      if (attackRowId) {
        normalizedSourceAttackAttributes.forEach((sourceAttribute) => {
          const field = sourceAttribute.field;
          let current = sourceAttribute.current ?? '';
          // These values mirror a row generated manually by Roll20. Its sheet
          // worker normalises the back-reference to lowercase.
          if (field === 'spellid') current = newRowId.toLocaleLowerCase('en');
          else if (field === 'spelllevel') current = section;
          else if (field === 'atkname') current = spell.name || '';
          else if (field === 'spell_innate') current = spellInnateLabel(source);
          else if (field === 'spelldesc_link') {
            current = `%{${payload.character.oldId}|repeating_spell-${section}_${newRowId.toLocaleLowerCase('en')}_output}`;
          }

          payload.character.attribs.push({
            name: `repeating_attack_${attackRowId}_${field}`,
            current,
            max: sourceAttribute.max ?? '',
            id: createRoll20Id()
          });
        });
      }

      if (inferredDamage && !normalizedSourceAttackAttributes.length && !healingSpell) {
        const hasAttackRoll = Boolean(inferredDamage.attackType);
        const hasSavingThrow = Boolean(inferredDamage.saveAbility) && !hasAttackRoll;
        const cantripScaling = section === 'cantrip' && inferredDamage.die
          ? `{{hldmg=[[(1*?{На каком уровне?|Уровень 0,0|Уровень 1,1|Уровень 2,2|Уровень 3,3|Уровень 4,4|Уровень 5,5|Уровень 6,6|Уровень 7,7|Уровень 8,8|Уровень 9,9})d${inferredDamage.die}]]}}`
          : '';
        const spellDescriptionLink = '{{spelldesc_link=[Показать описание](~repeating_attack_spelldesc_link)}}';
        const damageRoll = `@{wtype}&{template:dmg} {{rname=@{atkname}}} @{atkflag} {{range=@{atkrange}}} @{dmgflag} {{dmg1=[[@{dmgbase}]]}} {{dmg1type=@{dmgtype}}} @{dmg2flag} {{dmg2=[[0]]}} {{dmg2type=}} @{saveflag} {{desc=@{atk_desc}}} @{hldmg} {{spelllevel=@{spelllevel}}} {{innate=@{spell_innate}}} {{globaldamage=[[0]]}} {{globaldamagetype=@{global_damage_mod_type}}} ${spellDescriptionLink} @{charname_output}`;
        const attackRoll = `@{wtype}&{template:atkdmg} {{mod=@{atkbonus}}} {{rname=@{atkname}}} {{r1=[[@{d20}cs>@{atkcritrange}+@{spell_attack_bonus}]]}} @{rtype}cs>@{atkcritrange}+@{spell_attack_bonus}]]}} @{atkflag} {{range=@{atkrange}}} @{dmgflag} {{dmg1=[[@{dmgbase}]]}} {{dmg1type=@{dmgtype}}} @{dmg2flag} {{dmg2=[[0]]}} {{dmg2type=}} {{crit1=[[@{dmgbase}[CRIT]]]}} {{crit2=[[0[CRIT]]]}} @{saveflag} {{desc=@{atk_desc}}} @{hldmg} {{spelllevel=@{spelllevel}}} {{innate=@{spell_innate}}} {{globalattack=@{global_attack_mod}} {{globaldamage=[[0]]}} {{globaldamagecrit=[[0]]}} {{globaldamagetype=@{global_damage_mod_type}}} ${spellDescriptionLink} @{charname_output}`;
        const saveRoll = `@{wtype}&{template:atkdmg} {{mod=@{atkbonus}}} {{rname=@{atkname}}} {{r1=[[0d20]]}} {{r2=[[0d20]]}} @{atkflag} {{range=@{atkrange}}} @{dmgflag} {{dmg1=[[@{dmgbase}]]}} {{dmg1type=@{dmgtype}}} @{dmg2flag} {{dmg2=[[0]]}} {{dmg2type=}} {{crit1=[[0]]}} {{crit2=[[0]]}} @{saveflag} {{desc=@{atk_desc}}} @{hldmg} {{spelllevel=@{spelllevel}}} {{innate=@{spell_innate}}} {{globaldamage=[[0]]}} {{globaldamagecrit=[[0]]}} {{globaldamagetype=@{global_damage_mod_type}}} ${spellDescriptionLink} @{charname_output}`;
        const inferredAttackFields = {
          atkattr_base: 'spell',
          'options-flag': '0',
          spellid: newRowId.toLocaleLowerCase('en'),
          spelllevel: section,
          savedc: '(@{spell_save_dc})',
          atkname: spell.name || '',
          atkflag: hasAttackRoll ? '{{attack=1}}' : '0',
          dmgbase: inferredDamage.dice,
          dmgflag: '{{damage=1}} {{dmg1flag=1}}',
          dmgattr: '0',
          dmgtype: inferredDamage.damageType,
          dmg2base: '',
          dmg2attr: '0',
          dmg2flag: '0',
          dmg2type: '',
          atkrange: spell.range || '',
          saveflag: hasSavingThrow
            ? '{{save=1}} {{saveattr=@{saveattr}}} {{savedesc=@{saveeffect}}} {{savedc=[[[[@{savedc}]][SAVE]]]}}'
            : '0',
          saveattr: hasSavingThrow ? inferredDamage.saveAbility : '',
          saveeffect: hasSavingThrow ? inferredDamage.saveEffect : '',
          hldmg: cantripScaling,
          spell_innate: spellInnateLabel(source),
          atk_desc: '',
          spelldesc_link: `%{${payload.character.oldId}|repeating_spell-${section}_${newRowId.toLocaleLowerCase('en')}_output}`,
          atkdmgtype: `${inferredDamage.dice} ${inferredDamage.damageType}`.trim(),
          rollbase_dmg: damageRoll,
          rollbase_crit: damageRoll,
          atkbonus: hasAttackRoll ? '@{spell_attack_bonus}' : '-',
          rollbase: hasAttackRoll ? attackRoll : saveRoll
        };
        Object.entries(inferredAttackFields).forEach(([field, current]) => {
          payload.character.attribs.push({
            name: `repeating_attack_${attackRowId}_${field}`,
            current,
            max: '',
            id: createRoll20Id()
          });
        });
      }

      if (healingSpell && !normalizedSourceAttackAttributes.length) {
        const dice = healingDice;
        const die = healingDie;
        const sourceText = `${source?.spellLabel || ''} ${source?.title || ''} ${source?.description || ''}`
          .toLocaleLowerCase('ru');
        const abilityFromSource = /интеллект|intelligence/.test(sourceText)
          ? 'intelligence'
          : /мудрост|wisdom/.test(sourceText)
            ? 'wisdom'
            : /харизм|charisma/.test(sourceText)
              ? 'charisma'
              : '';
        const classCastingAbility = {
          wizard: 'intelligence', artificer: 'intelligence',
          cleric: 'wisdom', druid: 'wisdom', ranger: 'wisdom',
          bard: 'charisma', sorcerer: 'charisma', warlock: 'charisma', paladin: 'charisma'
        }[state.class] || '';
        const castingAbility = abilityFromSource || classCastingAbility;
        const healingModifier = castingAbility ? modifier(totalScore(castingAbility)) : 0;
        const castingAbilityLabel = {
          intelligence: 'INT',
          wisdom: 'WIS',
          charisma: 'CHA'
        }[castingAbility] || 'SPELL';
        const modifierExpression = healingModifier
          ? `${healingModifier > 0 ? '+' : ''}${healingModifier}`
          : '';
        const healingFormula = `${dice}${modifierExpression}`;
        const healingRollFormula = `${dice}${modifierExpression}[${castingAbilityLabel}]`;
        const upcast = `{{hldmg=[[(2*?{На каком уровне?|Уровень 1,0|Уровень 2,1|Уровень 3,2|Уровень 4,3|Уровень 5,4|Уровень 6,5|Уровень 7,6|Уровень 8,7|Уровень 9,8})${die}]]}}`;
        const spellDescriptionLink = '{{spelldesc_link=[Показать описание заклинания](~repeating_attack_spelldesc_link)}}';
        const damageRoll = `@{wtype}&{template:dmg} {{rname=@{atkname}}} @{atkflag} {{range=@{atkrange}}} @{dmgflag} {{dmg1=[[${healingRollFormula}]]}} {{dmg1type=Лечение}} @{dmg2flag} {{dmg2=[[0]]}} {{dmg2type=}} @{saveflag} {{desc=@{atk_desc}}} @{hldmg} {{spelllevel=@{spelllevel}}} {{innate=@{spell_innate}}} {{globaldamage=[[0]]}} {{globaldamagetype=@{global_damage_mod_type}}} ${spellDescriptionLink} @{charname_output}`;
        const healingFields = {
          atkattr_base: 'spell',
          'options-flag': '0',
          spellid: newRowId.toLocaleLowerCase('en'),
          spelllevel: '1',
          savedc: '(@{spell_save_dc})',
          atkname: spell.name || '',
          atkflag: '0',
          dmgbase: dice,
          dmgflag: '{{damage=1}} {{dmg1flag=1}}',
          dmgattr: 'spell',
          dmgtype: 'Лечение',
          dmg2base: '',
          dmg2attr: '0',
          dmg2flag: '0',
          dmg2type: '',
          atkrange: spell.range || (isCureWounds ? 'Касание' : '60 футов'),
          saveflag: '0',
          saveeffect: '',
          hldmg: upcast,
          spell_innate: spellInnateLabel(source),
          atk_desc: '',
          spelldesc_link: `%{${payload.character.oldId}|repeating_spell-1_${newRowId.toLocaleLowerCase('en')}_output}`,
          atkdmgtype: `${healingFormula} Лечение`,
          rollbase_dmg: damageRoll,
          rollbase_crit: damageRoll,
          atkbonus: '-',
          rollbase: damageRoll,
          saveattr: ''
        };
        Object.entries(healingFields).forEach(([field, current]) => {
          payload.character.attribs.push({
            name: `repeating_attack_${attackRowId}_${field}`,
            current,
            max: '',
            id: createRoll20Id()
          });
        });
      }

      /** @type {Record<string, any>} */
      const fallbackFields = {
        spellname: spell.name || '',
        spelllevel: section,
        spellschool: spell.school || '',
        spellcastingtime: spell.castingTime || '',
        spellrange: spell.range || '',
        spellduration: spell.duration || '',
        spelldescription: stripHtml(spell.description || ''),
        spelloutput: (healingSpell || inferredDamage) ? 'ATTACK' : 'SPELLCARD',
        spellprepared: '0',
        spell_ability: 'spell',
        'details-flag': '0',
        'options-flag': '0'
      };

      if (healingSpell) {
        fallbackFields.spelloutput = 'ATTACK';
        fallbackFields.spelldmgmod = 'Yes';
        fallbackFields.spellhealing = healingDice;
        fallbackFields.spellhldie = '2';
        fallbackFields.spellhldietype = healingDie;
      }

      if (inferredDamage) {
        fallbackFields.spelloutput = 'ATTACK';
        fallbackFields.spellattack = inferredDamage.attackType || 'None';
        fallbackFields.spellsave = inferredDamage.saveAbility;
        fallbackFields.spelldamage = inferredDamage.dice;
        fallbackFields.spelldamagetype = inferredDamage.damageType;
        if (section === 'cantrip') fallbackFields.spell_damage_progression = 'Cantrip Dice';
      }

      if (attackRowId) {
        fallbackFields.spellattackid = attackRowId;
        fallbackFields.rollcontent = `%{${payload.character.oldId}|repeating_attack_${attackRowId}_attack}`;
      }

      Object.entries(fallbackFields).forEach(([field, current]) => {
        if (copiedFields.has(field)) return;
        payload.character.attribs.push({
          name: `repeating_spell-${section}_${newRowId}_${field}`,
          current,
          max: '',
          id: createRoll20Id()
        });
      });

      const innateName = `repeating_spell-${section}_${newRowId}_innate`;
      const existingInnate = payload.character.attribs.find((item) => item.name === innateName);
      const innate = spellInnateLabel(source);
      if (existingInnate) existingInnate.current = innate;
      else payload.character.attribs.push({ name: innateName, current: innate, max: '', id: createRoll20Id() });

      exportedSpellCount += 1;
    }

    if (spellSources.length) {
      spellSources.forEach((source) => {
        selectedSpellsForSource(source).forEach((spell) => addSpellCard(spell, source));
      });
    } else {
      const selectedCantrips = new Set(state.spells.cantrips || []);
      const selectedLevel1 = new Set(state.spells.level1 || []);
      getClassSpells().filter((spell) =>
        spell.level === 'cantrip'
          ? selectedCantrips.has(spell.id)
          : spell.level === '1' && selectedLevel1.has(spell.id)
      ).forEach((spell) => addSpellCard(spell, { id: 'class', title: className }));
    }
    if (exportedSpellCount) {
      upsert('tab', 'spells');
      const firstLevel = Array.isArray(characterClass?.levels)
        ? characterClass.levels.find((level) => Number(level?.level) === 1)
        : null;
      const slots = Number(firstLevel?.spellSlots?.[1]
        ?? firstLevel?.numOfSpellSlots
        ?? 0);
      const classHasSpellSlots = slots > 0;
      upsert('caster_level', classHasSpellSlots && !isRangerClass ? '1' : '0');
      upsert('lvl1_slots_total', classHasSpellSlots ? String(slots) : '0');
      if (!classHasSpellSlots) upsert('lvl1_slots_mod', '0');
      const castingAbilityMap = { wizard: 'intelligence', artificer: 'intelligence', apothecary: 'intelligence', cleric: 'wisdom', druid: 'wisdom', ranger: 'wisdom', bard: 'charisma', sorcerer: 'charisma', warlock: 'charisma', paladin: 'charisma' };
      const castingAbility = castingAbilityMap[state.class] || '';
      if (castingAbility) {
        upsert('spellcasting_ability', `@{${castingAbility}_mod}+`);
        upsert('spell_attack_bonus', modifier(totalScore(castingAbility)) + 2);
        upsert('spell_save_dc', 8 + modifier(totalScore(castingAbility)) + 2);
      }
      upsert('lvl1_slots_expended', '0');
    }

    // Every attack macro stored in a spell must still point to an exported
    // repeating_attack row. No spellid back-reference is required.
    const exportedAttackRowIds = new Set(
      payload.character.attribs
        .map((attribute) => String(attribute.name || '').match(/^repeating_attack_([^_]+)_/i)?.[1])
        .filter(Boolean)
    );
    const orphanedSpellAttacks = payload.character.attribs
      .filter((attribute) => /^repeating_spell-(?:cantrip|\d+)_[^_]+_rollcontent$/i.test(String(attribute.name || '')))
      .map((attribute) => String(attribute.current || '').match(/repeating_attack_([^_]+)_attack/i)?.[1] || '')
      .filter((rowId) => rowId && !exportedAttackRowIds.has(rowId));
    if (orphanedSpellAttacks.length) {
      throw new Error(
        `Экспорт Roll20 остановлен: не созданы строки атак для ${orphanedSpellAttacks.length} заклинаний.`
      );
    }

    payload.character.attribs = payload.character.attribs.map((attribute) => ({
      ...attribute,
      id: attribute.id || createRoll20Id()
    }));

    const tokenAttribute = (name) => payload.character.attribs.find((attribute) => attribute.name === name);
    const hpAttribute = tokenAttribute('hp');
    const acAttribute = tokenAttribute('ac');
    const passiveWisdomAttribute = tokenAttribute('passive_wisdom');
    payload.character.defaulttoken = JSON.stringify({
      width: 70,
      height: 70,
      imgsrc: String(payload.character.avatar || ''),
      name: payload.character.name,
      show_tooltip: false,
      represents: payload.character.oldId,
      bar1_value: String(hpAttribute?.current ?? maxHp),
      bar1_max: String(hpAttribute?.max ?? maxHp),
      bar1_num_permission: 'hidden',
      bar1_link: hpAttribute?.id || '',
      bar2_value: String(acAttribute?.current ?? exportedAc),
      bar2_num_permission: 'hidden',
      bar2_link: acAttribute?.id || '',
      bar3_value: String(passiveWisdomAttribute?.current ?? ''),
      bar3_num_permission: 'hidden',
      bar3_link: passiveWisdomAttribute?.id || '',
      bar_location: 'overlap_bottom',
      compact_bar: 'compact',
      showplayers_aura1: true,
      showplayers_aura2: true,
      has_bright_light_vision: true,
      has_low_light_vision: true,
      has_night_vision: speciesDarkvisionDistance > 0,
      night_vision_distance: speciesDarkvisionDistance,
      night_vision_effect: speciesDarkvisionDistance > 0 ? 'Dimming_0' : 'Nocturnal',
      dim_light_opacity: '0.75'
    });
    return payload;
  
  }

  globalScope.CharacterCreatorRoll20 = Object.freeze({
    buildPayload
  });
})(window);
