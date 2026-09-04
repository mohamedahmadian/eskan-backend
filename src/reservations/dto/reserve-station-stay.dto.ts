import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';
import { MealType } from '../../generated/prisma/client';

export const stationMealTypes = [MealType.LUNCH, MealType.DINNER] as const;
export type StationMealType = (typeof stationMealTypes)[number];

export const routePlacementAssignBy = ['station', 'date'] as const;
export type RoutePlacementAssignBy = (typeof routePlacementAssignBy)[number];

export class ReserveStationStayDto {
  @IsUUID()
  walkingStationId: string;

  @Transform(({ value }) => emptyToNull(value))
  @IsDateString()
  stayDate: string;

  @IsIn(stationMealTypes)
  mealType: StationMealType;

  @IsOptional()
  @IsIn(routePlacementAssignBy)
  assignBy?: RoutePlacementAssignBy;
}

export class AutoReserveStationStaysDto {
  @Transform(({ value }) => emptyToNull(value))
  @IsDateString()
  stayDate: string;

  @IsIn(stationMealTypes)
  mealType: StationMealType;

  @IsOptional()
  @IsIn(routePlacementAssignBy)
  assignBy?: RoutePlacementAssignBy;
}
