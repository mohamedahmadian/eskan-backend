import { ArrayMinSize, IsArray, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class PayReservationInsuranceDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  memberIds: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(36)
  insurancePlanId: string;
}
