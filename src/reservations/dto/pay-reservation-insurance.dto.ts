import { IsArray, ArrayMinSize, IsUUID } from 'class-validator';

export class PayReservationInsuranceDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  memberIds: string[];
}
