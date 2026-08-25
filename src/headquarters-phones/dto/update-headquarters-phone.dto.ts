import { PartialType } from '@nestjs/mapped-types';
import { CreateHeadquartersPhoneDto } from './create-headquarters-phone.dto';

export class UpdateHeadquartersPhoneDto extends PartialType(
  CreateHeadquartersPhoneDto,
) {}
