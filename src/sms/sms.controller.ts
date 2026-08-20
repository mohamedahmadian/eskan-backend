import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginationQueryDto } from '../common/pagination';
import { SendSmsDto } from './dto/send-sms.dto';
import { UpdateSmsSettingsDto } from './dto/update-sms-settings.dto';
import { SmsService } from './sms.service';

type RequestUser = { id: string };

@Controller('sms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SmsController {
  constructor(private readonly sms: SmsService) {}

  @Get('settings')
  getSettings() {
    return this.sms.getSettings();
  }

  @Put('settings')
  updateSettings(@Body() dto: UpdateSmsSettingsDto) {
    return this.sms.updateSettings(dto);
  }

  @Get('messages')
  listMessages(@Query() query: PaginationQueryDto) {
    return this.sms.listMessages(query);
  }

  @Post('send')
  @HttpCode(HttpStatus.ACCEPTED)
  send(@Body() dto: SendSmsDto, @CurrentUser() user: RequestUser) {
    return this.sms.send({
      phone: dto.phone,
      phones: dto.phones,
      body: dto.body,
      sentById: user.id,
    });
  }
}
