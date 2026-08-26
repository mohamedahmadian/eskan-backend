import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { emptyToNull } from '../../common/dto-transform';
import { supportRequestStatuses } from '../support-request.constants';
import { CreateSupportRequestDto } from './create-support-request.dto';

export class UpdateSupportRequestDto extends PartialType(
  CreateSupportRequestDto,
) {
  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsIn([...supportRequestStatuses])
  status?: (typeof supportRequestStatuses)[number] | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsUUID()
  handlingOrganizationId?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  handledAt?: string | null;

  @IsOptional()
  @Transform(({ value }) => emptyToNull(value))
  @ValidateIf((_, value) => value != null)
  @IsString()
  handlingNotes?: string | null;
}
