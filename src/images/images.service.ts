import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Jimp, JimpMime } from 'jimp';
import { PrismaService } from '../prisma/prisma.service';

/** Reject oversized uploads before processing. */
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
/** Guard against huge pixel buffers (DoS / memory). */
const MAX_SOURCE_PIXELS = 40_000_000;
/** Longest edge after resize (~media-storage rule). */
const MAX_EDGE = 1600;
/** Preferred JPEG quality. */
const JPEG_QUALITY_START = 88;
/** Hard cap on stored BYTEA size after compression. */
const MAX_STORED_BYTES = 900 * 1024;

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

    if (image.width * image.height > MAX_SOURCE_PIXELS) {
      throw new BadRequestException('ابعاد تصویر بیش از حد مجاز است');
    }

    if (image.width > MAX_EDGE || image.height > MAX_EDGE) {
      image.scaleToFit({ w: MAX_EDGE, h: MAX_EDGE });
    }

    const data = await encodeJpegUnderLimit(image);
    if (!data) {
      throw new BadRequestException(
        'پس از بهینه‌سازی، حجم تصویر هنوز بیش از حد مجاز است',
      );
    }

    return this.prisma.storedImage.create({
      data: {
        mimeType: JimpMime.jpeg,
        data: Buffer.from(data),
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

async function encodeJpegUnderLimit(
  image: Awaited<ReturnType<typeof Jimp.read>>,
) {
  const qualities = [
    JPEG_QUALITY_START,
    82,
    76,
    70,
    64,
  ];
  for (const quality of qualities) {
    const data = await image.getBuffer(JimpMime.jpeg, { quality });
    if (data.length <= MAX_STORED_BYTES) {
      return data;
    }
  }
  return null;
}
