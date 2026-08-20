import { Transform } from 'class-transformer';
import { IsUUID } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';

export class IceVoucherQuotaQueryDto {
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  accommodationId: string;
}
