import type {
  CardSummaryDto,
  DuelActionDto,
  DuelCardRef,
  DuelPromptDto,
  DuelStateDto,
} from '@ygo/shared';

/** Clé unique d'un emplacement : « contrôleur:zone:index ». */
export const refKey = (r: Pick<DuelCardRef, 'controller' | 'location' | 'sequence'>) =>
  `${r.controller}:${r.location}:${r.sequence}`;

export type CardMap = Record<string, CardSummaryDto>;

/** Actions IDLE / BATTLE regroupées par carte (clic sur la carte → ses actions). */
export function actionsByCard(prompt: DuelPromptDto | null): Map<string, DuelActionDto[]> {
  const map = new Map<string, DuelActionDto[]>();
  if (!prompt || (prompt.kind !== 'IDLE' && prompt.kind !== 'BATTLE')) return map;
  for (const action of prompt.actions) {
    const key = refKey(action.card);
    map.set(key, [...(map.get(key) ?? []), action]);
  }
  return map;
}

/** Zones cliquables pendant une invite PLACE. */
export function placeableZones(prompt: DuelPromptDto | null): Set<string> {
  if (prompt?.kind !== 'PLACE') return new Set();
  return new Set(prompt.zones.map(refKey));
}

/** L'invite attend-elle quelque chose de l'utilisateur (lui ou l'adversaire qu'il contrôle) ? */
export const isInteractive = (state: DuelStateDto) => !!state.prompt && !state.finished;

export const cardName = (cards: CardMap, code: number) =>
  code ? (cards[code]?.name ?? `#${code}`) : null;

/**
 * Textes système d'EDOPro à trous (« Activate the Trigger Effect of "%ls" from [%ls]? ») :
 * les `%ls` / `%d` sont remplis dans l'ordre, les trous sans valeur disparaissent.
 */
export function fillSystemText(text: string, values: string[]): string {
  let i = 0;
  return text
    .replace(/%l?[sd]/g, () => values[i++] ?? '')
    .replace(/\s*\[\]/g, '')
    .replace(/""/g, '')
    .trim();
}
