-- Clear any pre-production test data (no owner reference existed before this migration)
DELETE FROM "PublishedForm";

-- AlterTable
ALTER TABLE "PublishedForm" ADD COLUMN "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "PublishedForm_userId_idx" ON "PublishedForm"("userId");
