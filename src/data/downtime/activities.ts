interface DowntimeActivity {
  title: string;
  description: string;
  requirements?: string[];
  duration?: string;
  cost?: string;
}

export const craftingActivities: DowntimeActivity[] = [];

export const tradingActivities: DowntimeActivity[] = [
  {
    title: "Поиск магических предметов",
    description: "Поиск конкретных магических предметов для покупки.",
    duration: "1-8 недель",
    cost: "Зависит от редкости предмета"
  },
  {
    title: "Продажа магических предметов",
    description: "Поиск покупателя для магического предмета.",
    duration: "1-4 недели"
  }
];

export const entertainmentActivities: DowntimeActivity[] = [
  {
    title: "Бойцовский турнир",
    description: "Участие в организованных боях за славу и награды.",
    requirements: ["Владение боевым оружием"],
    duration: "1 неделя",
    cost: "Вступительный взнос 50 зм"
  },
  {
    title: "Азартные игры",
    description: "Участие в азартных играх с шансом выиграть или потерять деньги.",
    duration: "От нескольких часов до недели",
    cost: "Минимальная ставка 10 зм"
  }
];

export const trainingActivities: DowntimeActivity[] = [
  {
    title: "Обучение",
    description: "Изучение нового языка или получение владения инструментами.",
    duration: "10 недель",
    cost: "250 зм"
  },
  {
    title: "Религиозные обряды",
    description: "Выполнение религиозных обрядов для получения благословения.",
    duration: "1 неделя",
    cost: "Пожертвование храму"
  },
  {
    title: "Обучение животных",
    description: "Тренировка животного для выполнения особых команд.",
    requirements: ["Владение навыком Обращение с животными"],
    duration: "8 недель",
    cost: "150 зм"
  }
];

export const adventuringActivities: DowntimeActivity[] = [
  {
    title: "В поисках приключений",
    description: "Поиск возможностей для небольших приключений между основными заданиями.",
    duration: "1-4 недели"
  }
];