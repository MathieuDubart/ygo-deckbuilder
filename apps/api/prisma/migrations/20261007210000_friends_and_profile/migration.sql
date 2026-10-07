-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarPath" TEXT,
ADD COLUMN     "bannerPath" TEXT;

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCard" (
    "userId" TEXT NOT NULL,
    "printId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileCard_pkey" PRIMARY KEY ("userId","printId")
);

-- CreateIndex
CREATE INDEX "Friendship_addresseeId_status_idx" ON "Friendship"("addresseeId", "status");

-- CreateIndex
CREATE INDEX "Friendship_requesterId_status_idx" ON "Friendship"("requesterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "ProfileCard_userId_position_idx" ON "ProfileCard"("userId", "position");

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileCard" ADD CONSTRAINT "ProfileCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileCard" ADD CONSTRAINT "ProfileCard_printId_fkey" FOREIGN KEY ("printId") REFERENCES "CardPrint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Garde-fous que le schéma Prisma ne sait pas exprimer.

-- On ne peut pas être son propre ami : sans cette contrainte, une requête mal formée
-- créerait une relation réflexive qui apparaîtrait dans la liste d'amis de l'intéressé.
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_not_self" CHECK ("requesterId" <> "addresseeId");

-- Unicité de la paire NON ORDONNÉE : l'index unique (requesterId, addresseeId) laisse
-- passer A→B et B→A en même temps, soit deux relations pour deux personnes. Le service
-- accepte la demande inverse quand elle existe, mais la base doit aussi le garantir.
CREATE UNIQUE INDEX "Friendship_pair_key" ON "Friendship" (
    LEAST("requesterId", "addresseeId"),
    GREATEST("requesterId", "addresseeId")
);

-- Pseudo unique sans distinction de casse : il sert à se trouver et à s'ajouter, « Mathieu »
-- et « mathieu » ne doivent pas être deux comptes. Si cette migration échoue ici, c'est que
-- la base contient déjà deux pseudos qui ne diffèrent que par la casse — les renommer avant.
CREATE UNIQUE INDEX "User_username_lower_key" ON "User" (LOWER("username"));

-- La recherche d'amis fait un LIKE sur le pseudo normalisé
CREATE INDEX "User_username_lower_idx" ON "User" (LOWER("username") text_pattern_ops);
