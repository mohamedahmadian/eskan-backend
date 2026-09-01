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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CheckIdentityDto } from './dto/check-identity.dto';
import { FindLocationHistoryQueryDto } from './dto/find-location-history-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserLocationDto } from './dto/update-user-location.dto';
import { UsersService } from './users.service';

type RequestUser = { id: string };

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() user: RequestUser) {
    return this.users.findOne(user.id);
  }

  @Post('identity-check')
  checkIdentity(
    @CurrentUser() user: RequestUser,
    @Body() dto: CheckIdentityDto,
  ) {
    return this.users.checkIdentityTaken({
      nationalId: dto.nationalId,
      phone: dto.phone,
      username: dto.username,
      email: dto.email,
      passportNumber: dto.passportNumber,
      excludeId: user.id,
    });
  }

  @Get('location-history')
  locationHistory(
    @CurrentUser() user: RequestUser,
    @Query() query: FindLocationHistoryQueryDto,
  ) {
    return this.users.findLocationHistory(user.id, query);
  }

  @Delete('location-history/:id')
  removeLocationHistory(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.users.removeLocationHistory(user.id, id);
  }

  @Delete('location-history')
  removeAllLocationHistory(@CurrentUser() user: RequestUser) {
    return this.users.removeAllLocationHistory(user.id);
  }

  @Patch('location')
  updateLocation(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateUserLocationDto,
  ) {
    return this.users.updateLocation(user.id, dto);
  }

  @Patch()
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateUserDto) {
    return this.users.updateOwnAccount(user.id, dto);
  }
}
