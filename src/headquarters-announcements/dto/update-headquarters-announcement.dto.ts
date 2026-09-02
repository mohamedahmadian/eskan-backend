import { PartialType } from '@nestjs/mapped-types';
import { CreateHeadquartersAnnouncementDto } from './create-headquarters-announcement.dto';

export class UpdateHeadquartersAnnouncementDto extends PartialType(
  CreateHeadquartersAnnouncementDto,
) {}
