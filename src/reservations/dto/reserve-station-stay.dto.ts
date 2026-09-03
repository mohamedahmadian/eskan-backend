import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsUUID } from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';
import { MealType } from '../../generated/prisma/client';

export const stationMealTypes = [MealType.LUNCH, MealType.DINNER] as const;
export type StationMealType = (typeof stationMealTypes)[number];

export class ReserveStationStayDto {
  @IsUUID()
  walkingStationId: string;

  @Transform(({ value }) => emptyToNull(value))
  @IsDateString()
  stayDate: string;

  @IsIn(stationMealTypes)
  mealType: StationMealType;
}

export class AutoReserveStationStaysDto {
  @Transform(({ value }) => emptyToNull(value))
  @IsDateString()
  stayDate: string;

  @IsIn(stationMealTypes)
  mealType: StationMealType;
}
