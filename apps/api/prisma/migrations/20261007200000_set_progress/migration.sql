-- CreateTable
CREATE TABLE "SetProgress" (
    "userId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "prints" INTEGER NOT NULL DEFAULT 0,
    "cards" INTEGER NOT NULL DEFAULT 0,
    "ownedPrints" INTEGER NOT NULL DEFAULT 0,
    "ownedCards" INTEGER NOT NULL DEFAULT 0,
    "copies" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetProgress_pkey" PRIMARY KEY ("userId","setId")
);

-- CreateIndex
CREATE INDEX "SetProgress_setId_idx" ON "SetProgress"("setId");

-- AddForeignKey
ALTER TABLE "SetProgress" ADD CONSTRAINT "SetProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetProgress" ADD CONSTRAINT "SetProgress_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rattrapage : l'avancement de chaque utilisateur sur chaque extension dont il possède au
-- moins une carte. Même calcul que `SetProgressService.recompute`, tous utilisateurs d'un
-- coup — posséder une impression implique posséder la carte, donc partir des cartes suffit
-- à couvrir toutes les extensions concernées.
INSERT INTO "SetProgress" ("userId", "setId", "prints", "cards", "ownedPrints", "ownedCards", "copies", "updatedAt")
SELECT reach."userId",
       reach."setId",
       COALESCE(tot.prints, 0),
       COALESCE(tot.cards, 0),
       COALESCE(mine."ownedPrints", 0),
       reach."ownedCards",
       COALESCE(mine.copies, 0),
       CURRENT_TIMESTAMP
FROM (
  SELECT ci."userId", p."setId", COUNT(DISTINCT p."cardId")::int AS "ownedCards"
  FROM (SELECT DISTINCT "userId", "cardId" FROM "CollectionItem") ci
  JOIN "CardPrint" p ON p."cardId" = ci."cardId"
  GROUP BY 1, 2
) reach
LEFT JOIN (
  SELECT "setId", COUNT(*)::int AS prints, COUNT(DISTINCT "cardId")::int AS cards
  FROM "CardPrint" GROUP BY 1
) tot ON tot."setId" = reach."setId"
LEFT JOIN (
  SELECT ci."userId", p."setId",
         COUNT(DISTINCT p.id)::int AS "ownedPrints",
         SUM(ci.quantity)::int AS copies
  FROM "CollectionItem" ci
  JOIN "CardPrint" p ON p.id = ci."printId"
  GROUP BY 1, 2
) mine ON mine."userId" = reach."userId" AND mine."setId" = reach."setId";
