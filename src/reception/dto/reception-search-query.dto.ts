import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

export class ReceptionSearchQueryDto {
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return '';
    }
    return value.trim();
  })
  @IsString()
  @MinLength(2)
  q!: string;
}
