import { IsUUID } from 'class-validator';

export class CopyPreviousMembersDto {
  @IsUUID('4')
  sourceReservationId: string;
}
