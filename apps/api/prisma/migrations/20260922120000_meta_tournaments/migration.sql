-- Meta automatique : listes de tournoi, archétypes calculés, popularité des cartes

-- CreateTable
CREATE TABLE "CardArt" (
    "id" INTEGER NOT NULL,
    "cardId" INTEGER NOT NULL,

    CONSTRAINT "CardArt_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "MetaDeck" ADD COLUMN     "listCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "share" DOUBLE PRECISION,
ADD COLUMN     "variants" TEXT[];

-- AlterTable
ALTER TABLE "MetaDeckCard" ADD COLUMN     "flex" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inclusion" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "TournamentDeck" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tournament" TEXT,
    "placement" TEXT,
    "playerCount" INTEGER,
    "main" INTEGER[],
    "extra" INTEGER[],
    "side" INTEGER[],
    "url" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metaDeckId" TEXT,

    CONSTRAINT "TournamentDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardMetaStat" (
    "cardId" INTEGER NOT NULL,
    "deckShare" DOUBLE PRECISION NOT NULL,
    "avgCopies" DOUBLE PRECISION NOT NULL,
    "isStaple" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardMetaStat_pkey" PRIMARY KEY ("cardId")
);

-- CreateIndex
CREATE INDEX "CardArt_cardId_idx" ON "CardArt"("cardId");

-- CreateIndex
CREATE INDEX "TournamentDeck_metaDeckId_idx" ON "TournamentDeck"("metaDeckId");

-- AddForeignKey
ALTER TABLE "CardArt" ADD CONSTRAINT "CardArt_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentDeck" ADD CONSTRAINT "TournamentDeck_metaDeckId_fkey" FOREIGN KEY ("metaDeckId") REFERENCES "MetaDeck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardMetaStat" ADD CONSTRAINT "CardMetaStat_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
