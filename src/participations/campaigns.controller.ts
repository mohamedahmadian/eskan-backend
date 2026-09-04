import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BankAccountsService } from './bank-accounts.service';
import { ParticipationCampaignsService } from './campaigns.service';
import { CryptoWalletsService } from './crypto-wallets.service';
import { CreateParticipationCampaignDto } from './dto/create-campaign.dto';
import { FindCampaignReportQueryDto } from './dto/find-campaign-report-query.dto';
import { FindParticipationCampaignsQueryDto } from './dto/find-campaigns-query.dto';
import { UpdateParticipationCampaignDto } from './dto/update-campaign.dto';

@Controller('participation-campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ParticipationCampaignsController {
  constructor(
    private readonly campaigns: ParticipationCampaignsService,
    private readonly bankAccounts: BankAccountsService,
    private readonly cryptoWallets: CryptoWalletsService,
  ) {}

  @Get('showcase')
  showcase() {
    return this.campaigns.showcase();
  }

  @Get('public')
  @Public()
  @Roles()
  showcasePublic() {
    return this.campaigns.showcasePublic();
  }

  @Get('public/payment-methods')
  @Public()
  @Roles()
  async listPublicPaymentMethods() {
    const [bankAccounts, cryptoWallets] = await Promise.all([
      this.bankAccounts.listPublic(),
      this.cryptoWallets.listPublic(),
    ]);
    return { bankAccounts, cryptoWallets };
  }

  @Get('public/:id')
  @Public()
  @Roles()
  findPublicOne(@Param('id') id: string) {
    return this.campaigns.findPublicOne(id);
  }

  @Get()
  findAll(@Query() query: FindParticipationCampaignsQueryDto) {
    return this.campaigns.findAll(query);
  }

  @Get('report')
  report(@Query() query: FindCampaignReportQueryDto) {
    return this.campaigns.report(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaigns.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateParticipationCampaignDto) {
    return this.campaigns.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateParticipationCampaignDto,
  ) {
    return this.campaigns.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.campaigns.remove(id);
  }
}
