import type { Background } from '../../types/background';

export const spellfireinitiate: Background = {
  id: 'spellfire-initiate',
  name: 'Посвящённый чаропламени',
  nameEn: 'Spellfire Initiate',
  sourceBook: 'FRHoF24',
  lore: 'Вы несёте в себе дар чаропламени, редкой формы магии, оперирующей чистой силой Плетения. Работа с чаропламенем тяжело сказывается на здоровье, и вы готовили как разум, так и тело, чтобы эффективно управлять этой священной силой.',
  proficiencies: {
    abilityScores: {
      description: 'Либо значение одной характеристики по вашему выбору увеличивается на 2, а другой — на 1, либо значение трёх различных характеристик по вашему выбору увеличивается на 1'
    },
    feat: 'Любая черта происхождения или черта Искра чаропламени',
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