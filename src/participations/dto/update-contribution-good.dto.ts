import { PartialType } from '@nestjs/mapped-types';
import { CreateContributionGoodDto } from './create-contribution-good.dto';

export class UpdateContributionGoodDto extends PartialType(CreateContributionGoodDto) {}
