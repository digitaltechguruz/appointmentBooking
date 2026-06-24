-- AlterTable
ALTER TABLE "MeetingType" ADD COLUMN "videoLinkEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Legacy: types that used integration enums
UPDATE "MeetingType"
SET "videoLinkEnabled" = true
WHERE "type" IN ('ZOOM', 'GOOGLE_MEET');
