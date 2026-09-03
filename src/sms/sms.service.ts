import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { phoneLookupValues } from '../common/phone';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  type PaginationQueryDto,
} from '../common/pagination';
import { Prisma, SmsStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSmsSettingsDto } from './dto/update-sms-settings.dto';
import { sendSimpleSms, clipProviderResponse } from './pejvak-soap.client';
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

export type QueuedSmsResult = {
  queued: true;
  recipientCount: number;
};

type PreparedSmsJob = {
  endpoint: string;
  username: string;
  password: string;
  senderNumber: string;
  phones: string[];
  body: string;
  sentById?: string;
};

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findEitaaByPhone(phone: string) {
    const values = phoneLookupValues(phone);
    if (!values.length) {
      throw new BadRequestException('شماره تلفن معتبر نیست');
    }
    const user = await this.prisma.user.findFirst({
      where: { OR: values.map((item) => ({ phone: item })) },
      select: { fullName: true, eitaa: true },
    });
    if (!user) {
      throw new NotFoundException('کاربری با این شماره تلفن یافت نشد');
    }
    return {
      fullName: user.fullName,
      eitaa: user.eitaa,
    };
  }

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
    const q = query.q?.trim();
    const statusMatch =
      q && ['SENT', 'FAILED'].includes(q.toUpperCase())
        ? (q.toUpperCase() as SmsStatus)
        : undefined;

    let where: Prisma.SmsMessageWhereInput | undefined;
    if (q) {
      const recipientPhones = await this.recipientPhonesMatching(q);
      where = {
        OR: [
          { phone: containsInsensitive(q) },
          { body: containsInsensitive(q) },
          { providerResponse: containsInsensitive(q) },
          ...(recipientPhones.length ? [{ phone: { in: recipientPhones } }] : []),
          ...(statusMatch ? [{ status: statusMatch }] : []),
        ],
      };
    }

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
    return paginatedResult(await this.withRecipients(items), total, page, pageSize);
  }

  /**
   * صف ارسال پیامک: اعتبارسنجی سریع است و پاسخ بلافاصله برمی‌گردد.
   * تماس با وب‌سرویس و ذخیره نتیجه در پس‌زمینه انجام می‌شود.
   */
  async send(input: SendSmsInput): Promise<QueuedSmsResult> {
    const job = await this.prepareSend(input);
    setImmediate(() => {
      void this.deliver(job);
    });
    return { queued: true, recipientCount: job.phones.length };
  }

  async assertConfigured() {
    const settings = await this.ensureSettings();
    if (!settings.username || !settings.password || !settings.senderNumber || !settings.endpoint) {
      throw new BadRequestException('تنظیمات پیامک کامل نیست');
    }
  }

  private async prepareSend(input: SendSmsInput): Promise<PreparedSmsJob> {
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

    return {
      endpoint: settings.endpoint,
      username: settings.username,
      password: settings.password,
      senderNumber: settings.senderNumber,
      phones,
      body,
      sentById: input.sentById,
    };
  }

  private async deliver(job: PreparedSmsJob) {
    const results: { success: boolean; recId: string; rawResponse: string }[] = [];
    try {
      for (const phone of job.phones) {
        try {
          const batch = await sendSimpleSms({
            endpoint: job.endpoint,
            username: job.username,
            password: job.password,
            senderNumber: job.senderNumber,
            phones: [phone],
            body: job.body,
          });
          results.push(
            batch[0] ?? {
              success: false,
              recId: 'بدون پاسخ',
              rawResponse: 'بدون پاسخ',
            },
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'ارتباط با وب‌سرویس پیامک برقرار نشد';
          results.push({ success: false, recId: message, rawResponse: message });
        }
      }

      await this.saveResults(job.phones, job.body, results, job.sentById);
    } catch (error) {
      this.logger.error(
        `ارسال پس‌زمینه پیامک برای ${job.phones.length} گیرنده ناموفق بود`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async recipientPhonesMatching(q: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        phone: { not: null },
        OR: [
          { fullName: containsInsensitive(q) },
          { firstName: containsInsensitive(q) },
          { lastName: containsInsensitive(q) },
        ],
      },
      select: { phone: true },
    });
    const phones = new Set<string>();
    for (const user of users) {
      if (!user.phone) {
        continue;
      }
      phones.add(user.phone);
      const normalized = normalizePhone(user.phone);
      if (normalized) {
        phones.add(normalized);
      }
    }
    return [...phones];
  }

  private async withRecipients<T extends { phone: string }>(items: T[]) {
    const phones = [...new Set(items.map((item) => item.phone))];
    if (!phones.length) {
      return items.map((item) => ({ ...item, recipientName: null as string | null }));
    }

    const lookupPhones = [
      ...new Set(
        phones.flatMap((phone) => {
          const normalized = normalizePhone(phone);
          return normalized && normalized !== phone ? [phone, normalized] : [phone];
        }),
      ),
    ];
    const users = await this.prisma.user.findMany({
      where: { phone: { in: lookupPhones } },
      select: { phone: true, fullName: true },
    });
    const byPhone = new Map<string, string>();
    for (const user of users) {
      if (!user.phone) {
        continue;
      }
      byPhone.set(user.phone, user.fullName);
      byPhone.set(normalizePhone(user.phone), user.fullName);
    }

    return items.map((item) => ({
      ...item,
      recipientName:
        byPhone.get(item.phone) ?? byPhone.get(normalizePhone(item.phone)) ?? null,
    }));
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
    results: { success: boolean; recId: string; rawResponse: string }[],
    sentById?: string,
  ) {
    const rows = await Promise.all(
      phones.map((phone, index) => {
        const result = results[index] ?? {
          success: false,
          recId: 'بدون پاسخ',
          rawResponse: 'بدون پاسخ',
        };
        return this.prisma.smsMessage.create({
          data: {
            phone,
            body,
            status: result.success ? SmsStatus.SENT : SmsStatus.FAILED,
            providerResponse: clipProviderResponse(
              result.rawResponse || result.recId,
            ),
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
