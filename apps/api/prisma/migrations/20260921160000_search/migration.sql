-- Recherche tolérante (FR/EN) : sans accents, sans ponctuation, insensible à la casse,
-- avec index trigrammes pour les recherches partielles et floues.

-- pg_trgm est une extension "trusted" : le propriétaire de la base peut la créer.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Normalisation unique, utilisée pour le texte stocké ET pour la requête de l'utilisateur.
-- "Épée-Magique : l'Élu"  →  "epee magique l elu"
CREATE OR REPLACE FUNCTION ygo_normalize(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT btrim(regexp_replace(
    translate(
      replace(replace(replace(lower(coalesce(input, '')), 'œ', 'oe'), 'æ', 'ae'), 'ß', 'ss'),
      'àáâãäåāăąçćĉċčďđèéêëēĕėęěĝğġģĥħìíîïĩīĭįıĵķĺļľŀłñńņňòóôõöøōŏőŕŗřśŝşšţťŧùúûüũūŭůűųŵýÿŷźżž',
      'aaaaaaaaacccccddeeeeeeeeegggghhiiiiiiiiijklllllnnnnooooooooorrrsssstttuuuuuuuuuuwyyyzzz'
    ),
    '[^a-z0-9]+', ' ', 'g'
  ))
$$;

-- AlterTable
ALTER TABLE "Card" ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CardSet" ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';

-- Backfill des données déjà synchronisées
UPDATE "Card"
SET "searchText" = ygo_normalize(concat_ws(' ', "nameFr", "name", "archetype"));
UPDATE "CardSet"
SET "searchText" = ygo_normalize(concat_ws(' ', "name", "code"));

-- CreateIndex
CREATE INDEX "Card_searchText_idx" ON "Card" USING GIN ("searchText" gin_trgm_ops);
CREATE INDEX "CardSet_searchText_idx" ON "CardSet" USING GIN ("searchText" gin_trgm_ops);
