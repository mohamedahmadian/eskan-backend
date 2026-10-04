-- Sidebar order: dashboard, pilgrimage (caravans), pilgrims
UPDATE "nav_modules" SET "sortOrder" = 2 WHERE "code" = 'caravans';
UPDATE "nav_modules" SET "sortOrder" = 3 WHERE "code" = 'pilgrims';
