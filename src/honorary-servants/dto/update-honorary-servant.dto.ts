import { PartialType } from '@nestjs/mapped-types';
import { CreateHonoraryServantDto } from './create-honorary-servant.dto';

export class UpdateHonoraryServantDto extends PartialType(
  CreateHonoraryServantDto,
) {}
