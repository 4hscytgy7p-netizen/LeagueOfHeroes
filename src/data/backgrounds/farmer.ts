import type { Background } from '../../types/background';

export const farmer: Background = {
  id: 'farmer',
  name: 'Фермер',
  nameEn: 'Farmer',
  sourceBook: 'PHB24',
  lore: 'Вы выросли близко к земле. Годы ухода за животными и возделывания земли наградили вас терпением и крепким здоровьем. Вы высоко цените щедрость природы и уважаете её гнев.',
  proficiencies: {
    abilityScores: {
      description: 'Либо значение одной характеристики по вашему выбору увеличивается на 2, а другой — на 1, либо значение трёх различных характеристик по вашему выбору увеличивается на 1'
    },
    feat: 'Любая черта происхождения',
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