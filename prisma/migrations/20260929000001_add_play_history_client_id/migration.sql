-- AlterTable
ALTER TABLE "PlayHistory" ADD COLUMN "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PlayHistory_clientId_key" ON "PlayHistory"("clientId");
