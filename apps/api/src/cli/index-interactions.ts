/**
 * Reconstruit l'index des interactions entre cartes (fait automatiquement après chaque
 * sync du catalogue) :
 *   pnpm interactions:index
 */
import './quiet';
import 'dotenv/config';
import { InteractionIndexService } from '../modules/synergy/interaction-index.service';
import { onError, runTask } from './run';

runTask(async (app) => ({ links: await app.get(InteractionIndexService).rebuild() })).catch(
  onError,
);
