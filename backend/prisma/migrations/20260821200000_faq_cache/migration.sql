-- AlterTable
ALTER TABLE "jurisdiction" ADD COLUMN "faqUrl" TEXT;

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "usedFaqIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "messages" ADD COLUMN "isFaqCache" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "faq_entries" (
    "id" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "normalizedQuestion" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sources" JSONB,
    "model" TEXT,
    "questionEmbedding" vector(768) NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "faq_entries_jurisdictionId_normalizedQuestion_key" ON "faq_entries"("jurisdictionId", "normalizedQuestion");

-- CreateIndex
CREATE INDEX "faq_entries_jurisdictionId_idx" ON "faq_entries"("jurisdictionId");

-- AddForeignKey
ALTER TABLE "faq_entries" ADD CONSTRAINT "faq_entries_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
