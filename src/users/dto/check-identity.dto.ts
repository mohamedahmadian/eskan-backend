import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { normalizeNationalId } from '../../common/national-id';
import { normalizePhone } from '../../common/phone';

export class CheckIdentityDto {
  @IsOptional()
  @Transform(({ value }) => {
    const trimmed = emptyToUndefined(value);
    return trimmed ? normalizeNationalId(trimmed) : undefined;
  })
  @IsString()
  nationalId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    const trimmed = emptyToUndefined(value);
    return trimmed ? normalizePhone(trimmed) : undefined;
  })
  @IsString()
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsUUID()
  excludeId?: string;
}
