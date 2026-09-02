import { PartialType } from '@nestjs/mapped-types';
import { CreateParticipationCampaignDto } from './create-campaign.dto';

export class UpdateParticipationCampaignDto extends PartialType(
  CreateParticipationCampaignDto,
) {}
