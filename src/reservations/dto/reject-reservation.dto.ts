import { IsString, MinLength } from 'class-validator';

export class RejectReservationDto {
  @IsString()
  @MinLength(2)
  reason: string;
}
