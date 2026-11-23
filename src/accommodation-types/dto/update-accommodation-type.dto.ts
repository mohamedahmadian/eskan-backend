import { PartialType } from '@nestjs/mapped-types';
import { CreateAccommodationTypeDto } from './create-accommodation-type.dto';

export class UpdateAccommodationTypeDto extends PartialType(
  CreateAccommodationTypeDto,
) {}
