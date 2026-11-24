import { IsUUID } from 'class-validator';

export class AssignAccommodationManagerDto {
  @IsUUID()
  userId: string;
}
