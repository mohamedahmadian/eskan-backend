import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_EDGE = 1600;

type ImageUpload = {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
};

@Injectable()
export class ImagesService {
  constructor(private readonly prisma: PrismaService) {}

  async store(file: ImageUpload) {
    if (!file?.buffer) {
      throw new BadRequestException('فایل تصویر ارسال نشده است');
    }
    if (file.size > MAX_INPUT_BYTES) {
      throw new BadRequestException('حجم تصویر بیش از حد مجاز است');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('فقط فایل تصویر مجاز است');
    }

    const compressed = await sharp(file.buffer)
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    return this.prisma.storedImage.create({
      data: {
        mimeType: 'image/webp',
        data: compressed.data,
        byteSize: compressed.data.length,
        width: compressed.info.width,
        height: compressed.info.height,
        originalName: file.originalname,
      },
      select: {
        id: true,
        mimeType: true,
        byteSize: true,
        width: true,
        height: true,
      },
    });
  }

  async find(id: string) {
    const image = await this.prisma.storedImage.findUnique({ where: { id } });
    if (!image) {
      throw new NotFoundException();
    }
    return image;
  }
}
