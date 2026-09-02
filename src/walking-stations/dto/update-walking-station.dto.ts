import { PartialType } from '@nestjs/mapped-types';
import { CreateWalkingStationDto } from './create-walking-station.dto';

export class UpdateWalkingStationDto extends PartialType(
  CreateWalkingStationDto,
) {}
