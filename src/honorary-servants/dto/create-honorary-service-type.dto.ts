import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateHonoraryServiceTypeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  description: string;
}
