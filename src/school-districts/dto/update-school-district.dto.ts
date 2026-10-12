import { PartialType } from '@nestjs/mapped-types';
import { CreateSchoolDistrictDto } from './create-school-district.dto';

export class UpdateSchoolDistrictDto extends PartialType(CreateSchoolDistrictDto) {}
