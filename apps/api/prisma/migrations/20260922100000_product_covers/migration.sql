-- Visuels HD des produits (Yugipedia)

-- AlterTable
ALTER TABLE "CardSet" ADD COLUMN     "coverCheckedAt" TIMESTAMP(3),
ADD COLUMN     "coverUrl" TEXT;
