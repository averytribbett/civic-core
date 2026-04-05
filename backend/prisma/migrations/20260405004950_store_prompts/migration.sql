/*
  Warnings:

  - You are about to drop the `places` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "JurisdictionType" AS ENUM ('country', 'state', 'county', 'city', 'township', 'village');

-- DropTable
DROP TABLE "places";

-- DropEnum
DROP TYPE "PlaceType";

-- CreateTable
CREATE TABLE "jurisdiction" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "JurisdictionType" NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "prompt" TEXT NOT NULL,
    "origins" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jurisdiction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jurisdiction_source_key" ON "jurisdiction"("source");
