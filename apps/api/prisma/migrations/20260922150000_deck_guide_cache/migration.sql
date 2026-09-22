-- CreateTable
CREATE TABLE "DeckGuideCache" (
    "key" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckGuideCache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "DeckGuideCache_createdAt_idx" ON "DeckGuideCache"("createdAt");
