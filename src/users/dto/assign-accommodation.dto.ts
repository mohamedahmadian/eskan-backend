import { IsUUID } from 'class-validator';

export class AssignAccommodationDto {
  @IsUUID()
  accommodationId: string;
}
