import { Controller, Get, Param } from '@nestjs/common';
import { IceVouchersService } from '../ice-vouchers/ice-vouchers.service';
import { ItemQuotaVouchersService } from '../item-quota-vouchers/item-quota-vouchers.service';

@Controller('public/vouchers')
export class PublicVouchersController {
  constructor(
    private readonly itemVouchers: ItemQuotaVouchersService,
    private readonly iceVouchers: IceVouchersService,
  ) {}

  @Get('item/:code')
  findItem(@Param('code') code: string) {
    return this.itemVouchers.findByCode(code);
  }

  @Get('ice/:code')
  findIce(@Param('code') code: string) {
    return this.iceVouchers.findByCode(code);
  }
}
