-- AlterTable
ALTER TABLE "jurisdiction" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "crawlUrl" TEXT,
ADD COLUMN     "lastCrawlAt" TIMESTAMP(3),
ADD COLUMN     "lastCrawlStatus" TEXT,
ADD COLUMN     "lastCrawlError" TEXT;

-- CreateIndex
CREATE INDEX "jurisdiction_enabled_idx" ON "jurisdiction"("enabled");

-- Backfill known production jurisdiction (set others via Prisma Studio or SQL)
UPDATE "jurisdiction"
SET "enabled" = true,
    "crawlUrl" = 'https://www.chisagocountymn.gov/'
WHERE "source" = 'chisago_county_mn';
