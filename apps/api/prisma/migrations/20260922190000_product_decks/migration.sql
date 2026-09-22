-- CreateTable
CREATE TABLE "ProductDeck" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "name" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductDeckCard" (
    "deckId" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ProductDeckCard_pkey" PRIMARY KEY ("deckId","cardId")
);

-- CreateIndex
CREATE INDEX "ProductDeck_setId_idx" ON "ProductDeck"("setId");

-- CreateIndex
CREATE INDEX "ProductDeckCard_cardId_idx" ON "ProductDeckCard"("cardId");

-- AddForeignKey
ALTER TABLE "ProductDeck" ADD CONSTRAINT "ProductDeck_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDeckCard" ADD CONSTRAINT "ProductDeckCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "ProductDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDeckCard" ADD CONSTRAINT "ProductDeckCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Les listes officielles déjà lues n'avaient pas leurs decks : on les relira
UPDATE "CardSet" SET "contentCheckedAt" = NULL, "contentSource" = NULL WHERE "contentSource" IS NOT NULL;
