import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min, ValidateIf } from 'class-validator';
import { emptyToUndefined } from '../../common/dto-transform';
import { PaginationQueryDto } from '../../common/pagination';
import { sortDirections } from '../../common/sort-query';
import {
  honoraryServantSortFields,
  OTHER_SERVICE_TYPE,
  type HonoraryServantSortField,
} from '../honorary-servants.constants';

export class FindHonoraryServantsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value == null) {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : value;
  })
  @IsInt()
  @Min(1300)
  @Max(1600)
  year?: number;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @ValidateIf((_, value) => value != null && value !== OTHER_SERVICE_TYPE)
  @IsUUID('4')
  serviceTypeId?: string;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...honoraryServantSortFields])
  sortBy?: HonoraryServantSortField;

  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsIn([...sortDirections])
  sortDir?: (typeof sortDirections)[number];
}
