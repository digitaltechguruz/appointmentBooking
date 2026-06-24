-- CreateEnum
CREATE TYPE "HoursTimeFormat" AS ENUM ('HOUR_12', 'HOUR_24');

-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN "hoursTimeFormat" "HoursTimeFormat" NOT NULL DEFAULT 'HOUR_24';
ALTER TABLE "Merchant" ADD COLUMN "weekStartsOn" "DayOfWeek" NOT NULL DEFAULT 'SUNDAY';
