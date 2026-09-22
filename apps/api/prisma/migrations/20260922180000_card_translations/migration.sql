-- CreateTable
CREATE TABLE "CardTranslation" (
    "cardId" INTEGER NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT NOT NULL,

    CONSTRAINT "CardTranslation_pkey" PRIMARY KEY ("cardId","locale")
);

-- CreateIndex
CREATE INDEX "CardTranslation_locale_idx" ON "CardTranslation"("locale");

-- AddForeignKey
ALTER TABLE "CardTranslation" ADD CONSTRAINT "CardTranslation_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
