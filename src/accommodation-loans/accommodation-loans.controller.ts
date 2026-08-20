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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateAccommodationLoanDto } from './dto/create-accommodation-loan.dto';
import { FindAccommodationLoansQueryDto } from './dto/find-accommodation-loans-query.dto';
import { FindLoanReportQueryDto } from './dto/find-loan-report-query.dto';
import { UpdateAccommodationLoanDto } from './dto/update-accommodation-loan.dto';
import { AccommodationLoansService } from './accommodation-loans.service';

type RequestUser = {
  id: string;
};

@Controller('accommodation-loans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AccommodationLoansController {
  constructor(private readonly loans: AccommodationLoansService) {}

  @Get()
  findAll(@Query() query: FindAccommodationLoansQueryDto) {
    return this.loans.findAll(query);
  }

  @Get('report')
  report(@Query() query: FindLoanReportQueryDto) {
    return this.loans.report(query.year);
  }

  @Get('mine')
  @Roles('ADMIN', 'ACCOMMODATION_MANAGER')
  findMine(
    @Query() query: FindAccommodationLoansQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.loans.findMine(query, actor.id);
  }

  @Get('mine/:id')
  @Roles('ADMIN', 'ACCOMMODATION_MANAGER')
  findMineOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.loans.findMineOne(id, actor.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.loans.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAccommodationLoanDto) {
    return this.loans.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAccommodationLoanDto) {
    return this.loans.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.loans.remove(id);
  }
}
