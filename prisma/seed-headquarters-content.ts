import { parseIsoDate } from '../src/common/iso-date';
import type { PrismaClient } from '../src/generated/prisma/client';

const newsSeed = [
  {
    id: 'seed-hq-news-1',
    title: 'آغاز ثبت‌نام کاروان‌های پیاده اربعین ۱۴۰۵',
    summary: 'ثبت‌نام کاروان‌های پیاده از مسیرهای غربی کشور از امروز در سامانه اسکان فعال شد.',
    body: 'ستاد جمعیت زائرین پیاده اعلام کرد ثبت‌نام کاروان‌های پیاده اربعین ۱۴۰۵ از امروز آغاز شده است. مدیران کاروان می‌توانند از طریق سامانه اسکان نسبت به تکمیل مشخصات کاروان، مسیر حرکت و تعداد زائران اقدام کنند. مهلت ثبت اولیه تا پایان هفته جاری است و پس از آن ظرفیت مسیرها بر اساس اولویت تکمیل پرونده بررسی می‌شود.',
    publishedAt: parseIsoDate('2026-08-20'),
    isPublished: true,
  },
  {
    id: 'seed-hq-news-2',
    title: 'افزایش ظرفیت اسکان اطراف حرم مطهر',
    summary: 'با همکاری اماکن اسکان جدید، ظرفیت پذیرش زائران در محدوده حرم افزایش یافت.',
    body: 'واحد اسکان ستاد جمعیت با همکاری مجموعه‌های جدید اطراف حرم مطهر رضوی، ظرفیت اسکان زائران را افزایش داد. این ظرفیت بیشتر برای کاروان‌های خانوادگی و زائران بین‌المللی در نظر گرفته شده است. مدیران اسکان موظف‌اند ظرفیت خالی خود را تا پایان هر هفته در سامانه به‌روز کنند.',
    publishedAt: parseIsoDate('2026-08-22'),
    isPublished: true,
  },
  {
    id: 'seed-hq-news-3',
    title: 'ساعات خدمات درمانی و امداد ستاد اعلام شد',
    summary: 'پایگاه‌های بهداشت و درمان ستاد جمعیت در مسیر و مشهد شبانه‌روزی فعال هستند.',
    body: 'واحد بهداشت و درمان ستاد جمعیت ساعات ارائه خدمات در پایگاه‌های مسیر و مشهد مقدس را اعلام کرد. خدمات اورژانس به‌صورت شبانه‌روزی و ویزیت عمومی از ساعت ۷ صبح تا ۲۳ فعال است. زائران در صورت نیاز می‌توانند از طریق رابط کاروان یا پایگاه‌های مشخص‌شده در سامانه اقدام کنند.',
    publishedAt: parseIsoDate('2026-08-25'),
    isPublished: true,
  },
  {
    id: 'seed-hq-news-4',
    title: 'مراسم استقبال از زائران بین‌المللی در مرز دوغارون',
    summary: 'ستاد جمعیت برنامه استقبال و راهنمایی زائران ورودی از مرز دوغارون را برگزار می‌کند.',
    body: 'نمایندگان ستاد جمعیت در مرز ورودی دوغارون از زائران بین‌المللی استقبال می‌کنند. خدمات شامل راهنمایی مسیر، معرفی ایستگاه‌های استراحت و هماهنگی اسکان در مشهد است. مدیران کاروان‌های بین‌المللی لازم است زمان ورود خود را حداقل ۴۸ ساعت پیش از رسیدن به مرز در سامانه ثبت کنند.',
    publishedAt: parseIsoDate('2026-08-28'),
    isPublished: true,
  },
  {
    id: 'seed-hq-news-5',
    title: 'تمدید مهلت صدور مجوز تشرف',
    summary: 'مهلت صدور مجوز تشرف برای کاروان‌هایی که پرونده ناقص دارند سه روز تمدید شد.',
    body: 'با توجه به حجم درخواست‌ها، ستاد جمعیت مهلت صدور مجوز تشرف را سه روز تمدید کرد. کاروان‌هایی که هنوز مدارک هویتی یا فهرست زائران را تکمیل نکرده‌اند باید تا پایان مهلت جدید نسبت به رفع نقص اقدام کنند. پرونده‌های ناقص پس از این تاریخ از فرآیند جانمایی خارج می‌شوند.',
    publishedAt: parseIsoDate('2026-08-30'),
    isPublished: false,
  },
];

const announcementSeed: {
  id: string;
  title: string;
  body: string;
  audience: 'PILGRIMS' | 'CARAVAN_MANAGERS' | 'ACCOMMODATION_MANAGERS';
  publishedAt: Date;
  isPublished: boolean;
}[] = [
  {
    id: 'seed-hq-announcement-1',
    title: 'همراه داشتن کارت ملی هنگام پذیرش الزامی است',
    body: 'همه زائران هنگام مراجعه به واحد پذیرش ستاد جمعیت باید کارت ملی یا گذرنامه معتبر همراه داشته باشند. بدون مدرک هویتی امکان تشکیل یا تکمیل پرونده زیارتی وجود ندارد.',
    audience: 'PILGRIMS',
    publishedAt: parseIsoDate('2026-08-18'),
    isPublished: true,
  },
  {
    id: 'seed-hq-announcement-2',
    title: 'ساعات توزیع وعده غذایی در موکب‌ها',
    body: 'توزیع وعده ناهار از ساعت ۱۲ تا ۱۴ و شام از ساعت ۱۹ تا ۲۱ انجام می‌شود. زائران کارت یا کد پرونده زیارتی خود را هنگام دریافت غذا همراه داشته باشند.',
    audience: 'PILGRIMS',
    publishedAt: parseIsoDate('2026-08-21'),
    isPublished: true,
  },
  {
    id: 'seed-hq-announcement-3',
    title: 'مهلت ثبت نهایی اسامی زائران کاروان',
    body: 'مدیران کاروان باید فهرست نهایی زائران را تا ۴۸ ساعت پیش از حرکت در سامانه ثبت و تأیید کنند. افزودن زائر پس از این مهلت تنها با هماهنگی واحد پذیرش امکان‌پذیر است.',
    audience: 'CARAVAN_MANAGERS',
    publishedAt: parseIsoDate('2026-08-19'),
    isPublished: true,
  },
  {
    id: 'seed-hq-announcement-4',
    title: 'جلسه هماهنگی مدیران کاروان',
    body: 'جلسه هماهنگی مدیران کاروان روز سه‌شنبه ساعت ۱۰ صبح در سالن اجتماعات ستاد جمعیت برگزار می‌شود. حضور مدیر یا نماینده معرفی‌شده کاروان الزامی است.',
    audience: 'CARAVAN_MANAGERS',
    publishedAt: parseIsoDate('2026-08-24'),
    isPublished: true,
  },
  {
    id: 'seed-hq-announcement-5',
    title: 'اعلام ظرفیت خالی اسکان تا پایان هفته',
    body: 'مدیران اسکان موظف‌اند ظرفیت خالی مرد، زن و خانوادگی را تا پایان هر هفته در سامانه به‌روز کنند. عدم به‌روزرسانی ظرفیت، جانمایی کاروان‌ها را با تأخیر مواجه می‌کند.',
    audience: 'ACCOMMODATION_MANAGERS',
    publishedAt: parseIsoDate('2026-08-23'),
    isPublished: true,
  },
  {
    id: 'seed-hq-announcement-6',
    title: 'دستورالعمل بهداشت اماکن اسکان',
    body: 'رعایت دستورالعمل بهداشت اماکن اسکان شامل ضدعفونی روزانه فضاهای عمومی، تهویه مناسب و جداسازی زائران بیمار الزامی است. بازرسی واحد بهداشت از روز شنبه آغاز می‌شود.',
    audience: 'ACCOMMODATION_MANAGERS',
    publishedAt: parseIsoDate('2026-08-27'),
    isPublished: true,
  },
];

export async function seedHeadquartersContent(prisma: PrismaClient) {
  for (const item of newsSeed) {
    await prisma.headquartersNews.upsert({
      where: { id: item.id },
      update: {
        title: item.title,
        summary: item.summary,
        body: item.body,
        publishedAt: item.publishedAt,
        isPublished: item.isPublished,
      },
      create: item,
    });
  }
  for (const item of announcementSeed) {
    await prisma.headquartersAnnouncement.upsert({
      where: { id: item.id },
      update: {
        title: item.title,
        body: item.body,
        audience: item.audience,
        publishedAt: item.publishedAt,
        isPublished: item.isPublished,
      },
      create: item,
    });
  }
}
