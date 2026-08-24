import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IssuedLicensesController } from './issued-licenses.controller';
import { IssuedLicensesService } from './issued-licenses.service';

@Module({
  imports: [AuthModule],
  controllers: [IssuedLicensesController],
  providers: [IssuedLicensesService],
})
export class IssuedLicensesModule {}
