-- Popularité des cartes (vues YGOPRODeck) : départage les compléments génériques des decks générés

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "popularity" INTEGER;
