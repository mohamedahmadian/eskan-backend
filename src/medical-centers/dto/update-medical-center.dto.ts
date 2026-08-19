import { PartialType } from '@nestjs/mapped-types';
import { CreateMedicalCenterDto } from './create-medical-center.dto';

export class UpdateMedicalCenterDto extends PartialType(CreateMedicalCenterDto) {}
