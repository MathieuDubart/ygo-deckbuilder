/**
 * Mise à jour du meta (listes de tournoi récentes → archétypes, listes types, staples) :
 *   pnpm meta:sync
 */
import './quiet';
import 'dotenv/config';
import { MetaSyncService } from '../modules/meta-decks/meta-sync.service';
import { onError, runTask } from './run';

runTask((app) => app.get(MetaSyncService).sync()).catch(onError);
