import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectReservationPermitDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  reason?: string;
}
