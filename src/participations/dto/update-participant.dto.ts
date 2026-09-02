import { PartialType } from '@nestjs/mapped-types';
import { CreateCampaignParticipantDto } from './create-participant.dto';

export class UpdateCampaignParticipantDto extends PartialType(
  CreateCampaignParticipantDto,
) {}
