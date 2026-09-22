-- AlterTable
ALTER TABLE "CardSet" ADD COLUMN     "contentCheckedAt" TIMESTAMP(3),
ADD COLUMN     "contentSource" TEXT;

-- AlterTable
ALTER TABLE "CardPrint" ADD COLUMN     "setQuantity" INTEGER;

-- CreateTable
CREATE TABLE "OwnedProduct" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "language" "CardLanguage" NOT NULL DEFAULT 'FR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OwnedProduct_userId_idx" ON "OwnedProduct"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnedProduct_userId_setId_language_key" ON "OwnedProduct"("userId", "setId", "language");

-- AddForeignKey
ALTER TABLE "OwnedProduct" ADD CONSTRAINT "OwnedProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnedProduct" ADD CONSTRAINT "OwnedProduct_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rattrapage : les produits importés avant cette version n'étaient pas enregistrés.
-- Un produit est considéré comme importé si l'utilisateur possède, dans une même langue et
-- via une impression de ce produit, TOUTES ses cartes (5 cartes minimum, pour ignorer les
-- promos / petits sets où ça arrive par hasard). Nombre de produits = plus petite quantité.
INSERT INTO "OwnedProduct" ("id", "userId", "setId", "copies", "language", "createdAt", "updatedAt")
SELECT 'bf' || substr(md5(owned."userId" || owned."setId" || owned.language::text), 1, 23),
       owned."userId", owned."setId", GREATEST(owned.copies, 1), owned.language, owned.since, CURRENT_TIMESTAMP
FROM (
  SELECT ci."userId", p."setId", ci.language,
         COUNT(DISTINCT p."cardId") AS cards,
         MIN(ci.quantity) AS copies,
         MIN(ci."createdAt") AS since
  FROM "CollectionItem" ci
  JOIN "CardPrint" p ON p.id = ci."printId"
  GROUP BY ci."userId", p."setId", ci.language
) owned
WHERE owned.cards >= 5
  AND owned.cards = (SELECT COUNT(DISTINCT p2."cardId") FROM "CardPrint" p2 WHERE p2."setId" = owned."setId")
ON CONFLICT DO NOTHING;
