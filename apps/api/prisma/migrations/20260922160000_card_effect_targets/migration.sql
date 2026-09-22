-- CreateTable
CREATE TABLE "CardEffectTarget" (
    "id" SERIAL NOT NULL,
    "cardId" INTEGER NOT NULL,
    "verb" TEXT NOT NULL,
    "locations" TEXT[],
    "quoted" TEXT[],
    "keys" TEXT[],
    "except" TEXT[],
    "kinds" TEXT[],
    "subtypes" TEXT[],
    "races" TEXT[],
    "attributes" TEXT[],
    "levelEq" INTEGER,
    "levelMin" INTEGER,
    "levelMax" INTEGER,
    "tuner" BOOLEAN,
    "nonTuner" BOOLEAN,
    "precision" INTEGER NOT NULL,

    CONSTRAINT "CardEffectTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardEffectTarget_cardId_idx" ON "CardEffectTarget"("cardId");

-- CreateIndex
CREATE INDEX "CardEffectTarget_keys_idx" ON "CardEffectTarget" USING GIN ("keys");

-- CreateIndex
CREATE INDEX "CardEffectTarget_precision_idx" ON "CardEffectTarget"("precision");

-- AddForeignKey
ALTER TABLE "CardEffectTarget" ADD CONSTRAINT "CardEffectTarget_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
