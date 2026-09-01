import { PartialType } from '@nestjs/mapped-types';
import { CreateHonoraryServiceTypeDto } from './create-honorary-service-type.dto';

export class UpdateHonoraryServiceTypeDto extends PartialType(
  CreateHonoraryServiceTypeDto,
) {}
