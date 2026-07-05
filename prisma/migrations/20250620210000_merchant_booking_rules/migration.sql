-- Booking rules on Merchant
ALTER TABLE "Merchant" ADD COLUMN "slotIntervalMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Merchant" ADD COLUMN "defaultDurationMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Merchant" ADD COLUMN "minNoticeMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Merchant" ADD COLUMN "maxAdvanceDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Merchant" ADD COLUMN "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Merchant" ADD COLUMN "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Merchant" ADD COLUMN "maxBookingsPerDay" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Merchant" ADD COLUMN "maxBookingsPerSlot" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Merchant" ADD COLUMN "lookBusyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Merchant" ADD COLUMN "lookBusyPercent" INTEGER NOT NULL DEFAULT 0;

-- Allow multiple bookings per slot when maxBookingsPerSlot > 1
DROP INDEX IF EXISTS "Booking_merchantId_bookingDate_startTime_key";
CREATE INDEX "Booking_merchantId_bookingDate_startTime_idx" ON "Booking"("merchantId", "bookingDate", "startTime");
