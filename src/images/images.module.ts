import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { PublicImagesController } from './public-images.controller';

@Module({
  imports: [AuthModule],
  controllers: [ImagesController, PublicImagesController],
  providers: [ImagesService],
})
export class ImagesModule {}
