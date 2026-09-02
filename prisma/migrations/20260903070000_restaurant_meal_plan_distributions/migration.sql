-- CreateTable
CREATE TABLE "restaurant_meal_plan_distributions" (
    "id" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "accommodationId" TEXT NOT NULL,
    "servings" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_meal_plan_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_meal_plan_distributions_mealPlanId_accommodationId_key" ON "restaurant_meal_plan_distributions"("mealPlanId", "accommodationId");

-- CreateIndex
CREATE INDEX "restaurant_meal_plan_distributions_mealPlanId_idx" ON "restaurant_meal_plan_distributions"("mealPlanId");

-- CreateIndex
CREATE INDEX "restaurant_meal_plan_distributions_accommodationId_idx" ON "restaurant_meal_plan_distributions"("accommodationId");

-- AddForeignKey
ALTER TABLE "restaurant_meal_plan_distributions" ADD CONSTRAINT "restaurant_meal_plan_distributions_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "restaurant_meal_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_meal_plan_distributions" ADD CONSTRAINT "restaurant_meal_plan_distributions_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "accommodations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
