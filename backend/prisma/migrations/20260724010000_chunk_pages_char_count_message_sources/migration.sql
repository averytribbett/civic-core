-- Rename misleading tokens column (stores character length) and add PDF page metadata
ALTER TABLE "chunks" RENAME COLUMN "tokens" TO "charCount";
ALTER TABLE "chunks" ADD COLUMN "pageStart" INTEGER;
ALTER TABLE "chunks" ADD COLUMN "pageEnd" INTEGER;

-- Structured citation sources on agent messages
ALTER TABLE "messages" ADD COLUMN "sources" JSONB;
