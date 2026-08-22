-- Backfill users without country to Iran
UPDATE "users"
SET "countryId" = (SELECT "id" FROM "countries" WHERE "iso2" = 'IR' LIMIT 1)
WHERE "countryId" IS NULL
  AND EXISTS (SELECT 1 FROM "countries" WHERE "iso2" = 'IR');

-- Default countryId to Iran on INSERT when omitted
CREATE OR REPLACE FUNCTION set_user_default_country_iran()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."countryId" IS NULL THEN
    SELECT "id" INTO NEW."countryId"
    FROM "countries"
    WHERE "iso2" = 'IR'
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_default_country_iran ON "users";
CREATE TRIGGER users_set_default_country_iran
  BEFORE INSERT ON "users"
  FOR EACH ROW
  EXECUTE PROCEDURE set_user_default_country_iran();
