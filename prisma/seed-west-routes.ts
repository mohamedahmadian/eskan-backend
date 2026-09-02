import 'dotenv/config';
import { Prisma } from '../src/generated/prisma/client';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
  }),
});

const PLACE_SEED_MARK = '[seed-west-routes]';

const placeTypeSeed = [
  { code: 'hospital', nameFa: 'بیمارستان', nameEn: 'Hospital', icon: 'hospital', sortOrder: 1 },
  { code: 'pharmacy', nameFa: 'داروخانه', nameEn: 'Pharmacy', icon: 'pill', sortOrder: 2 },
  { code: 'mosque', nameFa: 'مسجد', nameEn: 'Mosque', icon: 'landmark', sortOrder: 3 },
  { code: 'gas-station', nameFa: 'پمپ بنزین', nameEn: 'Gas station', icon: 'fuel', sortOrder: 4 },
  { code: 'restaurant', nameFa: 'رستوران', nameEn: 'Restaurant', icon: 'utensils-crossed', sortOrder: 5 },
  { code: 'police', nameFa: 'پاسگاه پلیس', nameEn: 'Police station', icon: 'shield', sortOrder: 6 },
  { code: 'red-crescent', nameFa: 'هلال احمر', nameEn: 'Red Crescent', icon: 'heart-handshake', sortOrder: 7 },
];

type StageSpec = {
  provinceFa: string;
  cityFa: string;
  stationName: string;
  toMashhadKm: number;
};

type RouteSpec = {
  name: string;
  borderName: string;
  borderProvinceFa: string;
  borderCityFa: string;
  stages: StageSpec[];
};

const routes: RouteSpec[] = [
  {
    name: 'مسیر پیاده مهران به مشهد',
    borderName: 'مرز مهران',
    borderProvinceFa: 'ایلام',
    borderCityFa: 'مهران',
    stages: [
      { provinceFa: 'ایلام', cityFa: 'مهران', stationName: 'ایستگاه مهران', toMashhadKm: 1480 },
      { provinceFa: 'ایلام', cityFa: 'ایلام', stationName: 'ایستگاه ایلام', toMashhadKm: 1400 },
      { provinceFa: 'کرمانشاه', cityFa: 'اسلام‌آباد غرب', stationName: 'ایستگاه اسلام‌آباد غرب', toMashhadKm: 1280 },
      { provinceFa: 'کرمانشاه', cityFa: 'کرمانشاه', stationName: 'ایستگاه کرمانشاه', toMashhadKm: 1220 },
      { provinceFa: 'کرمانشاه', cityFa: 'کنگاور', stationName: 'ایستگاه کنگاور', toMashhadKm: 1140 },
      { provinceFa: 'همدان', cityFa: 'همدان', stationName: 'ایستگاه همدان', toMashhadKm: 1080 },
      { provinceFa: 'مرکزی', cityFa: 'ساوه', stationName: 'ایستگاه ساوه', toMashhadKm: 920 },
      { provinceFa: 'قم', cityFa: 'قم', stationName: 'ایستگاه قم', toMashhadKm: 840 },
      { provinceFa: 'سمنان', cityFa: 'گرمسار', stationName: 'ایستگاه گرمسار', toMashhadKm: 720 },
      { provinceFa: 'سمنان', cityFa: 'سمنان', stationName: 'ایستگاه سمنان', toMashhadKm: 640 },
      { provinceFa: 'سمنان', cityFa: 'دامغان', stationName: 'ایستگاه دامغان', toMashhadKm: 560 },
      { provinceFa: 'سمنان', cityFa: 'شاهرود', stationName: 'ایستگاه شاهرود', toMashhadKm: 480 },
      { provinceFa: 'خراسان رضوی', cityFa: 'سبزوار', stationName: 'ایستگاه سبزوار', toMashhadKm: 240 },
      { provinceFa: 'خراسان رضوی', cityFa: 'نیشابور', stationName: 'ایستگاه نیشابور', toMashhadKm: 120 },
      { provinceFa: 'خراسان رضوی', cityFa: 'مشهد', stationName: 'ایستگاه مشهد', toMashhadKm: 0 },
    ],
  },
  {
    name: 'مسیر پیاده خسروی به مشهد',
    borderName: 'مرز خسروی',
    borderProvinceFa: 'کرمانشاه',
    borderCityFa: 'سرپل ذهاب',
    stages: [
      { provinceFa: 'کرمانشاه', cityFa: 'سرپل ذهاب', stationName: 'ایستگاه سرپل ذهاب', toMashhadKm: 1420 },
      { provinceFa: 'کرمانشاه', cityFa: 'کرمانشاه', stationName: 'ایستگاه کرمانشاه', toMashhadKm: 1280 },
      { provinceFa: 'کرمانشاه', cityFa: 'کنگاور', stationName: 'ایستگاه کنگاور', toMashhadKm: 1180 },
      { provinceFa: 'همدان', cityFa: 'اسدآباد', stationName: 'ایستگاه اسدآباد', toMashhadKm: 1120 },
      { provinceFa: 'همدان', cityFa: 'همدان', stationName: 'ایستگاه همدان', toMashhadKm: 1080 },
      { provinceFa: 'مرکزی', cityFa: 'ساوه', stationName: 'ایستگاه ساوه', toMashhadKm: 920 },
      { provinceFa: 'قم', cityFa: 'قم', stationName: 'ایستگاه قم', toMashhadKm: 840 },
      { provinceFa: 'سمنان', cityFa: 'گرمسار', stationName: 'ایستگاه گرمسار', toMashhadKm: 720 },
      { provinceFa: 'سمنان', cityFa: 'سمنان', stationName: 'ایستگاه سمنان', toMashhadKm: 640 },
      { provinceFa: 'سمنان', cityFa: 'دامغان', stationName: 'ایستگاه دامغان', toMashhadKm: 560 },
      { provinceFa: 'سمنان', cityFa: 'شاهرود', stationName: 'ایستگاه شاهرود', toMashhadKm: 480 },
      { provinceFa: 'خراسان رضوی', cityFa: 'سبزوار', stationName: 'ایستگاه سبزوار', toMashhadKm: 240 },
      { provinceFa: 'خراسان رضوی', cityFa: 'نیشابور', stationName: 'ایستگاه نیشابور', toMashhadKm: 120 },
      { provinceFa: 'خراسان رضوی', cityFa: 'مشهد', stationName: 'ایستگاه مشهد', toMashhadKm: 0 },
    ],
  },
  {
    name: 'مسیر پیاده مریوان به مشهد',
    borderName: 'مرز باشماق',
    borderProvinceFa: 'کردستان',
    borderCityFa: 'مریوان',
    stages: [
      { provinceFa: 'کردستان', cityFa: 'مریوان', stationName: 'ایستگاه مریوان', toMashhadKm: 1460 },
      { provinceFa: 'کردستان', cityFa: 'سنندج', stationName: 'ایستگاه سنندج', toMashhadKm: 1320 },
      { provinceFa: 'همدان', cityFa: 'همدان', stationName: 'ایستگاه همدان', toMashhadKm: 1120 },
      { provinceFa: 'مرکزی', cityFa: 'ساوه', stationName: 'ایستگاه ساوه', toMashhadKm: 960 },
      { provinceFa: 'قم', cityFa: 'قم', stationName: 'ایستگاه قم', toMashhadKm: 860 },
      { provinceFa: 'سمنان', cityFa: 'گرمسار', stationName: 'ایستگاه گرمسار', toMashhadKm: 740 },
      { provinceFa: 'سمنان', cityFa: 'سمنان', stationName: 'ایستگاه سمنان', toMashhadKm: 650 },
      { provinceFa: 'سمنان', cityFa: 'دامغان', stationName: 'ایستگاه دامغان', toMashhadKm: 570 },
      { provinceFa: 'سمنان', cityFa: 'شاهرود', stationName: 'ایستگاه شاهرود', toMashhadKm: 490 },
      { provinceFa: 'خراسان رضوی', cityFa: 'سبزوار', stationName: 'ایستگاه سبزوار', toMashhadKm: 250 },
      { provinceFa: 'خراسان رضوی', cityFa: 'نیشابور', stationName: 'ایستگاه نیشابور', toMashhadKm: 125 },
      { provinceFa: 'خراسان رضوی', cityFa: 'مشهد', stationName: 'ایستگاه مشهد', toMashhadKm: 0 },
    ],
  },
];

const placeTemplates: { typeCode: string; name: string; phone: string; address: string }[] = [
  { typeCode: 'hospital', name: 'بیمارستان امام رضا', phone: '05131234567', address: 'بلوار زائران، جنب میدان مرکزی' },
  { typeCode: 'pharmacy', name: 'داروخانه شبانه‌روزی رضوی', phone: '05137654321', address: 'خیابان امام، پلاک ۱۲' },
  { typeCode: 'mosque', name: 'مسجد جامع مسیر', phone: '05139876543', address: 'میدان نماز، کوچه اول' },
  { typeCode: 'restaurant', name: 'رستوران زائران', phone: '09151230001', address: 'جنب ایستگاه اتوبوس زائر' },
  { typeCode: 'gas-station', name: 'جایگاه سوخت راهیان', phone: '09151230002', address: 'خروجی شهر، جاده مشهد' },
  { typeCode: 'police', name: 'پاسگاه انتظامی مسیر', phone: '09151230003', address: 'ورودی شهر، جنب راهدارخانه' },
  { typeCode: 'red-crescent', name: 'شعبه هلال احمر', phone: '09151230004', address: 'خیابان امداد، پلاک ۸' },
];

const managers = [
  { name: 'علی رضایی', phone: '09151110001' },
  { name: 'حسین محمدی', phone: '09151110002' },
  { name: 'محمد کریمی', phone: '09151110003' },
  { name: 'رضا احمدی', phone: '09151110004' },
  { name: 'مهدی حسینی', phone: '09151110005' },
];

function dec(value: number | null) {
  return value == null ? null : new Prisma.Decimal(value);
}

function toCoord(value: Prisma.Decimal | null) {
  return value == null ? null : Number(value);
}

function offsetCoord(base: number | null, salt: number, spread = 0.018) {
  if (base == null) return null;
  const delta = ((salt % 17) - 8) * (spread / 8);
  return Number((base + delta).toFixed(7));
}

async function findCity(provinceFa: string, cityFa: string) {
  const city = await prisma.city.findFirst({
    where: {
      nameFa: cityFa,
      province: { nameFa: provinceFa },
    },
    select: {
      id: true,
      provinceId: true,
      nameFa: true,
      latitude: true,
      longitude: true,
      province: { select: { nameFa: true } },
    },
  });
  if (!city) {
    throw new Error(`شهر «${cityFa}» در استان «${provinceFa}» یافت نشد. ابتدا geo seed را اجرا کنید.`);
  }
  return city;
}

async function ensurePlaceTypes() {
  for (const item of placeTypeSeed) {
    await prisma.placeType.upsert({
      where: { code: item.code },
      update: {
        nameFa: item.nameFa,
        nameEn: item.nameEn,
        icon: item.icon,
        sortOrder: item.sortOrder,
        isActive: true,
      },
      create: item,
    });
  }
  const rows = await prisma.placeType.findMany();
  return new Map(rows.map((item) => [item.code, item]));
}

async function ensureBorder(spec: RouteSpec) {
  const iraq = await prisma.country.findUnique({ where: { iso2: 'IQ' } });
  if (!iraq) {
    throw new Error('کشور عراق در دیتابیس نیست. ابتدا prisma:seed را اجرا کنید.');
  }
  const city = await findCity(spec.borderProvinceFa, spec.borderCityFa);
  const existing = await prisma.entryBorder.findFirst({
    where: { name: spec.borderName },
  });
  if (existing) {
    return existing;
  }
  return prisma.entryBorder.create({
    data: {
      name: spec.borderName,
      neighboringCountryId: iraq.id,
      provinceId: city.provinceId,
      cityId: city.id,
      borderType: 'LAND',
      isActive: true,
      description: `${PLACE_SEED_MARK} مرز زمینی غرب کشور`,
    },
  });
}

async function upsertStation(
  spec: StageSpec,
  city: { id: string; latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null },
  manager: { name: string; phone: string },
) {
  const existing = await prisma.walkingStation.findFirst({
    where: { cityId: city.id, name: spec.stationName },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }
  const created = await prisma.walkingStation.create({
    data: {
      cityId: city.id,
      name: spec.stationName,
      latitude: dec(toCoord(city.latitude)),
      longitude: dec(toCoord(city.longitude)),
      managerName: manager.name,
      managerPhone: manager.phone,
      distanceToMashhadKm: dec(spec.toMashhadKm),
      description: `${PLACE_SEED_MARK} ایستگاه مسیر غرب به مشهد`,
    },
  });
  return created.id;
}

async function upsertRoute(spec: RouteSpec, iraqId: string) {
  const border = await ensureBorder(spec);
  const resolved = [];
  for (const [index, stage] of spec.stages.entries()) {
    const city = await findCity(stage.provinceFa, stage.cityFa);
    const manager = managers[index % managers.length];
    const walkingStationId = await upsertStation(stage, city, manager);
    resolved.push({ spec: stage, walkingStationId });
  }

  const stages = resolved.map((row, index) => {
    const prev = resolved[index - 1];
    const next = resolved[index + 1];
    return {
      walkingStationId: row.walkingStationId,
      stageNumber: index + 1,
      distanceToPreviousKm: prev
        ? dec(Math.abs(prev.spec.toMashhadKm - row.spec.toMashhadKm))
        : null,
      distanceToNextKm: next
        ? dec(Math.abs(row.spec.toMashhadKm - next.spec.toMashhadKm))
        : null,
    };
  });

  const existing = await prisma.walkingRoute.findFirst({
    where: { name: spec.name },
    select: { id: true },
  });

  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.walkingRouteStage.deleteMany({ where: { walkingRouteId: existing.id } });
      await tx.walkingRouteOriginCountry.deleteMany({
        where: { walkingRouteId: existing.id },
      });
      await tx.walkingRoute.update({
        where: { id: existing.id },
        data: {
          distanceToMashhadKm: new Prisma.Decimal(spec.stages[0].toMashhadKm),
          entryBorderId: border.id,
          originCountries: { create: { countryId: iraqId } },
          stages: { create: stages },
        },
      });
    });
    return existing.id;
  }

  const created = await prisma.walkingRoute.create({
    data: {
      name: spec.name,
      distanceToMashhadKm: new Prisma.Decimal(spec.stages[0].toMashhadKm),
      entryBorderId: border.id,
      originCountries: { create: { countryId: iraqId } },
      stages: { create: stages },
    },
  });
  return created.id;
}

async function seedPlaces(
  types: Map<string, { id: string }>,
) {
  await prisma.place.deleteMany({
    where: { description: { contains: PLACE_SEED_MARK } },
  });

  const uniqueCities = new Map<string, { provinceFa: string; cityFa: string }>();
  for (const route of routes) {
    for (const stage of route.stages) {
      uniqueCities.set(`${stage.provinceFa}::${stage.cityFa}`, {
        provinceFa: stage.provinceFa,
        cityFa: stage.cityFa,
      });
    }
  }

  let created = 0;
  let index = 0;
  for (const key of uniqueCities.keys()) {
    const spec = uniqueCities.get(key);
    if (!spec) continue;
    const city = await findCity(spec.provinceFa, spec.cityFa);
    const lat = toCoord(city.latitude);
    const lng = toCoord(city.longitude);
    for (const [templateIndex, template] of placeTemplates.entries()) {
      const type = types.get(template.typeCode);
      if (!type) continue;
      const salt = index * 10 + templateIndex;
      await prisma.place.create({
        data: {
          name: `${template.name} ${city.nameFa}`,
          placeTypeId: type.id,
          provinceId: city.provinceId,
          cityId: city.id,
          phone: template.phone,
          address: `${template.address} — ${city.nameFa}`,
          latitude: dec(offsetCoord(lat, salt)),
          longitude: dec(offsetCoord(lng, salt + 3)),
          description: `${PLACE_SEED_MARK} مکان آزمایشی برای زائران مسیر غرب`,
        },
      });
      created += 1;
    }
    index += 1;
  }
  return created;
}

async function main() {
  const iraq = await prisma.country.findUnique({ where: { iso2: 'IQ' } });
  if (!iraq) {
    throw new Error('کشور عراق در دیتابیس نیست. ابتدا npm run prisma:seed را اجرا کنید.');
  }

  const types = await ensurePlaceTypes();
  const routeIds: string[] = [];
  for (const route of routes) {
    const id = await upsertRoute(route, iraq.id);
    routeIds.push(id);
    console.log(`مسیر آماده شد: ${route.name}`);
  }
  const placeCount = await seedPlaces(types);
  console.log(`مکان مهم آزمایشی: ${placeCount}`);
  console.log(`مسیرها: ${routeIds.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
