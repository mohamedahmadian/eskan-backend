import { IsOptional, IsUUID } from 'class-validator';

export class OpenReservationQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;
}
