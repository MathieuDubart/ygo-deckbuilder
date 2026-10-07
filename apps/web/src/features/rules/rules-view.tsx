import { Swords } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/feedback';
import type { DiagramLabels } from './rule-diagram';
import { RulesBrowser, type GlossaryEntry, type RuleLink, type RuleSection } from './rules-browser';

/**
 * Rappel des règles officielles (Master Rule actuelle) : préparation, tour, toutes les
 * Invocations, Jetons, Chaînes, compteurs, combat et format tournoi. Contenu statique par
 * langue (messages/<locale>/rules.json), schémas dessinés dans `rule-diagram.tsx`.
 */
export async function RulesView() {
  const t = await getTranslations('rules');
  const tDuel = await getTranslations('duel.phases');
  const sections = t.raw('sections') as RuleSection[];
  const diagrams = t.raw('diagrams') as DiagramLabels;

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Link
            href="/duel"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:brightness-110"
          >
            <Swords className="size-4" /> {t('labels.openDuel')}
          </Link>
        }
      />
      <RulesBrowser
        sections={sections}
        groups={t.raw('groups') as Record<string, string>}
        glossary={t.raw('glossary') as GlossaryEntry[]}
        links={t.raw('links') as RuleLink[]}
        // Les noms de phases viennent du simulateur : une seule traduction pour les deux pages
        diagrams={{
          ...diagrams,
          phaseDraw: tDuel('DRAW'),
          phaseStandby: tDuel('STANDBY'),
          phaseMain1: tDuel('MAIN1'),
          phaseBattle: tDuel('BATTLE'),
          phaseMain2: tDuel('MAIN2'),
          phaseEnd: tDuel('END'),
        }}
        labels={{
          points: t('labels.points'),
          example: t('labels.example'),
          exampleCards: t('labels.exampleCards'),
          glossary: t('labels.glossary'),
          glossaryHint: t('labels.glossaryHint'),
          links: t('labels.links'),
          linksHint: t('labels.linksHint'),
          search: t('labels.search'),
          noResults: t('labels.noResults'),
          video: t('labels.video'),
          videoLoad: t('labels.videoLoad'),
          videoConsent: t('labels.videoConsent'),
          videoOpen: t('labels.videoOpen'),
          clear: t('labels.clear'),
          toc: t('tocLabel'),
          source: t('source'),
        }}
      />
    </>
  );
}
