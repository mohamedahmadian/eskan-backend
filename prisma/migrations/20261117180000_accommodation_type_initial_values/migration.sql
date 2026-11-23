UPDATE "accommodation_types"
SET
  "nameFa" = 'مدرسه',
  "nameEn" = 'School',
  "icon" = 'school',
  "sortOrder" = 1,
  "requiresSchoolDistrict" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'school';

UPDATE "accommodation_types"
SET
  "nameFa" = 'مسجد',
  "nameEn" = 'Mosque',
  "icon" = 'landmark',
  "sortOrder" = 2,
  "requiresSchoolDistrict" = false,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'mosque';

UPDATE "accommodation_types"
SET
  "nameFa" = 'حسینیه',
  "nameEn" = 'Husseiniyeh',
  "icon" = 'building',
  "sortOrder" = 3,
  "requiresSchoolDistrict" = false,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'husseinieh';

UPDATE "accommodation_types"
SET
  "code" = 'sports-hall',
  "nameFa" = 'سالن‌های ورزشی',
  "nameEn" = 'Sports halls',
  "icon" = 'building-2',
  "sortOrder" = 4,
  "requiresSchoolDistrict" = false,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'hall'
  AND NOT EXISTS (SELECT 1 FROM "accommodation_types" WHERE "code" = 'sports-hall');

UPDATE "accommodation_types"
SET
  "code" = 'lodging',
  "nameFa" = 'مهمان‌سراها، خوابگاه‌ها و مراکز اقامتی',
  "nameEn" = 'Guesthouses, dormitories and lodging',
  "icon" = 'home',
  "sortOrder" = 6,
  "requiresSchoolDistrict" = false,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'house'
  AND NOT EXISTS (SELECT 1 FROM "accommodation_types" WHERE "code" = 'lodging');

UPDATE "accommodation_types"
SET
  "nameFa" = 'سایر',
  "nameEn" = 'Other',
  "icon" = 'map-pin',
  "sortOrder" = 10,
  "requiresSchoolDistrict" = false,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'other';

INSERT INTO "accommodation_types" ("id", "code", "nameFa", "nameEn", "icon", "isActive", "sortOrder", "requiresSchoolDistrict", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.code, v."nameFa", v."nameEn", v.icon, true, v."sortOrder", false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  VALUES
    ('sports-hall', 'سالن‌های ورزشی', 'Sports halls', 'building-2', 4),
    ('assembly-hall', 'سالن اجتماعات و مراکز فرهنگی', 'Assembly halls and cultural centers', 'landmark', 5),
    ('lodging', 'مهمان‌سراها، خوابگاه‌ها و مراکز اقامتی', 'Guesthouses, dormitories and lodging', 'home', 6),
    ('tent', 'چادرها و اسکان‌های موقت', 'Tents and temporary lodging', 'tent', 7),
    ('boarding', 'مراکز آموزشی شبانه‌روزی و خوابگاه‌های دانشجویی', 'Boarding schools and student dormitories', 'school', 8),
    ('medical', 'مراکز درمانی یا ساختمان‌های دارای کاربری درمانی', 'Medical buildings', 'hospital', 9)
) AS v(code, "nameFa", "nameEn", icon, "sortOrder")
WHERE NOT EXISTS (
  SELECT 1 FROM "accommodation_types" t WHERE t."code" = v.code
);
