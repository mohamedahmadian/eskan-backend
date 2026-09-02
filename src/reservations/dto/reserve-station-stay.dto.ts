import { Transform } from 'class-transformer';
import { IsDateString, IsUUID } from 'class-validator';
import { emptyToNull } from '../../common/dto-transform';

export class ReserveStationStayDto {
  @IsUUID()
  walkingStationId: string;

  @Transform(({ value }) => emptyToNull(value))
  @IsDateString()
  stayDate: string;
}
