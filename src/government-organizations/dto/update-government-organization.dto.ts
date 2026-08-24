import { PartialType } from '@nestjs/mapped-types';
import { CreateGovernmentOrganizationDto } from './create-government-organization.dto';

export class UpdateGovernmentOrganizationDto extends PartialType(
  CreateGovernmentOrganizationDto,
) {}
