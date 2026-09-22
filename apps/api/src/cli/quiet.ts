/**
 * À importer EN PREMIER dans un script CLI : désactive les tâches de fond (crons, sync au
 * démarrage) avant que la config Nest ne lise l'environnement.
 */
process.env.CARD_SYNC_CRON = '';
process.env.META_SYNC_CRON = '';
process.env.CARD_SYNC_ON_BOOT = 'false';
process.env.PRODUCT_COVERS_ENABLED = 'false';
