import { IsUUID } from 'class-validator';

export class AssignReservationHonoraryDto {
  @IsUUID('4')
  userId: string;

  @IsUUID('4')
  serviceTypeId: string;
}
