import {
  CategoryItem,
  CoffeeOptionsSettings,
  DEFAULT_COFFEE_OPTIONS,
  MenuItem,
  MilkOption,
  TemperatureOption,
} from '../types';

export interface ResolvedItemModifiers {
  milkEnabled: boolean;
  coconutMilkPrice: number;
  temperatureEnabled: boolean;
}

const DEFAULT_COFFEE_CATEGORY_KEYS = new Set([
  'v60',
  'espresso',
  'matcha',
  'specialty',
  'coffee',
]);

export function resolveItemModifiers(
  item: Pick<MenuItem, 'category' | 'allowMilkOption' | 'coconutMilkPrice' | 'allowTemperature'>,
  categories: CategoryItem[],
  coffeeOptions: CoffeeOptionsSettings = DEFAULT_COFFEE_OPTIONS
): ResolvedItemModifiers {
  const matchedCat = categories.find(
    (c) => c.key === item.category || c.nameEn === item.category
  );

  const fallbackSupportsCoffee = DEFAULT_COFFEE_CATEGORY_KEYS.has(
    item.category.trim().toLowerCase()
  );

  const milkByItemOrCat =
    typeof item.allowMilkOption === 'boolean'
      ? item.allowMilkOption
      : matchedCat
      ? matchedCat.allowMilkOption
      : fallbackSupportsCoffee;

  const tempByItemOrCat =
    typeof item.allowTemperature === 'boolean'
      ? item.allowTemperature
      : matchedCat
      ? matchedCat.allowTemperature
      : fallbackSupportsCoffee;

  const coconutPrice =
    typeof item.coconutMilkPrice === 'number' && Number.isFinite(item.coconutMilkPrice)
      ? Math.max(0, item.coconutMilkPrice)
      : Math.max(0, coffeeOptions.coconutMilkExtraPrice);

  return {
    milkEnabled: Boolean(coffeeOptions.milkSelectionEnabled && milkByItemOrCat),
    coconutMilkPrice: coconutPrice,
    temperatureEnabled: Boolean(coffeeOptions.hotColdSelectionEnabled && tempByItemOrCat),
  };
}

export function getMilkExtraPrice(
  milkOption: MilkOption | undefined,
  coconutMilkPrice: number
): number {
  if (milkOption === 'coconut') {
    return Number.isFinite(coconutMilkPrice) && coconutMilkPrice > 0
      ? Number(coconutMilkPrice.toFixed(2))
      : 0;
  }
  return 0;
}

export function buildCartLineKey(
  itemId: string,
  temperature?: TemperatureOption,
  milkOption?: MilkOption
): string {
  return `${itemId}::${temperature || 'default'}::${milkOption || 'default'}`;
}
