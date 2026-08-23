import { IsEnum } from 'class-validator';
import { ReservationStatus } from '../../generated/prisma/client';

export class ReturnReservationDto {
  @IsEnum(ReservationStatus)
  status: ReservationStatus;
}
