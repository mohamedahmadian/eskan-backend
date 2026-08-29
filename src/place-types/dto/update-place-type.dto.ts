import { PartialType } from '@nestjs/mapped-types';
import { CreatePlaceTypeDto } from './create-place-type.dto';

export class UpdatePlaceTypeDto extends PartialType(CreatePlaceTypeDto) {}
