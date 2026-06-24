-- CreateEnum
CREATE TYPE "WidgetTheme" AS ENUM ('CLASSIC', 'MODERN');

-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN "widgetTheme" "WidgetTheme" NOT NULL DEFAULT 'CLASSIC';
