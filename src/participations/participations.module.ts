import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BankAccountsController } from './bank-accounts.controller';
import { BankAccountsService } from './bank-accounts.service';
import { ParticipationCampaignsController } from './campaigns.controller';
import { ParticipationCampaignsService } from './campaigns.service';
import { ContributionGoodsController } from './contribution-goods.controller';
import { ContributionGoodsService } from './contribution-goods.service';
import { ContributionsController } from './contributions.controller';
import { ContributionsService } from './contributions.service';
import { CryptoWalletsController } from './crypto-wallets.controller';
import { CryptoWalletsService } from './crypto-wallets.service';
import { GoodsUnitsController } from './goods-units.controller';
import { GoodsUnitsService } from './goods-units.service';

@Module({
  imports: [AuthModule],
  controllers: [
    BankAccountsController,
    CryptoWalletsController,
    ParticipationCampaignsController,
    ContributionsController,
    ContributionGoodsController,
    GoodsUnitsController,
  ],
  providers: [
    BankAccountsService,
    CryptoWalletsService,
    ParticipationCampaignsService,
    ContributionsService,
    ContributionGoodsService,
    GoodsUnitsService,
  ],
})
export class ParticipationsModule {}
