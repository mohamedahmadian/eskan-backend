ALTER TABLE "reservations"
ADD COLUMN "requestsAccommodation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "requestsBus" BOOLEAN NOT NULL DEFAULT true;
