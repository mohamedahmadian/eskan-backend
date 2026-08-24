CREATE TYPE "ReservationMemberInsurancePaidMethod" AS ENUM ('MANAGEMENT', 'ONLINE_GATEWAY');

ALTER TABLE "reservation_members"
ADD COLUMN "insurancePaidMethod" "ReservationMemberInsurancePaidMethod",
ADD COLUMN "insurancePaidById" TEXT;

ALTER TABLE "reservation_members" ADD CONSTRAINT "reservation_members_insurancePaidById_fkey" FOREIGN KEY ("insurancePaidById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "reservation_members_insurancePaidById_idx" ON "reservation_members"("insurancePaidById");
