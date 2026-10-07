-- AlterTable
ALTER TABLE "CardSet" ADD COLUMN     "announcedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'slate',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardTag" (
    "tagId" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,

    CONSTRAINT "CardTag_pkey" PRIMARY KEY ("tagId","cardId")
);

-- CreateTable
CREATE TABLE "SetTag" (
    "tagId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,

    CONSTRAINT "SetTag_pkey" PRIMARY KEY ("tagId","setId")
);

-- CreateIndex
CREATE INDEX "Tag_userId_idx" ON "Tag"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag"("userId", "name");

-- CreateIndex
CREATE INDEX "CardTag_cardId_idx" ON "CardTag"("cardId");

-- CreateIndex
CREATE INDEX "SetTag_setId_idx" ON "SetTag"("setId");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTag" ADD CONSTRAINT "CardTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTag" ADD CONSTRAINT "CardTag_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetTag" ADD CONSTRAINT "SetTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetTag" ADD CONSTRAINT "SetTag_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
-- L'onglet Extensions trie sur la date de sortie et compte les impressions possédées set par
-- set : ces deux accès n'avaient pas d'index.
CREATE INDEX "CardSet_tcgDate_idx" ON "CardSet"("tcgDate");

-- CreateIndex
CREATE INDEX "CollectionItem_userId_printId_idx" ON "CollectionItem"("userId", "printId");
