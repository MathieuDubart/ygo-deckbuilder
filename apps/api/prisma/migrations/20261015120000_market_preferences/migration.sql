-- Préférences d'achat : ce qu'on veut voir en arrivant sur une place de marché. Les deux
-- colonnes sont nullables, et NULL ne veut pas dire la même chose pour l'une et pour l'autre.
--
-- `marketLanguage` : NULL = « comme ma collection ». La langue de rangement est déjà un choix
-- assumé, et en redemander un ici obligerait à le tenir à jour à deux endroits. Une valeur
-- explicite sert à qui range en français mais achète en anglais, ce qui est courant.
--
-- `marketMinCondition` : NULL = aucun filtre d'état, on voit toutes les offres. Choisir un
-- défaut reviendrait à cacher des offres que personne n'a demandé de cacher.
ALTER TABLE "User" ADD COLUMN "marketLanguage" "CardLanguage";
ALTER TABLE "User" ADD COLUMN "marketMinCondition" "CardCondition";
