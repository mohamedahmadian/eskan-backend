import { Injectable, NotFoundException } from '@nestjs/common';
import {
  convertQuantity,
  lineCost,
  roundMoney,
  roundQty,
  toNumber,
} from '../common/nutrition-units';
import { PrismaService } from '../prisma/prisma.service';
import {
  CalculateFromServingsBatchDto,
  CalculateFromServingsDto,
} from './dto/calculate-from-servings.dto';
import { CalculateFromStockDto } from './dto/calculate-from-stock.dto';

const foodInclude = {
  ingredients: {
    include: { ingredient: true },
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class WarehouseCalculatorService {
  constructor(private readonly prisma: PrismaService) {}

  async fromServings(dto: CalculateFromServingsDto) {
    const food = await this.prisma.food.findUnique({
      where: { id: dto.foodId },
      include: foodInclude,
    });
    if (!food) {
      throw new NotFoundException('غذا یافت نشد');
    }
    const servings = dto.servings;
    const lines = food.ingredients.map((line) => {
      const quantity = toNumber(line.quantity);
      const pricePerUnit = toNumber(line.ingredient.pricePerUnit);
      const stockQty = toNumber(line.ingredient.stockQty);
      const perServingInStockUnit = convertQuantity(
        quantity,
        line.unit,
        line.ingredient.unit,
      );
      const needed = roundQty(perServingInStockUnit * servings);
      const costPerServing = lineCost(
        quantity,
        line.unit,
        pricePerUnit,
        line.ingredient.unit,
      );
      return {
        ingredientId: line.ingredient.id,
        name: line.ingredient.name,
        unit: line.ingredient.unit,
        quantityPerServing: roundQty(perServingInStockUnit),
        quantityNeeded: needed,
        stockQty,
        shortage: roundQty(Math.max(0, needed - stockQty)),
        costPerServing,
        costTotal: roundMoney(costPerServing * servings),
      };
    });
    const costPerServing = roundMoney(
      lines.reduce((sum, line) => sum + line.costPerServing, 0),
    );
    return {
      food: {
        id: food.id,
        name: food.name,
        finalPrice: toNumber(food.finalPrice),
        costPrice: costPerServing,
      },
      servings,
      costTotal: roundMoney(costPerServing * servings),
      saleTotal: roundMoney(toNumber(food.finalPrice) * servings),
      lines,
    };
  }

  async fromServingsBatch(dto: CalculateFromServingsBatchDto) {
    const items = [];
    for (const item of dto.items) {
      items.push(await this.fromServings(item));
    }
    return {
      items,
      totals: this.aggregateServings(items),
    };
  }

  private aggregateServings(
    items: Array<Awaited<ReturnType<WarehouseCalculatorService['fromServings']>>>,
  ) {
    const byIngredient = new Map<
      string,
      Awaited<ReturnType<WarehouseCalculatorService['fromServings']>>['lines'][number]
    >();
    for (const result of items) {
      for (const line of result.lines) {
        const current = byIngredient.get(line.ingredientId);
        if (!current) {
          byIngredient.set(line.ingredientId, { ...line });
          continue;
        }
        current.quantityNeeded = roundQty(
          current.quantityNeeded + line.quantityNeeded,
        );
        current.quantityPerServing = roundQty(
          current.quantityPerServing + line.quantityPerServing,
        );
        current.costPerServing = roundMoney(
          current.costPerServing + line.costPerServing,
        );
        current.costTotal = roundMoney(current.costTotal + line.costTotal);
      }
    }
    const lines = [...byIngredient.values()].map((line) => ({
      ...line,
      shortage: roundQty(Math.max(0, line.quantityNeeded - line.stockQty)),
    }));
    return {
      foodsCount: items.length,
      servings: items.reduce((sum, item) => sum + item.servings, 0),
      costTotal: roundMoney(items.reduce((sum, item) => sum + item.costTotal, 0)),
      saleTotal: roundMoney(items.reduce((sum, item) => sum + item.saleTotal, 0)),
      lines,
    };
  }

  async fromStock(dto: CalculateFromStockDto) {
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id: dto.ingredientId },
    });
    if (!ingredient) {
      throw new NotFoundException('ماده اولیه یافت نشد');
    }
    const available =
      dto.quantity == null ? toNumber(ingredient.stockQty) : dto.quantity;
    const recipes = await this.prisma.foodIngredient.findMany({
      where: { ingredientId: ingredient.id },
      include: {
        food: { include: foodInclude },
      },
      orderBy: { food: { name: 'asc' } },
    });

    const foods = recipes.map((recipe) => {
      const perServing = convertQuantity(
        toNumber(recipe.quantity),
        recipe.unit,
        ingredient.unit,
      );
      const maxByThis = perServing > 0 ? Math.floor(available / perServing) : 0;
      const otherLimits = recipe.food.ingredients
        .filter((line) => line.ingredientId !== ingredient.id)
        .map((line) => {
          const needed = convertQuantity(
            toNumber(line.quantity),
            line.unit,
            line.ingredient.unit,
          );
          const stock = toNumber(line.ingredient.stockQty);
          const maxServings = needed > 0 ? Math.floor(stock / needed) : 0;
          return {
            ingredientId: line.ingredient.id,
            name: line.ingredient.name,
            unit: line.ingredient.unit,
            quantityPerServing: roundQty(needed),
            stockQty: stock,
            maxServings,
          };
        });
      const maxByOthers = otherLimits.length
        ? Math.min(...otherLimits.map((item) => item.maxServings))
        : maxByThis;
      const feasibleServings = Math.min(maxByThis, maxByOthers);
      return {
        foodId: recipe.food.id,
        name: recipe.food.name,
        quantityPerServing: roundQty(perServing),
        maxServingsByIngredient: maxByThis,
        feasibleServings,
        otherLimits,
      };
    });

    return {
      ingredient: {
        id: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit,
        stockQty: toNumber(ingredient.stockQty),
      },
      quantity: available,
      foods,
    };
  }
}
