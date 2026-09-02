import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BankAccountsController } from './bank-accounts.controller';
import { BankAccountsService } from './bank-accounts.service';
import { ParticipationCampaignsController } from './campaigns.controller';
import { ParticipationCampaignsService } from './campaigns.service';
import { CryptoWalletsController } from './crypto-wallets.controller';
import { CryptoWalletsService } from './crypto-wallets.service';
import { CampaignParticipantsController } from './participants.controller';
import { CampaignParticipantsService } from './participants.service';

@Module({
  imports: [AuthModule],
  controllers: [
    BankAccountsController,
    CryptoWalletsController,
    ParticipationCampaignsController,
    CampaignParticipantsController,
  ],
  providers: [
    BankAccountsService,
    CryptoWalletsService,
    ParticipationCampaignsService,
    CampaignParticipantsService,
  ],
})
export class ParticipationsModule {}
