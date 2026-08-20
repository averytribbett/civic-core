-- AlterTable
ALTER TABLE "jurisdiction" ADD COLUMN "inboundPhoneNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "jurisdiction_inboundPhoneNumber_key" ON "jurisdiction"("inboundPhoneNumber");

-- CreateTable
CREATE TABLE "voice_calls" (
    "id" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "externalCallId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "transcript" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voice_calls_externalCallId_key" ON "voice_calls"("externalCallId");

-- CreateIndex
CREATE INDEX "voice_calls_jurisdictionId_idx" ON "voice_calls"("jurisdictionId");

-- CreateIndex
CREATE INDEX "voice_calls_startedAt_idx" ON "voice_calls"("startedAt");

-- AddForeignKey
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
