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
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { FindBankAccountsQueryDto } from './dto/find-bank-accounts-query.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

@Controller('bank-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class BankAccountsController {
  constructor(private readonly bankAccounts: BankAccountsService) {}

  @Get('public')
  @Public()
  @Roles()
  listPublic() {
    return this.bankAccounts.listPublic();
  }

  @Get()
  findAll(@Query() query: FindBankAccountsQueryDto) {
    return this.bankAccounts.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bankAccounts.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBankAccountDto) {
    return this.bankAccounts.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBankAccountDto) {
    return this.bankAccounts.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bankAccounts.remove(id);
  }
}
