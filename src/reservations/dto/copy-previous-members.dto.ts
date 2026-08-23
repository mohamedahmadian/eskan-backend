import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class CopyPreviousMembersDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    return Array.isArray(value) ? value : [value];
  })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds?: string[];
}
