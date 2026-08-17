-- Add jurisdictionId columns (nullable during backfill)
ALTER TABLE "documents" ADD COLUMN "jurisdictionId" TEXT;
ALTER TABLE "conversations" ADD COLUMN "jurisdictionId" TEXT;

-- Backfill from existing source slug columns
UPDATE "documents" d
SET "jurisdictionId" = j.id
FROM "jurisdiction" j
WHERE d.source = j.source;

UPDATE "conversations" c
SET "jurisdictionId" = j.id
FROM "jurisdiction" j
WHERE c.source = j.source;

-- Remove orphan documents (null source or unknown slug — unreachable in chat)
DELETE FROM "documents"
WHERE "jurisdictionId" IS NULL;

-- Conversations must all resolve; fail loudly if any orphan remains
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "conversations" WHERE "jurisdictionId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate: conversations with unknown source slug remain';
  END IF;
END $$;

-- Enforce NOT NULL
ALTER TABLE "documents" ALTER COLUMN "jurisdictionId" SET NOT NULL;
ALTER TABLE "conversations" ALTER COLUMN "jurisdictionId" SET NOT NULL;

-- Add foreign keys (restrict delete — admin export/delete is future work)
ALTER TABLE "documents" ADD CONSTRAINT "documents_jurisdictionId_fkey"
  FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_jurisdictionId_fkey"
  FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Replace source indexes with jurisdictionId indexes
DROP INDEX IF EXISTS "documents_source_idx";
DROP INDEX IF EXISTS "conversations_source_idx";

CREATE INDEX "documents_jurisdictionId_idx" ON "documents"("jurisdictionId");
CREATE INDEX "conversations_jurisdictionId_idx" ON "conversations"("jurisdictionId");

-- Drop old slug columns
ALTER TABLE "documents" DROP COLUMN "source";
ALTER TABLE "conversations" DROP COLUMN "source";
