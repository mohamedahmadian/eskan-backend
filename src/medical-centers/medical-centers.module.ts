import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MedicalCentersController } from './medical-centers.controller';
import { MedicalCentersService } from './medical-centers.service';

@Module({
  imports: [AuthModule],
  controllers: [MedicalCentersController],
  providers: [MedicalCentersService],
})
export class MedicalCentersModule {}
