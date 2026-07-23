-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('html_page', 'pdf', 'agenda', 'minutes', 'other');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "mimeType" TEXT,
ADD COLUMN "docKind" "DocumentKind";

-- CreateIndex
CREATE INDEX "documents_docKind_idx" ON "documents"("docKind");
