-- Speed up user/pilgrim list search (ILIKE '%q%') and role-scoped listings.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Substring / ILIKE search on identity and name fields
CREATE INDEX IF NOT EXISTS "users_lastName_trgm_idx"
  ON "users" USING gin ("lastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_firstName_trgm_idx"
  ON "users" USING gin ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_fullName_trgm_idx"
  ON "users" USING gin ("fullName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_nationalId_trgm_idx"
  ON "users" USING gin ("nationalId" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_phone_trgm_idx"
  ON "users" USING gin ("phone" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_username_trgm_idx"
  ON "users" USING gin ("username" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_notes_trgm_idx"
  ON "users" USING gin ("notes" gin_trgm_ops);

-- Role filter: every /pilgrims list joins user_roles by role
CREATE INDEX IF NOT EXISTS "user_roles_roleId_idx"
  ON "user_roles" ("roleId");

-- Sort + geo filters on list pages
CREATE INDEX IF NOT EXISTS "users_createdAt_idx"
  ON "users" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "users_countryId_idx"
  ON "users" ("countryId");
CREATE INDEX IF NOT EXISTS "users_provinceId_idx"
  ON "users" ("provinceId");
CREATE INDEX IF NOT EXISTS "users_cityId_idx"
  ON "users" ("cityId");
CREATE INDEX IF NOT EXISTS "users_lastName_idx"
  ON "users" ("lastName");
