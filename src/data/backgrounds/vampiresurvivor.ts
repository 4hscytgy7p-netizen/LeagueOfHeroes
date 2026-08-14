import type { Background } from '../../types/background';

export const vampiresurvivor: Background = {
  id: 'vampire survivor',
  name: 'Уцелевший от вампира',
  nameEn: 'Vampire Survivor',
  sourceBook: 'ABH24',
  lore: 'Вы пережили атаку вампира, а может быть, наблюдали за ней. Возможно, вампир целился не в вас, возможно, вы застыли в ужасе от увиденного — так или иначе, с тех пор вы постоянно ожидаете атаки монстра, и горды тем, что готовы ко всему. Никакой вампир больше не застанет вас врасплох. Никогда.',
  proficiencies: {
    abilityScores: {
      description: 'Либо значение одной характеристики по вашему выбору увеличивается на 2, а другой — на 1, либо значение трёх различных характеристик по вашему выбору увеличивается на 1'
    },
    feat: 'Любая черта происхождения или черта Охотник на вампиров',
    skills: {
      count: 2,
      description: '2 любых навыка'
    },
    tools: {
      description: '1 владение: ремесленный/неремесленный инструмент, набор, транспорт, музыкальный инструмент, игровой набор'
    },
    equipment: '50 зм'
  },
  characteristics: {
    personalityTraits: [
      { roll: 1, trait: '-'},
    ],
    ideals: [
      { roll: 1, trait: '-'},
    ],
    bonds: [
      { roll: 1, trait: '-'},
    ],
    flaws: [
      { roll: 1, trait: '-'},
    ],
  }
};