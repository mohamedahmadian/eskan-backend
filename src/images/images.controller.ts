import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImagesService } from './images.service';

type ImageUpload = {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
};

@Controller('images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  upload(@UploadedFile() file: ImageUpload) {
    return this.images.store(file);
  }

  @Get(':id')
  async get(@Param('id') id: string, @Res() res: Response) {
    const image = await this.images.find(id);
    res.setHeader('Content-Type', image.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader(
      'Content-Disposition',
      contentDisposition(image.originalName, image.mimeType),
    );
    res.send(Buffer.from(image.data));
  }
}

function contentDisposition(originalName: string | null, mimeType: string) {
  const ext =
    mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/jpeg'
        ? 'jpg'
        : 'bin';
  const name = originalName?.trim() || `image.${ext}`;
  const ascii = name.replace(/[^\w.\-]+/g, '_') || `image.${ext}`;
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
