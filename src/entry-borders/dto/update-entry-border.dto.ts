import { PartialType } from '@nestjs/mapped-types';
import { CreateEntryBorderDto } from './create-entry-border.dto';

export class UpdateEntryBorderDto extends PartialType(CreateEntryBorderDto) {}
