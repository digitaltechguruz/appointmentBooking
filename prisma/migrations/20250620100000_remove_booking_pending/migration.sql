-- Migrate any legacy pending bookings to confirmed
UPDATE "Booking" SET "status" = 'CONFIRMED' WHERE "status" = 'PENDING';

-- Replace BookingStatus enum without PENDING
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');
ALTER TABLE "Booking" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Booking" ALTER COLUMN "status" TYPE "BookingStatus" USING ("status"::text::"BookingStatus");
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';
DROP TYPE "BookingStatus_old";
