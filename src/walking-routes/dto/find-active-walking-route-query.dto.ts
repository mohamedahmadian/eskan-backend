import { IsOptional, IsUUID } from 'class-validator';

export class FindActiveWalkingRouteQueryDto {
  @IsOptional()
  @IsUUID('4')
  userId?: string;
}
