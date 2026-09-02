DELETE FROM "restaurant_meal_plans" a
USING "restaurant_meal_plans" b
WHERE a."restaurantId" = b."restaurantId"
  AND a."planDate" = b."planDate"
  AND a."mealType" = b."mealType"
  AND a.id > b.id;

DROP INDEX "restaurant_meal_plans_restaurantId_planDate_mealType_foodId_key";

CREATE UNIQUE INDEX "restaurant_meal_plans_restaurantId_planDate_mealType_key" ON "restaurant_meal_plans"("restaurantId", "planDate", "mealType");
