import { IngredientUnit } from '../generated/prisma/client';

export const ingredientUnits = [
  IngredientUnit.GRAM,
  IngredientUnit.KILOGRAM,
  IngredientUnit.MILLILITER,
  IngredientUnit.LITER,
  IngredientUnit.PIECE,
] as const;

export type IngredientUnitValue = (typeof ingredientUnits)[number];

type UnitDimension = 'mass' | 'volume' | 'count';

const UNIT_META: Record<
  IngredientUnit,
  { dim: UnitDimension; toBase: number }
> = {
  GRAM: { dim: 'mass', toBase: 1 },
  KILOGRAM: { dim: 'mass', toBase: 1000 },
  MILLILITER: { dim: 'volume', toBase: 1 },
  LITER: { dim: 'volume', toBase: 1000 },
  PIECE: { dim: 'count', toBase: 1 },
};

export function unitDimension(unit: IngredientUnit): UnitDimension {
  return UNIT_META[unit].dim;
}

export function unitsAreCompatible(a: IngredientUnit, b: IngredientUnit) {
  return unitDimension(a) === unitDimension(b);
}

export function compatibleUnits(unit: IngredientUnit): IngredientUnit[] {
  const dim = unitDimension(unit);
  return ingredientUnits.filter((item) => unitDimension(item) === dim);
}

export function convertQuantity(
  quantity: number,
  from: IngredientUnit,
  to: IngredientUnit,
) {
  if (!unitsAreCompatible(from, to)) {
    throw new Error('واحد مقدار با واحد ماده اولیه سازگار نیست');
  }
  return (quantity * UNIT_META[from].toBase) / UNIT_META[to].toBase;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function roundQty(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function lineCost(
  quantity: number,
  quantityUnit: IngredientUnit,
  pricePerUnit: number,
  priceUnit: IngredientUnit,
) {
  return roundMoney(
    convertQuantity(quantity, quantityUnit, priceUnit) * pricePerUnit,
  );
}

export function toNumber(value: { toNumber?: () => number } | number | string) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return Number(value);
  }
  return value.toNumber?.() ?? Number(value);
}
