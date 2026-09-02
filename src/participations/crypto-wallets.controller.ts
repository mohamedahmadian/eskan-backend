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
import { CryptoWalletsService } from './crypto-wallets.service';
import { CreateCryptoWalletDto } from './dto/create-crypto-wallet.dto';
import { FindCryptoWalletsQueryDto } from './dto/find-crypto-wallets-query.dto';
import { UpdateCryptoWalletDto } from './dto/update-crypto-wallet.dto';

@Controller('crypto-wallets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class CryptoWalletsController {
  constructor(private readonly cryptoWallets: CryptoWalletsService) {}

  @Get('public')
  @Public()
  @Roles()
  listPublic() {
    return this.cryptoWallets.listPublic();
  }

  @Get()
  findAll(@Query() query: FindCryptoWalletsQueryDto) {
    return this.cryptoWallets.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cryptoWallets.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCryptoWalletDto) {
    return this.cryptoWallets.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCryptoWalletDto) {
    return this.cryptoWallets.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cryptoWallets.remove(id);
  }
}
