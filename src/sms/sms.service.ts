import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  type PaginationQueryDto,
} from '../common/pagination';
import { Prisma, SmsStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSmsSettingsDto } from './dto/update-sms-settings.dto';
import { sendSimpleSms } from './pejvak-soap.client';
import { normalizePhone } from './phone.util';

const SETTINGS_ID = 'default';

const messageSelect = {
  id: true,
  phone: true,
  body: true,
  status: true,
  providerResponse: true,
  createdAt: true,
} satisfies Prisma.SmsMessageSelect;

export type SendSmsInput = {
  phone?: string;
  phones?: string[];
  body: string;
  sentById?: string;
};

@Injectable()
export class SmsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const settings = await this.ensureSettings();
    return {
      endpoint: settings.endpoint,
      senderNumber: settings.senderNumber,
      username: settings.username,
      hasPassword: Boolean(settings.password),
    };
  }

  async updateSettings(dto: UpdateSmsSettingsDto) {
    const current = await this.ensureSettings();
    const password = dto.password?.trim() ? dto.password : current.password;

    if (!password) {
      throw new BadRequestException('رمز عبور وب‌سرویس پیامک الزامی است');
    }

    const settings = await this.prisma.smsSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        endpoint: dto.endpoint.trim(),
        senderNumber: dto.senderNumber.trim(),
        username: dto.username.trim(),
        password,
      },
    });

    return {
      endpoint: settings.endpoint,
      senderNumber: settings.senderNumber,
      username: settings.username,
      hasPassword: Boolean(settings.password),
    };
  }

  async listMessages(query: PaginationQueryDto) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const statusMatch =
      query.q && ['SENT', 'FAILED'].includes(query.q.trim().toUpperCase())
        ? (query.q.trim().toUpperCase() as SmsStatus)
        : undefined;
    const where = query.q
      ? {
          OR: [
            { phone: containsInsensitive(query.q) },
            { body: containsInsensitive(query.q) },
            { providerResponse: containsInsensitive(query.q) },
            ...(statusMatch ? [{ status: statusMatch }] : []),
          ],
        }
      : undefined;

    const [items, total] = await Promise.all([
      this.prisma.smsMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: messageSelect,
      }),
      this.prisma.smsMessage.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  /**
   * ارسال پیامک از هر ماژول: SmsService را inject کنید و send را صدا بزنید.
   */
  async send(input: SendSmsInput) {
    const settings = await this.ensureSettings();
    if (!settings.username || !settings.password || !settings.senderNumber || !settings.endpoint) {
      throw new BadRequestException('تنظیمات پیامک کامل نیست');
    }

    const phones = this.collectPhones(input);
    if (!phones.length) {
      throw new BadRequestException('شماره گیرنده الزامی است');
    }

    const body = input.body.trim();
    if (!body) {
      throw new BadRequestException('متن پیامک الزامی است');
    }

    let results: { success: boolean; recId: string }[];
    try {
      results = await sendSimpleSms({
        endpoint: settings.endpoint,
        username: settings.username,
        password: settings.password,
        senderNumber: settings.senderNumber,
        phones,
        body,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'ارتباط با وب‌سرویس پیامک برقرار نشد';
      await this.saveResults(
        phones,
        body,
        phones.map(() => ({ success: false, recId: message })),
        input.sentById,
      );
      throw new BadGatewayException(message);
    }

    while (results.length < phones.length) {
      results.push({ success: false, recId: 'بدون پاسخ' });
    }

    const saved = await this.saveResults(phones, body, results, input.sentById);
    const failed = saved.filter((item) => item.status === SmsStatus.FAILED);
    if (failed.length === saved.length) {
      throw new BadGatewayException(
        failed[0]?.providerResponse || 'ارسال پیامک ناموفق بود',
      );
    }

    return saved.length === 1 ? saved[0] : saved;
  }

  private collectPhones(input: SendSmsInput): string[] {
    const raw = [
      ...(input.phone ? [input.phone] : []),
      ...(input.phones ?? []),
    ];
    const unique = [...new Set(raw.map(normalizePhone).filter(Boolean))];
    return unique;
  }

  private async saveResults(
    phones: string[],
    body: string,
    results: { success: boolean; recId: string }[],
    sentById?: string,
  ) {
    const rows = await Promise.all(
      phones.map((phone, index) => {
        const result = results[index] ?? { success: false, recId: 'بدون پاسخ' };
        return this.prisma.smsMessage.create({
          data: {
            phone,
            body,
            status: result.success ? SmsStatus.SENT : SmsStatus.FAILED,
            providerResponse: result.recId,
            sentById,
          },
          select: messageSelect,
        });
      }),
    );
    return rows;
  }

  private async ensureSettings() {
    const existing = await this.prisma.smsSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.smsSettings.create({
      data: {
        id: SETTINGS_ID,
        endpoint: 'http://service.pejvaksoft.com',
        senderNumber: '',
        username: '',
        password: '',
      },
    });
  }
}
