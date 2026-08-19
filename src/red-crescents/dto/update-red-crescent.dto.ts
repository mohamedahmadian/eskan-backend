import { PartialType } from '@nestjs/mapped-types';
import { CreateRedCrescentDto } from './create-red-crescent.dto';

export class UpdateRedCrescentDto extends PartialType(CreateRedCrescentDto) {}
