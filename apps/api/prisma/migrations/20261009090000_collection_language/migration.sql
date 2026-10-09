-- Langue dans laquelle l'utilisateur range sa collection. Volontairement nullable : NULL veut
-- dire « jamais choisie », et on retombe alors sur la langue de la requête. Mettre un défaut
-- ferait croire à un choix que personne n'a fait, et l'écran de normalisation s'en sert pour
-- distinguer « je n'ai rien décidé » de « j'ai décidé l'anglais ».
ALTER TABLE "User" ADD COLUMN "collectionLanguage" "CardLanguage";
