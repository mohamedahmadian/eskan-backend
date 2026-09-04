import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { toBoolean } from '../../common/dto-transform';

export class CreateContributionGoodDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value, true))
  @IsBoolean()
  isActive?: boolean;
}
