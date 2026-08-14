interface CurrencyValue {
    amount: number;
    unit: string;
  }
  
  const CURRENCY_RATES = {
    'мм': 0.01,
    'см': 0.1,
    'зм': 1,
    'пм': 10
  };
  
  export function parseCurrencyString(costString: string): CurrencyValue {
    const match = costString.match(/(\d+)\s*(мм|см|зм|пм)/);
    if (!match) return { amount: 0, unit: 'зм' };
    
    return {
      amount: parseInt(match[1]),
      unit: match[2]
    };
  }
  
  export function convertToGold(cost: CurrencyValue): number {
    return cost.amount * (CURRENCY_RATES[cost.unit as keyof typeof CURRENCY_RATES] || 0);
  }