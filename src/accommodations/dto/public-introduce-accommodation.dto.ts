import { IsString, MinLength } from 'class-validator';
import { CreateAccommodationDto } from './create-accommodation.dto';

export class PublicIntroduceAccommodationDto extends CreateAccommodationDto {
  @IsString()
  @MinLength(2)
  introducerFirstName: string;

  @IsString()
  @MinLength(2)
  introducerLastName: string;

  @IsString()
  @MinLength(10)
  introducerPhone: string;
}
