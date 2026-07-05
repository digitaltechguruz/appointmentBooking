-- Per-service booking rule overrides
ALTER TABLE "Service" ADD COLUMN "useCustomBookingRules" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Service" ADD COLUMN "slotIntervalMinutes" INTEGER;
ALTER TABLE "Service" ADD COLUMN "minNoticeMinutes" INTEGER;
ALTER TABLE "Service" ADD COLUMN "maxAdvanceDays" INTEGER;
ALTER TABLE "Service" ADD COLUMN "bufferBeforeMinutes" INTEGER;
ALTER TABLE "Service" ADD COLUMN "bufferAfterMinutes" INTEGER;
ALTER TABLE "Service" ADD COLUMN "maxBookingsPerDay" INTEGER;
ALTER TABLE "Service" ADD COLUMN "maxBookingsPerSlot" INTEGER;
ALTER TABLE "Service" ADD COLUMN "lookBusyEnabled" BOOLEAN;
ALTER TABLE "Service" ADD COLUMN "lookBusyPercent" INTEGER;
