import { PartialType } from '@nestjs/mapped-types';
import { CreateBenefactorDto } from './create-benefactor.dto';

export class UpdateBenefactorDto extends PartialType(CreateBenefactorDto) {}
