import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export const receptionSearchScopes = ['primary', 'extended'] as const;
export type ReceptionSearchScope = (typeof receptionSearchScopes)[number];
export const RECEPTION_SEARCH_PAGE_SIZE = 20;

export class SearchReceptionQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  q!: string;

  @IsOptional()
  @IsIn(receptionSearchScopes)
  scope?: ReceptionSearchScope;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
