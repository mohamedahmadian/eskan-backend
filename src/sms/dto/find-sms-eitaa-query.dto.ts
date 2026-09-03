import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

export class FindSmsEitaaQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(8)
  phone!: string;
}
