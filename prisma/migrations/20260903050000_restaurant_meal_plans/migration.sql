-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER');

-- CreateTable
CREATE TABLE "restaurant_meal_plans" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "planDate" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "servings" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_meal_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_meal_plans_restaurantId_planDate_mealType_foodId_key" ON "restaurant_meal_plans"("restaurantId", "planDate", "mealType", "foodId");

-- CreateIndex
CREATE INDEX "restaurant_meal_plans_restaurantId_planDate_idx" ON "restaurant_meal_plans"("restaurantId", "planDate");

-- CreateIndex
CREATE INDEX "restaurant_meal_plans_planDate_idx" ON "restaurant_meal_plans"("planDate");

-- CreateIndex
CREATE INDEX "restaurant_meal_plans_foodId_idx" ON "restaurant_meal_plans"("foodId");

-- AddForeignKey
ALTER TABLE "restaurant_meal_plans" ADD CONSTRAINT "restaurant_meal_plans_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_meal_plans" ADD CONSTRAINT "restaurant_meal_plans_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "foods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
