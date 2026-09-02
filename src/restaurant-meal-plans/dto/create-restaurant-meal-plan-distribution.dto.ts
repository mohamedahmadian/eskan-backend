import { Type } from 'class-transformer';
import { IsInt, IsUUID, Min } from 'class-validator';

export class CreateRestaurantMealPlanDistributionDto {
  @IsUUID()
  accommodationId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  servings: number;
}
