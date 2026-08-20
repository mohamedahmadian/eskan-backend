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
   * ارسال پیامک از هر ماژول: SmsService را inject کنید و send را صدا بزنید.
   * هر شماره جداگانه به وب‌سرویس ارسال می‌شود.
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

    const results: { success: boolean; recId: string; rawResponse: string }[] = [];
    for (const phone of phones) {
      try {
        const batch = await sendSimpleSms({
          endpoint: settings.endpoint,
          username: settings.username,
          password: settings.password,
          senderNumber: settings.senderNumber,
          phones: [phone],
          body,
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

    const saved = await this.saveResults(phones, body, results, input.sentById);
    const failed = saved.filter((item) => item.status === SmsStatus.FAILED);
    if (failed.length === saved.length) {
      throw new BadGatewayException(
        failed[0]?.providerResponse || 'ارسال پیامک ناموفق بود',
      );
    }

    return saved.length === 1 ? saved[0] : saved;
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
