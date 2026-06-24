-- AlterTable: closed date ranges (start date + end date)
ALTER TABLE "ClosedDate" ADD COLUMN "endDate" DATE;

UPDATE "ClosedDate" SET "endDate" = "date" WHERE "endDate" IS NULL;

ALTER TABLE "ClosedDate" ALTER COLUMN "endDate" SET NOT NULL;

DROP INDEX IF EXISTS "ClosedDate_merchantId_date_key";

CREATE INDEX "ClosedDate_merchantId_date_endDate_idx" ON "ClosedDate"("merchantId", "date", "endDate");
