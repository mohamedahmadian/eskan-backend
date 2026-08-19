import { PartialType } from '@nestjs/mapped-types';
import { CreateWalkingRouteDto } from './create-walking-route.dto';

export class UpdateWalkingRouteDto extends PartialType(CreateWalkingRouteDto) {}
