import { PartialType } from '@nestjs/mapped-types';
import { CreateHeadquartersInfoDto } from './create-headquarters-info.dto';

export class UpdateHeadquartersInfoDto extends PartialType(
  CreateHeadquartersInfoDto,
) {}
