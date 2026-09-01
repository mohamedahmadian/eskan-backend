import { IsUUID } from 'class-validator';

export class FindHonoraryCandidatesQueryDto {
  @IsUUID('4')
  serviceTypeId: string;
}
