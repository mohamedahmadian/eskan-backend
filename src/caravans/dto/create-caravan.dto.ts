import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCaravanDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  originCity: string;

  @IsOptional()
  @IsDateString()
  plannedArrival?: string;
}
