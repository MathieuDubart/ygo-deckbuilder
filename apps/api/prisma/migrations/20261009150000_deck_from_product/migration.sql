-- D'où vient un deck monté automatiquement depuis un produit. Nullable : la grande majorité
-- des decks sont écrits à la main et n'ont pas de liste d'origine.
--
-- L'index unique est ce qui rend le montage rejouable : le rattrapage au démarrage et la
-- case « ajouter aussi son deck » à l'import visent la même ligne, donc deux passages ne
-- posent qu'un deck. Sans lui, chaque redémarrage en empilerait une copie de plus.
--
-- ON DELETE SET NULL et non CASCADE : si une liste officielle disparaît du catalogue, le
-- deck de l'utilisateur lui appartient — il perd sa provenance, pas son existence.
ALTER TABLE "Deck" ADD COLUMN "productDeckId" TEXT;

ALTER TABLE "Deck" ADD CONSTRAINT "Deck_productDeckId_fkey"
  FOREIGN KEY ("productDeckId") REFERENCES "ProductDeck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Deck_userId_productDeckId_key" ON "Deck"("userId", "productDeckId");
