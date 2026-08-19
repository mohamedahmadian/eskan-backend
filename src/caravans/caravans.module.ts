import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CaravansController } from './caravans.controller';
import { CaravansService } from './caravans.service';

@Module({
  imports: [AuthModule],
  controllers: [CaravansController],
  providers: [CaravansService],
  exports: [CaravansService],
})
export class CaravansModule {}
