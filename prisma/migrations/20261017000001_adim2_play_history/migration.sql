-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('VALID', 'SYNTHETIC', 'INVALID_V2_NO_CONTENT', 'QUARANTINED_LATE', 'QUARANTINED_ACCESS', 'LEGACY_V1', 'LEGACY_V2');

-- CreateEnum
CREATE TYPE "CompanyIdSource" AS ENUM ('SERVER_AT_EVENT', 'BACKFILL_CURRENT_USER');

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "inactiveSince" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PlayHistory" ADD COLUMN     "appVersion" TEXT,
ADD COLUMN     "buildNumber" TEXT,
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "companyIdSource" "CompanyIdSource",
ADD COLUMN     "platform" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "runtimeVersion" TEXT,
ADD COLUMN     "updateId" TEXT,
ADD COLUMN     "validationStatus" "ValidationStatus";

-- CreateTable
CREATE TABLE "PlayHistoryReject" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'unknown',
    "clientVersion" INTEGER NOT NULL DEFAULT 0,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayHistoryReject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayHistoryReject_day_idx" ON "PlayHistoryReject"("day");

-- CreateIndex
CREATE UNIQUE INDEX "PlayHistoryReject_reason_day_platform_clientVersion_key" ON "PlayHistoryReject"("reason", "day", "platform", "clientVersion");

-- CreateIndex
CREATE INDEX "PlayHistory_companyId_playedAt_idx" ON "PlayHistory"("companyId", "playedAt");

-- CreateIndex
CREATE INDEX "PlayHistory_validationStatus_idx" ON "PlayHistory"("validationStatus");

-- AddForeignKey
ALTER TABLE "PlayHistory" ADD CONSTRAINT "PlayHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
