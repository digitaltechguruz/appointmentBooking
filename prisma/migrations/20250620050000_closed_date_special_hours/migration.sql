-- AlterTable
ALTER TABLE "ClosedDate" ADD COLUMN "closedAllDay" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ClosedDate" ADD COLUMN "startTime" TEXT;
ALTER TABLE "ClosedDate" ADD COLUMN "endTime" TEXT;
