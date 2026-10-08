'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BanlistStatusDto } from '@ygo/shared';
import { api } from './client';
import { qk } from './keys';

/**
 * Demande au serveur de relire la banlist si elle a vieilli, et recharge ce qui en dépend
 * seulement si un statut a bougé. Appelé à l'ouverture d'un deck : la banlist change bien plus
 * souvent que le reste du catalogue, et un deck validé contre une liste périmée est un deck faux
 * au tournoi.
 *
 * Volontairement une mutation et pas une requête : ça écrit côté serveur, ça ne doit pas se
 * rejouer tout seul au remontage, et le deck ne l'attend pas pour s'afficher.
 */
export function useRefreshBanlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<BanlistStatusDto>('/banlist/refresh', { method: 'POST' }),
    onSuccess: (status) => {
      if (!status.changed) return;
      // Les statuts vivent dans les cartes : tout ce qui en affiche doit être relu
      void qc.invalidateQueries({ queryKey: qk.decks });
      void qc.invalidateQueries({ queryKey: ['deck'] });
      void qc.invalidateQueries({ queryKey: ['cards'] });
      void qc.invalidateQueries({ queryKey: ['card'] });
    },
    // Une banlist injoignable n'empêche pas de construire un deck : on garde la dernière connue
    onError: () => {},
  });
}
