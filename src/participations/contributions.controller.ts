import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ContributionsService } from './contributions.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { FindContributionGoodsReportQueryDto } from './dto/find-contribution-goods-report-query.dto';
import { FindContributionReportQueryDto } from './dto/find-contribution-report-query.dto';
import { FindContributionsQueryDto } from './dto/find-contributions-query.dto';
import { UpdateContributionDto } from './dto/update-contribution.dto';

@Controller('contributions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ContributionsController {
  constructor(private readonly contributions: ContributionsService) {}

  @Get()
  findAll(@Query() query: FindContributionsQueryDto) {
    return this.contributions.findAll(query);
  }

  @Get('report')
  report(@Query() query: FindContributionReportQueryDto) {
    return this.contributions.report(query);
  }

  @Get('goods-report')
  goodsReport(@Query() query: FindContributionGoodsReportQueryDto) {
    return this.contributions.goodsReport(query);
  }

  @Get('export')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    "attachment; filename=\"contributions.xlsx\"; filename*=UTF-8''%D9%85%D8%B4%D8%A7%D8%B1%DA%A9%D8%AA%E2%80%8C%D9%87%D8%A7.xlsx",
  )
  async export(@Query() query: FindContributionsQueryDto) {
    const buffer = await this.contributions.exportExcel(query);
    return new StreamableFile(buffer);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.contributions.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateContributionDto) {
    return this.contributions.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContributionDto,
  ) {
    return this.contributions.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.contributions.remove(id);
  }
}
