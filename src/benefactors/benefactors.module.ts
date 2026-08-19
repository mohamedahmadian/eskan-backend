import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BenefactorsController } from './benefactors.controller';
import { BenefactorsService } from './benefactors.service';

@Module({
  imports: [AuthModule],
  controllers: [BenefactorsController],
  providers: [BenefactorsService],
})
export class BenefactorsModule {}
