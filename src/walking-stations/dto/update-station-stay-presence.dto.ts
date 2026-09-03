import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';
import { toBoolean } from '../../common/dto-transform';

export class UpdateStationStayPresenceDto {
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  present: boolean;
}
