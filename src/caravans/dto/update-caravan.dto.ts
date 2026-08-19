import { PartialType } from '@nestjs/mapped-types';
import { CreateCaravanDto } from './create-caravan.dto';

export class UpdateCaravanDto extends PartialType(CreateCaravanDto) {}
