-- Étiquettes posées sur un deck, exactement comme sur une carte ou une extension : les
-- mêmes `Tag`, la même table de pose, le même cumul en filtre.
--
-- Pas de colonne `userId` ici : elle vivrait en double (le deck a la sienne, l'étiquette
-- aussi) et pourrait diverger. Les requêtes joignent `Tag` sur `userId`, ce qui suffit à
-- garantir qu'on ne filtre jamais sur l'étiquette d'un autre compte.
CREATE TABLE "DeckTag" (
  "tagId"  TEXT NOT NULL,
  "deckId" TEXT NOT NULL,
  CONSTRAINT "DeckTag_pkey" PRIMARY KEY ("tagId", "deckId")
);

-- Le sens le plus lu : « les étiquettes de ce deck », pour la liste comme pour la fiche.
CREATE INDEX "DeckTag_deckId_idx" ON "DeckTag"("deckId");

ALTER TABLE "DeckTag" ADD CONSTRAINT "DeckTag_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeckTag" ADD CONSTRAINT "DeckTag_deckId_fkey"
  FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
