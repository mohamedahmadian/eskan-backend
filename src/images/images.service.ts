import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Jimp, JimpMime } from 'jimp';
import { PrismaService } from '../prisma/prisma.service';

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_EDGE = 1600;
const JPEG_QUALITY = 88;

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

    let image;
    try {
      image = await Jimp.read(file.buffer);
    } catch {
      throw new BadRequestException('فایل تصویر نامعتبر است');
    }

    if (image.width > MAX_EDGE || image.height > MAX_EDGE) {
      image.scaleToFit({ w: MAX_EDGE, h: MAX_EDGE });
    }

    const data = await image.getBuffer(JimpMime.jpeg, { quality: JPEG_QUALITY });

    return this.prisma.storedImage.create({
      data: {
        mimeType: JimpMime.jpeg,
        data,
        byteSize: data.length,
        width: image.width,
        height: image.height,
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
