import { IsArray, IsOptional, IsUUID } from 'class-validator';
import { FindPlacementQueueQueryDto } from './find-placement-queue-query.dto';

export class AllocateSystemDto extends FindPlacementQueueQueryDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  ids?: string[];
}
