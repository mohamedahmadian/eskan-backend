import { PartialType } from '@nestjs/mapped-types';
import { CreateHeadquartersNewsDto } from './create-headquarters-news.dto';

export class UpdateHeadquartersNewsDto extends PartialType(
  CreateHeadquartersNewsDto,
) {}
