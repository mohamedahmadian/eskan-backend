import { OmitType } from '@nestjs/mapped-types';
import { CreateHonoraryServantDto } from './create-honorary-servant.dto';

export class CreateMyHonoraryServantDto extends OmitType(
  CreateHonoraryServantDto,
  ['userId'] as const,
) {}
