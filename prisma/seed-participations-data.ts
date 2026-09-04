import type { PrismaClient } from '../src/generated/prisma/client';

const BANKS = [
  {
    id: 'a1b2c3d4-e5f6-4a11-8b11-000000000001',
    bankName: 'بانک ملی ایران',
    accountNumber: '0108123456789',
    cardNumber: '6037991234567890',
    iban: 'IR120170000000108123456789',
    isActive: true,
  },
  {
    id: 'a1b2c3d4-e5f6-4a11-8b11-000000000002',
    bankName: 'بانک ملت',
    accountNumber: '6104331122003344',
    cardNumber: '6104331122003344',
    iban: 'IR270120020000006104331122',
    isActive: true,
  },
  {
    id: 'a1b2c3d4-e5f6-4a11-8b11-000000000003',
    bankName: 'بانک صادرات ایران',
    accountNumber: '0198765432101',
    cardNumber: '6274889988776655',
    iban: 'IR540190000000198765432101',
    isActive: true,
  },
  {
    id: 'a1b2c3d4-e5f6-4a11-8b11-000000000004',
    bankName: 'بانک قرض‌الحسنه رسالت',
    accountNumber: '5041720011223344',
    cardNumber: '5041720011223344',
    iban: 'IR700700000000504172001122',
    isActive: false,
  },
] as const;

const WALLETS = [
  {
    id: 'a1b2c3d4-e5f6-4a22-8b22-000000000001',
    currency: 'USDT',
    network: 'TRC20',
    address: 'TXk9pQ2mN7vR4sW8cL1dH6fA3bE5yU0zJ2',
    label: 'کیف تتر ستاد',
    isActive: true,
  },
  {
    id: 'a1b2c3d4-e5f6-4a22-8b22-000000000002',
    currency: 'BTC',
    network: 'Bitcoin',
    address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    label: 'کیف بیت‌کوین',
    isActive: true,
  },
  {
    id: 'a1b2c3d4-e5f6-4a22-8b22-000000000003',
    currency: 'ETH',
    network: 'ERC20',
    address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    label: 'کیف اتریوم',
    isActive: true,
  },
  {
    id: 'a1b2c3d4-e5f6-4a22-8b22-000000000004',
    currency: 'TON',
    network: 'TON',
    address: 'UQBvI0aFLnw2QbZgjMPCLRdtRHxhUyinQudg6sdiohIwg5jL',
    label: 'کیف تون',
    isActive: true,
  },
] as const;

const CAMPAIGNS = [
  {
    id: 'a1b2c3d4-e5f6-4a33-8b33-000000000001',
    name: 'پویش اطعام زائران پیاده',
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    endDate: new Date('2026-10-15T00:00:00.000Z'),
    description:
      'تهیه غذای گرم برای زائران پیاده در مسیرهای منتهی به حرم مطهر. هر سهم برابر یک وعده غذاست.',
    isActive: true,
    totalAmount: 100_000_000,
    sharePrice: 10_000,
    bankAccountId: BANKS[0].id,
    cryptoWalletId: null,
  },
  {
    id: 'a1b2c3d4-e5f6-4a33-8b33-000000000002',
    name: 'پویش اسکان خانواده‌های کم‌برخوردار',
    startDate: new Date('2026-07-15T00:00:00.000Z'),
    endDate: new Date('2026-09-30T00:00:00.000Z'),
    description:
      'کمک به تأمین هزینه اسکان خانواده‌هایی که توان پرداخت کامل اقامت مشهد را ندارند.',
    isActive: true,
    totalAmount: 50_000_000,
    sharePrice: 50_000,
    bankAccountId: BANKS[1].id,
    cryptoWalletId: null,
  },
  {
    id: 'a1b2c3d4-e5f6-4a33-8b33-000000000003',
    name: 'پویش حمایت از زائران بین‌المللی',
    startDate: new Date('2026-06-01T00:00:00.000Z'),
    endDate: new Date('2026-12-31T00:00:00.000Z'),
    description:
      'پشتیبانی از زائران غیرایرانی برای خدمات ترجمه، سیم‌کارت و کارت بانکی. امکان مشارکت با ارز دیجیتال.',
    isActive: true,
    totalAmount: 200_000_000,
    sharePrice: 100_000,
    bankAccountId: BANKS[2].id,
    cryptoWalletId: WALLETS[0].id,
  },
  {
    id: 'a1b2c3d4-e5f6-4a33-8b33-000000000004',
    name: 'پویش تهیه پتو و لوازم سرمایش',
    startDate: new Date('2026-08-20T00:00:00.000Z'),
    endDate: new Date('2026-11-01T00:00:00.000Z'),
    description:
      'خرید پتو، بالش و وسایل گرمایشی برای اسکان‌های موقت در فصل سرد.',
    isActive: true,
    totalAmount: 5_000_000,
    sharePrice: 5_000,
    bankAccountId: BANKS[0].id,
    cryptoWalletId: WALLETS[3].id,
  },
  {
    id: 'a1b2c3d4-e5f6-4a33-8b33-000000000005',
    name: 'پویش تأمین آب آشامیدنی مسیر پیاده',
    startDate: new Date('2025-03-21T00:00:00.000Z'),
    endDate: new Date('2025-06-21T00:00:00.000Z'),
    description: 'پویش سال گذشته برای توزیع آب بسته‌بندی در ایستگاه‌های مسیر پیاده.',
    isActive: false,
    totalAmount: 2_000_000,
    sharePrice: 2_000,
    bankAccountId: BANKS[2].id,
    cryptoWalletId: null,
  },
] as const;

function splitPersonName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { firstName: 'ناشناس', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

const PARTICIPANTS = [
  { id: 'a1b2c3d4-e5f6-4a66-8b66-000000000001', campaignId: CAMPAIGNS[0].id, fullName: 'علی رضایی', phone: '09121112233', shareCount: 50 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000002', campaignId: CAMPAIGNS[0].id, fullName: 'زهرا محمدی', phone: '09123334455', shareCount: 120 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000003', campaignId: CAMPAIGNS[0].id, fullName: 'حسین کریمی', phone: '09351112233', shareCount: 80 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000004', campaignId: CAMPAIGNS[0].id, fullName: 'فاطمه احمدی', phone: '09125556677', shareCount: 200 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000005', campaignId: CAMPAIGNS[0].id, fullName: 'محمد حسینی', phone: '09201234567', shareCount: 35 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000020', campaignId: CAMPAIGNS[0].id, fullName: 'سمیه باقری', phone: '09121230001', shareCount: 150 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000021', campaignId: CAMPAIGNS[0].id, fullName: 'محسن نجفی', phone: '09121230002', shareCount: 90 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000022', campaignId: CAMPAIGNS[0].id, fullName: 'الهام رحیمی', phone: '09121230003', shareCount: 220 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000023', campaignId: CAMPAIGNS[0].id, fullName: 'پیمان یوسفی', phone: '09121230004', shareCount: 60 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000024', campaignId: CAMPAIGNS[0].id, fullName: 'ناهید فرهادی', phone: '09121230005', shareCount: 180 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000025', campaignId: CAMPAIGNS[0].id, fullName: 'کامران عزیزی', phone: '09121230006', shareCount: 75 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000026', campaignId: CAMPAIGNS[0].id, fullName: 'شیما کاویانی', phone: '09121230007', shareCount: 110 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000006', campaignId: CAMPAIGNS[1].id, fullName: 'مریم نوری', phone: '09127654321', shareCount: 10 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000007', campaignId: CAMPAIGNS[1].id, fullName: 'رضا اکبری', phone: '09361234567', shareCount: 4 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000008', campaignId: CAMPAIGNS[1].id, fullName: 'سارا جعفری', phone: '09139876543', shareCount: 8 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000009', campaignId: CAMPAIGNS[1].id, fullName: 'امیر قاسمی', phone: '09012345678', shareCount: 20 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000027', campaignId: CAMPAIGNS[1].id, fullName: 'فریده سلیمانی', phone: '09123440011', shareCount: 15 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000028', campaignId: CAMPAIGNS[1].id, fullName: 'سعید محمودی', phone: '09123440012', shareCount: 25 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000029', campaignId: CAMPAIGNS[1].id, fullName: 'آرزو حیدری', phone: '09123440013', shareCount: 12 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000030', campaignId: CAMPAIGNS[1].id, fullName: 'بهروز نیکنام', phone: '09123440014', shareCount: 30 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000031', campaignId: CAMPAIGNS[1].id, fullName: 'گلناز امینی', phone: '09123440015', shareCount: 18 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000010', campaignId: CAMPAIGNS[2].id, fullName: 'Ahmed Al-Khalidi', phone: '09120001122', shareCount: 5 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000011', campaignId: CAMPAIGNS[2].id, fullName: 'فاطمه علوی', phone: '09124445566', shareCount: 12 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000012', campaignId: CAMPAIGNS[2].id, fullName: 'یوسف عباسی', phone: '09330001122', shareCount: 3 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000032', campaignId: CAMPAIGNS[2].id, fullName: 'حسن الهاشمی', phone: '09125550021', shareCount: 20 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000033', campaignId: CAMPAIGNS[2].id, fullName: 'Maryam Al-Sadr', phone: '09125550022', shareCount: 8 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000034', campaignId: CAMPAIGNS[2].id, fullName: 'کاظم تقوی', phone: '09125550023', shareCount: 15 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000035', campaignId: CAMPAIGNS[2].id, fullName: 'زینب موسوی', phone: '09125550024', shareCount: 25 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000036', campaignId: CAMPAIGNS[2].id, fullName: 'عبدالله رضوی', phone: '09125550025', shareCount: 10 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000037', campaignId: CAMPAIGNS[2].id, fullName: 'هدی شریعتی', phone: '09125550026', shareCount: 18 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000013', campaignId: CAMPAIGNS[3].id, fullName: 'نرگس شریفی', phone: '09127778899', shareCount: 40 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000014', campaignId: CAMPAIGNS[3].id, fullName: 'مهدی صادقی', phone: '09223334455', shareCount: 80 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000015', campaignId: CAMPAIGNS[3].id, fullName: 'لیلا موسوی', phone: '09126667788', shareCount: 25 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000016', campaignId: CAMPAIGNS[3].id, fullName: 'کاظم رستمی', phone: '09359998877', shareCount: 60 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000038', campaignId: CAMPAIGNS[3].id, fullName: 'پروین صالحی', phone: '09126660031', shareCount: 35 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000039', campaignId: CAMPAIGNS[3].id, fullName: 'داریوش کریمی', phone: '09126660032', shareCount: 50 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000040', campaignId: CAMPAIGNS[3].id, fullName: 'مینا رفیعی', phone: '09126660033', shareCount: 45 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000041', campaignId: CAMPAIGNS[3].id, fullName: 'ناصر قلی‌پور', phone: '09126660034', shareCount: 70 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000017', campaignId: CAMPAIGNS[4].id, fullName: 'حسن طاهری', phone: '09121110000', shareCount: 400 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000018', campaignId: CAMPAIGNS[4].id, fullName: 'زینب کاظمی', phone: '09123330000', shareCount: 350 },
  { id: 'a1b2c3d4-e5f6-4a44-8b44-000000000019', campaignId: CAMPAIGNS[4].id, fullName: 'جواد مرادی', phone: '09351110000', shareCount: 250 },
] as const;

const FILL_NAMES = [
  'احمد توکلی',
  'فرشته نادری',
  'مجید اسماعیلی',
  'سپیده قربانی',
  'حمیدرضا فلاح',
  'مهسا نعمتی',
  'علیرضا شفیعی',
  'پریسا محمدپور',
];

export async function seedParticipationsData(prisma: PrismaClient) {
  for (const item of BANKS) {
    await prisma.bankAccount.upsert({
      where: { id: item.id },
      update: {
        bankName: item.bankName,
        accountNumber: item.accountNumber,
        cardNumber: item.cardNumber,
        iban: item.iban,
        isActive: item.isActive,
      },
      create: item,
    });
  }

  for (const item of WALLETS) {
    await prisma.cryptoWallet.upsert({
      where: { id: item.id },
      update: {
        currency: item.currency,
        network: item.network,
        address: item.address,
        label: item.label,
        isActive: item.isActive,
      },
      create: item,
    });
  }

  const sharePriceByCampaign = new Map(
    CAMPAIGNS.map((item) => [item.id, item.sharePrice]),
  );

  for (const item of CAMPAIGNS) {
    await prisma.participationCampaign.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        startDate: item.startDate,
        endDate: item.endDate,
        description: item.description,
        isActive: item.isActive,
        totalAmount: item.totalAmount,
        sharePrice: item.sharePrice,
        bankAccountId: item.bankAccountId,
        cryptoWalletId: item.cryptoWalletId,
      },
      create: item,
    });
  }

  for (const item of PARTICIPANTS) {
    const names = splitPersonName(item.fullName);
    const benefactorId = item.id.replace('8b66', '8b77').replace('8b44', '8b77');
    await prisma.benefactor.upsert({
      where: { id: benefactorId },
      update: {
        firstName: names.firstName,
        lastName: names.lastName,
        name: item.fullName,
        phone: item.phone,
      },
      create: {
        id: benefactorId,
        firstName: names.firstName,
        lastName: names.lastName,
        name: item.fullName,
        phone: item.phone,
      },
    });
    const sharePrice = sharePriceByCampaign.get(item.campaignId) ?? 0;
    await prisma.contribution.upsert({
      where: { id: item.id },
      update: {
        type: 'CASH',
        benefactorId,
        amount: item.shareCount * sharePrice,
        shareCount: item.shareCount,
        campaignId: item.campaignId,
      },
      create: {
        id: item.id,
        type: 'CASH',
        benefactorId,
        amount: item.shareCount * sharePrice,
        shareCount: item.shareCount,
        campaignId: item.campaignId,
      },
    });
  }

  const emptyCampaigns = await prisma.participationCampaign.findMany({
    where: { contributions: { none: { type: 'CASH' } } },
    select: { id: true, sharePrice: true, totalAmount: true, name: true },
  });
  for (const campaign of emptyCampaigns) {
    const totalShares = campaign.sharePrice > 0
      ? Math.floor(campaign.totalAmount / campaign.sharePrice)
      : 0;
    const targetShares = Math.max(8, Math.floor(totalShares * 0.35));
    let remaining = targetShares;
    for (let index = 0; index < FILL_NAMES.length && remaining > 0; index += 1) {
      const shareCount = Math.max(
        1,
        Math.min(remaining, Math.ceil(targetShares / FILL_NAMES.length) + (index % 3) * 2),
      );
      remaining -= shareCount;
      const fullName = FILL_NAMES[index];
      const names = splitPersonName(fullName);
      const benefactor = await prisma.benefactor.create({
        data: {
          firstName: names.firstName,
          lastName: names.lastName,
          name: fullName,
          phone: `0912${String(4000000 + index).slice(-7)}`,
        },
      });
      await prisma.contribution.create({
        data: {
          type: 'CASH',
          benefactorId: benefactor.id,
          amount: shareCount * campaign.sharePrice,
          shareCount,
          campaignId: campaign.id,
        },
      });
    }
  }
}
