-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CardCategory" AS ENUM ('MONSTER', 'SPELL', 'TRAP', 'SKILL', 'TOKEN');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "CardCondition" AS ENUM ('MINT', 'NEAR_MINT', 'EXCELLENT', 'GOOD', 'LIGHT_PLAYED', 'PLAYED', 'POOR');

-- CreateEnum
CREATE TYPE "CardLanguage" AS ENUM ('FR', 'EN', 'DE', 'IT', 'ES', 'PT', 'JP', 'KR');

-- CreateEnum
CREATE TYPE "DeckFormat" AS ENUM ('TCG', 'OCG', 'GOAT', 'EDISON', 'CASUAL');

-- CreateEnum
CREATE TYPE "DeckZone" AS ENUM ('MAIN', 'EXTRA', 'SIDE');

-- CreateEnum
CREATE TYPE "WishlistPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "Card" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameFr" TEXT,
    "category" "CardCategory" NOT NULL,
    "type" TEXT NOT NULL,
    "frameType" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "descFr" TEXT,
    "archetype" TEXT,
    "attribute" TEXT,
    "race" TEXT,
    "level" INTEGER,
    "atk" INTEGER,
    "def" INTEGER,
    "linkVal" INTEGER,
    "linkMarkers" TEXT[],
    "scale" INTEGER,
    "isExtraDeck" BOOLEAN NOT NULL DEFAULT false,
    "banTcg" TEXT,
    "banOcg" TEXT,
    "formats" TEXT[],
    "tcgDate" DATE,
    "imageUrl" TEXT,
    "imageUrlSmall" TEXT,
    "priceCardmarket" DECIMAL(10,2),
    "priceTcgplayer" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "cardCount" INTEGER,
    "tcgDate" DATE,
    "imageUrl" TEXT,

    CONSTRAINT "CardSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPrint" (
    "id" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,
    "setId" TEXT NOT NULL,
    "printCode" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "rarityCode" TEXT,
    "price" DECIMAL(10,2),

    CONSTRAINT "CardPrint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL,
    "databaseVersion" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "cardCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,
    "printId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" "CardCondition" NOT NULL DEFAULT 'NEAR_MINT',
    "language" "CardLanguage" NOT NULL DEFAULT 'FR',
    "firstEdition" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "format" "DeckFormat" NOT NULL DEFAULT 'TCG',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckCard" (
    "deckId" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,
    "zone" "DeckZone" NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "DeckCard_pkey" PRIMARY KEY ("deckId","cardId","zone")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,
    "printId" TEXT,
    "deckId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "maxPrice" DECIMAL(10,2),
    "language" "CardLanguage",
    "priority" "WishlistPriority" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaDeck" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archetype" TEXT,
    "tier" INTEGER,
    "format" "DeckFormat" NOT NULL DEFAULT 'TCG',
    "source" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaDeckCard" (
    "metaDeckId" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,
    "zone" "DeckZone" NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "MetaDeckCard_pkey" PRIMARY KEY ("metaDeckId","cardId","zone")
);

-- CreateIndex
CREATE INDEX "Card_name_idx" ON "Card"("name");

-- CreateIndex
CREATE INDEX "Card_archetype_idx" ON "Card"("archetype");

-- CreateIndex
CREATE INDEX "Card_category_idx" ON "Card"("category");

-- CreateIndex
CREATE UNIQUE INDEX "CardSet_name_key" ON "CardSet"("name");

-- CreateIndex
CREATE INDEX "CardPrint_setId_idx" ON "CardPrint"("setId");

-- CreateIndex
CREATE INDEX "CardPrint_printCode_idx" ON "CardPrint"("printCode");

-- CreateIndex
CREATE UNIQUE INDEX "CardPrint_cardId_printCode_rarity_key" ON "CardPrint"("cardId", "printCode", "rarity");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "CollectionItem_userId_cardId_idx" ON "CollectionItem"("userId", "cardId");

-- CreateIndex
CREATE INDEX "Deck_userId_idx" ON "Deck"("userId");

-- CreateIndex
CREATE INDEX "WishlistItem_userId_idx" ON "WishlistItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaDeck_name_format_key" ON "MetaDeck"("name", "format");

-- AddForeignKey
ALTER TABLE "CardPrint" ADD CONSTRAINT "CardPrint_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPrint" ADD CONSTRAINT "CardPrint_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_printId_fkey" FOREIGN KEY ("printId") REFERENCES "CardPrint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckCard" ADD CONSTRAINT "DeckCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckCard" ADD CONSTRAINT "DeckCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_printId_fkey" FOREIGN KEY ("printId") REFERENCES "CardPrint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaDeckCard" ADD CONSTRAINT "MetaDeckCard_metaDeckId_fkey" FOREIGN KEY ("metaDeckId") REFERENCES "MetaDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaDeckCard" ADD CONSTRAINT "MetaDeckCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
