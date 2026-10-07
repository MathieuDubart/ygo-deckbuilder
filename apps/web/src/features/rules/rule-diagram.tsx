import { cn } from '@/lib/utils';

/**
 * Schémas d'illustration de la page Règles : SVG dessinés avec les couleurs du thème
 * (donc valides en clair comme en sombre), sans image ni police externe. Les textes
 * viennent de `rules.diagrams` pour rester traduits.
 */
export type DiagramLabels = Record<string, string>;

const TONES = {
  neutral: 'fill-bg-sunken stroke-border',
  monster: 'fill-monster/20 stroke-monster/60',
  spell: 'fill-spell/20 stroke-spell/60',
  trap: 'fill-trap/20 stroke-trap/60',
  extra: 'fill-extra/20 stroke-extra/60',
  accent: 'fill-accent/20 stroke-accent/70',
  faint: 'fill-bg-sunken/60 stroke-border',
} as const;
type Tone = keyof typeof TONES;

interface BoxProps {
  x: number;
  y: number;
  w?: number;
  h?: number;
  tone?: Tone;
  dashed?: boolean;
  /** Texte au centre de la boîte */
  text?: string;
  /** Deuxième ligne au centre */
  text2?: string;
  /** Légende sous la boîte */
  sub?: string;
}

function Box({ x, y, w = 30, h = 42, tone = 'neutral', dashed, text, text2, sub }: BoxProps) {
  const cy = y + h / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3.5}
        strokeWidth={1}
        strokeDasharray={dashed ? '3 2.5' : undefined}
        className={TONES[tone]}
      />
      {text && (
        <text
          x={x + w / 2}
          y={text2 ? cy - 1 : cy + 3}
          textAnchor="middle"
          className="fill-fg text-[8px] font-semibold"
        >
          {text}
        </text>
      )}
      {text2 && (
        <text x={x + w / 2} y={cy + 8} textAnchor="middle" className="fill-fg-muted text-[7px]">
          {text2}
        </text>
      )}
      {sub && (
        <text
          x={x + w / 2}
          y={y + h + 8.5}
          textAnchor="middle"
          className="fill-fg-subtle text-[7px]"
        >
          {sub}
        </text>
      )}
    </g>
  );
}

/** Texte libre du schéma */
function T({
  x,
  y,
  children,
  anchor = 'middle',
  strong,
  muted,
  accent,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  anchor?: 'start' | 'middle' | 'end';
  strong?: boolean;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      className={cn(
        'text-[7.5px]',
        accent ? 'fill-accent' : muted ? 'fill-fg-subtle' : 'fill-fg-muted',
        strong && 'text-[8px] font-semibold',
      )}
    >
      {children}
    </text>
  );
}

/** Flèche horizontale vers la droite */
function ArrowR({
  x,
  y,
  len = 16,
  accent,
}: {
  x: number;
  y: number;
  len?: number;
  accent?: boolean;
}) {
  const c = accent ? 'stroke-accent fill-accent' : 'stroke-border-strong fill-border-strong';
  return (
    <g className={c}>
      <line x1={x} y1={y} x2={x + len - 3.5} y2={y} strokeWidth={1.2} />
      <polygon points={`${x + len},${y} ${x + len - 4.5},${y - 2.6} ${x + len - 4.5},${y + 2.6}`} />
    </g>
  );
}

/** Flèche verticale vers le bas */
function ArrowD({
  x,
  y,
  len = 14,
  accent,
}: {
  x: number;
  y: number;
  len?: number;
  accent?: boolean;
}) {
  const c = accent ? 'stroke-accent fill-accent' : 'stroke-border-strong fill-border-strong';
  return (
    <g className={c}>
      <line x1={x} y1={y} x2={x} y2={y + len - 3.5} strokeWidth={1.2} />
      <polygon points={`${x},${y + len} ${x - 2.6},${y + len - 4.5} ${x + 2.6},${y + len - 4.5}`} />
    </g>
  );
}

function Plus({ x, y }: { x: number; y: number }) {
  return (
    <text x={x} y={y} textAnchor="middle" className="fill-fg-subtle text-[11px]">
      +
    </text>
  );
}

/** Étoiles de Niveau / Rang */
function Stars({ x, y, count, rank }: { x: number; y: number; count: number; rank?: boolean }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      className={cn('text-[7px]', rank ? 'fill-extra' : 'fill-accent')}
    >
      {(rank ? '◇' : '★').repeat(count)}
    </text>
  );
}

/** Rangée de zones identiques */
function Zones({
  x,
  y,
  count,
  w = 24,
  h = 16,
  gap = 4,
  tone = 'neutral',
  dashed,
}: {
  x: number;
  y: number;
  count: number;
  w?: number;
  h?: number;
  gap?: number;
  tone?: Tone;
  dashed?: boolean;
}) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => (
        <Box key={i} x={x + i * (w + gap)} y={y} w={w} h={h} tone={tone} dashed={dashed} />
      ))}
    </g>
  );
}

type Diagram = (d: DiagramLabels) => React.ReactNode;

/* ------------------------------------------------------------------ Le Terrain */
const field: Diagram = (d) => (
  <svg viewBox="0 0 320 174" role="img" aria-label={d.monsterZones} className="w-full">
    {/* Côté adverse, en sourdine (le miroir du vôtre) */}
    <T x={6} y={38} anchor="start" muted>
      {d.opponentSide}
    </T>
    <Zones x={88} y={14} count={5} tone="faint" />
    <Zones x={88} y={34} count={5} tone="faint" />
    <Box x={248} y={14} w={24} h={36} tone="faint" />

    {/* Zones Monstre Extra, au milieu */}
    <Box x={112} y={60} w={40} h={20} tone="extra" dashed />
    <Box x={160} y={60} w={40} h={20} tone="extra" dashed />
    <T x={156} y={91} accent strong>
      {`${d.extraZones} — ${d.shared}`}
    </T>
    <line
      x1={8}
      y1={98}
      x2={312}
      y2={98}
      strokeWidth={0.8}
      strokeDasharray="4 3"
      className="stroke-border"
    />

    {/* Votre côté */}
    <T x={6} y={135} anchor="start" strong>
      {d.youSide}
    </T>
    <Zones x={88} y={106} count={5} h={18} tone="monster" />
    <T x={156} y={132} muted>
      {d.monsterZones}
    </T>
    <Zones x={88} y={138} count={5} h={18} tone="spell" />
    <T x={156} y={164} muted>
      {d.spellZones}
    </T>
    <Box x={56} y={106} w={24} h={50} tone="neutral" />
    <T x={68} y={164} muted>
      {d.fieldZone}
    </T>
  </svg>
);

/* ------------------------------------------------------------------ Tour */
const turn: Diagram = (d) => {
  const names = [
    'phaseDraw',
    'phaseStandby',
    'phaseMain1',
    'phaseBattle',
    'phaseMain2',
    'phaseEnd',
  ].map((key) => d[key] ?? '');
  return (
    <svg viewBox="0 0 320 82" role="img" aria-label={names.join(' - ')} className="w-full">
      {names.map((name, i) => {
        const x = 4 + i * 53;
        const battle = i === 3;
        // « Main Phase 1 » ne tient pas sur une ligne : coupé au dernier espace
        const cut = name.lastIndexOf(' ');
        const [top, bottom] =
          cut > 0 ? [name.slice(0, cut), name.slice(cut + 1)] : [name, undefined];
        return (
          <g key={i}>
            <Box
              x={x}
              y={20}
              w={46}
              h={26}
              tone={battle ? 'accent' : 'neutral'}
              dashed={battle}
              text={top}
              text2={bottom}
            />
            {i < 5 && <ArrowR x={x + 47} y={33} len={6} />}
          </g>
        );
      })}
      <T x={186} y={60} accent>
        {d.optional}
      </T>
      <T x={186} y={72} muted>
        {d.notFirstTurn}
      </T>
    </svg>
  );
};

/* ------------------------------------------------------------------ Sacrifices */
const tributes: Diagram = (d) => (
  <svg viewBox="0 0 320 104" role="img" aria-label={d.tributes} className="w-full">
    {[
      { x: 10, level: '1-4', tributes: 0, note: d.noTribute },
      { x: 112, level: '5-6', tributes: 1, note: `1 ${d.tribute}` },
      { x: 214, level: '7+', tributes: 2, note: `2 ${d.tributes}` },
    ].map((col) => (
      <g key={col.level}>
        <T x={col.x + 48} y={12} strong>
          {`${d.level} ${col.level}`}
        </T>
        {col.tributes === 0 ? (
          <Box x={col.x + 33} y={20} w={30} h={42} tone="monster" text="★" />
        ) : (
          <>
            {Array.from({ length: col.tributes }, (_, i) => (
              <Box key={i} x={col.x + i * 20} y={20} w={18} h={42} tone="faint" dashed />
            ))}
            <ArrowR x={col.x + col.tributes * 20 + 2} y={41} len={12} accent />
            <Box x={col.x + col.tributes * 20 + 18} y={20} w={30} h={42} tone="monster" text="★" />
          </>
        )}
        <T x={col.x + 48} y={78} accent>
          {col.note}
        </T>
      </g>
    ))}
  </svg>
);

/* ------------------------------------------------------------------ Fusion */
const fusion: Diagram = (d) => (
  <svg viewBox="0 0 320 96" role="img" aria-label={d.fusion} className="w-full">
    <Box x={10} y={16} w={30} h={42} tone="monster" sub={d.materials} />
    <Plus x={48} y={41} />
    <Box x={56} y={16} w={30} h={42} tone="monster" sub={d.materials} />
    <Plus x={94} y={41} />
    <Box x={102} y={16} w={30} h={42} tone="spell" text={d.spell} />
    <ArrowR x={138} y={37} len={26} accent />
    <Box x={170} y={10} w={36} h={54} tone="extra" text={d.fusion} />
    <T x={188} y={80} muted>
      {d.extraDeck}
    </T>
    <ArrowD x={71} y={62} len={12} />
    <T x={71} y={92} muted>
      {d.grave}
    </T>
  </svg>
);

/* ------------------------------------------------------------------ Rituel */
const ritual: Diagram = (d) => (
  <svg viewBox="0 0 320 96" role="img" aria-label={d.ritual} className="w-full">
    <Box x={10} y={16} w={30} h={42} tone="spell" text={d.spell} sub={d.ritual} />
    <Plus x={48} y={41} />
    <Box x={56} y={16} w={26} h={42} tone="faint" dashed />
    <Plus x={88} y={41} />
    <Box x={96} y={16} w={26} h={42} tone="faint" dashed />
    <T x={89} y={76} muted>
      {`${d.tributes} — ${d.sum} ★`}
    </T>
    <ArrowR x={130} y={37} len={26} accent />
    <Box x={162} y={10} w={36} h={54} tone="monster" text={d.ritual} />
    <T x={180} y={80} muted>
      {d.fromHandDeck}
    </T>
  </svg>
);

/* ------------------------------------------------------------------ Synchro */
const synchro: Diagram = (d) => (
  <svg viewBox="0 0 320 100" role="img" aria-label={d.synchro} className="w-full">
    <Box x={10} y={18} w={30} h={42} tone="accent" text="★★★" sub={d.tuner} />
    <Plus x={48} y={43} />
    <Box x={56} y={18} w={30} h={42} tone="monster" text="★★★★★" sub={d.nonTuner} />
    <T x={60} y={12} muted>
      {`3 + 5 = 8 (${d.sum})`}
    </T>
    <ArrowR x={94} y={39} len={26} accent />
    <Box x={126} y={12} w={36} h={54} tone="extra" text="★★★★★★★★" text2={`${d.level} 8`} />
    <T x={144} y={82} muted>
      {d.synchro}
    </T>
    <ArrowD x={48} y={64} len={12} />
    <T x={48} y={94} muted>
      {d.grave}
    </T>
  </svg>
);

/* ------------------------------------------------------------------ Xyz */
const xyz: Diagram = (d) => (
  <svg viewBox="0 0 320 104" role="img" aria-label={d.xyz} className="w-full">
    <Box x={10} y={18} w={30} h={42} tone="monster" text="★★★★" />
    <Plus x={48} y={43} />
    <Box x={56} y={18} w={30} h={42} tone="monster" text="★★★★" />
    <T x={48} y={74} muted>
      {d.sameLevel}
    </T>
    <ArrowR x={94} y={39} len={26} accent />
    <Box x={136} y={30} w={34} h={44} tone="faint" />
    <Box x={130} y={24} w={34} h={44} tone="faint" />
    <Box x={124} y={16} w={36} h={48} tone="extra" text="◇◇◇◇" text2={`${d.rank} 4`} />
    <T x={178} y={44} anchor="start" muted>
      {d.attached}
    </T>
    <T x={142} y={86} muted>
      {d.materials}
    </T>
  </svg>
);

/* ------------------------------------------------------------------ Pendule */
const pendulum: Diagram = (d) => (
  <svg viewBox="0 0 320 94" role="img" aria-label={d.scale} className="w-full">
    <Box x={10} y={18} w={34} h={44} tone="extra" text="1" sub={d.scale} />
    <Box x={266} y={18} w={34} h={44} tone="extra" text="8" sub={d.scale} />
    <rect
      x={52}
      y={32}
      width={206}
      height={16}
      rx={8}
      className="fill-accent/15 stroke-accent/50"
      strokeWidth={1}
    />
    <T x={155} y={43} accent strong>
      {`★2 → ★7 — ${d.between}`}
    </T>
    <line x1={44} y1={40} x2={52} y2={40} strokeWidth={1} className="stroke-accent/50" />
    <line x1={258} y1={40} x2={266} y2={40} strokeWidth={1} className="stroke-accent/50" />
    <T x={155} y={86} muted>
      {d.extraDeck}
    </T>
  </svg>
);

/* ------------------------------------------------------------------ Lien */
const link: Diagram = (d) => (
  <svg viewBox="0 0 320 110" role="img" aria-label={d.link} className="w-full">
    <Box x={10} y={24} w={26} h={40} tone="monster" />
    <Plus x={43} y={47} />
    <Box x={50} y={24} w={26} h={40} tone="monster" />
    <Plus x={83} y={47} />
    <Box x={90} y={24} w={26} h={40} tone="monster" />
    <T x={63} y={78} muted>
      {d.materials}
    </T>
    <ArrowD x={63} y={84} len={12} />
    <T x={63} y={106} muted>
      {d.grave}
    </T>
    <ArrowR x={124} y={44} len={24} accent />
    <Box x={176} y={22} w={40} h={46} tone="spell" text={`${d.linkRating} 3`} />
    {/* Flèches de Lien : haut, gauche, bas */}
    <polygon points="196,14 191,21 201,21" className="fill-accent" />
    <polygon points="168,45 175,40 175,50" className="fill-accent" />
    <polygon points="196,76 191,69 201,69" className="fill-accent" />
    <T x={244} y={47} anchor="start" muted>
      {d.pointed}
    </T>
    <Box x={176} y={82} w={40} h={14} tone="neutral" dashed />
  </svg>
);

/* ------------------------------------------------------------------ Zones Extra */
const emz: Diagram = (d) => (
  <svg viewBox="0 0 320 128" role="img" aria-label={d.extraZones} className="w-full">
    <T x={160} y={11} muted>
      {d.opponentSide}
    </T>
    <Zones x={100} y={16} count={5} w={24} h={12} tone="faint" />
    <Box x={106} y={38} w={44} h={20} tone="extra" dashed />
    <Box x={162} y={38} w={44} h={20} tone="extra" text={`${d.linkRating} 2`} />
    <T x={160} y={70} accent strong>
      {`${d.extraZones} — ${d.shared}`}
    </T>
    <polygon points="178,62 173,69 183,69" className="fill-accent" />
    <Zones x={100} y={78} count={5} w={24} h={16} tone="monster" />
    <T x={160} y={104} muted>
      {d.monsterZones}
    </T>
    <T x={160} y={120} accent>
      {d.pointed}
    </T>
  </svg>
);

/* ------------------------------------------------------------------ Jetons */
const tokens: Diagram = (d) => (
  <svg viewBox="0 0 320 92" role="img" aria-label={d.token} className="w-full">
    <Box x={16} y={18} w={34} h={44} tone="accent" text={d.token} />
    <T x={33} y={80} muted>
      {d.monsterZones}
    </T>
    <ArrowR x={58} y={40} len={22} />
    <T x={104} y={30} muted>
      {d.destroyed}
    </T>
    <Box x={86} y={34} w={36} h={26} tone="faint" dashed text="✕" />
    <ArrowR x={128} y={47} len={22} accent />
    <Box x={158} y={26} w={44} h={34} tone="neutral" dashed text={d.grave} />
    <line x1={160} y1={58} x2={200} y2={28} strokeWidth={1.4} className="stroke-danger" />
    <T x={258} y={44} strong accent>
      {d.removed}
    </T>
  </svg>
);

/* ------------------------------------------------------------------ Chaîne */
const chain: Diagram = (d) => (
  <svg viewBox="0 0 320 88" role="img" aria-label={d.chainLink} className="w-full">
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <Box
          x={16 + i * 16}
          y={12 + i * 22}
          w={120}
          h={18}
          tone={i === 2 ? 'accent' : 'neutral'}
          text={`${d.chainLink} ${i + 1}`}
        />
        {i < 2 && <ArrowD x={24 + i * 16} y={30 + i * 22} len={5} />}
      </g>
    ))}
    <T x={168} y={23} anchor="start" muted>
      {d.activate}
    </T>
    <ArrowD x={176} y={28} len={38} />
    <T x={232} y={34} anchor="start" accent strong>
      {`${d.resolution} : 3 → 2 → 1`}
    </T>
  </svg>
);

/* ------------------------------------------------------------------ Compteurs */
const counters: Diagram = (d) => (
  <svg viewBox="0 0 320 90" role="img" aria-label={d.counters} className="w-full">
    <Box x={16} y={18} w={34} h={46} tone="spell" />
    {[0, 1, 2].map((i) => (
      <circle
        key={i}
        cx={24 + i * 9}
        cy={26}
        r={3.2}
        className="fill-accent stroke-bg"
        strokeWidth={0.8}
      />
    ))}
    <T x={33} y={76} muted>
      {`3 ${d.counters}`}
    </T>
    <ArrowR x={58} y={41} len={24} accent />
    <T x={108} y={32} muted>
      {`${d.remove} 3`}
    </T>
    <Box x={88} y={36} w={40} h={22} tone="accent" text={d.activate} />
    <ArrowR x={134} y={47} len={22} />
    <Box x={164} y={26} w={34} h={46} tone="spell" />
    <T x={181} y={84} muted>
      {`0 ${d.counters}`}
    </T>
    <T x={258} y={48} muted>
      {d.resolution}
    </T>
  </svg>
);

/* ------------------------------------------------------------------ Combat */
const battle: Diagram = (d) => (
  <svg viewBox="0 0 320 120" role="img" aria-label={d.damage} className="w-full">
    {[
      {
        y: 6,
        atk: '1800 ATK',
        def: '1200 ATK',
        note: `${d.destroyed} — 600 ${d.damage}`,
        danger: true,
      },
      {
        y: 64,
        atk: '1800 ATK',
        def: '1200 DEF',
        note: `${d.destroyed} — ${d.noDamage}`,
        danger: true,
      },
    ].map((row) => (
      <g key={row.y}>
        <Box x={16} y={row.y + 6} w={44} h={38} tone="monster" text={row.atk} />
        <ArrowR x={64} y={row.y + 25} len={22} accent />
        <Box
          x={92}
          y={row.y + 6}
          w={44}
          h={38}
          tone={row.danger ? 'monster' : 'faint'}
          text={row.def}
        />
        <T x={240} y={row.y + 28} muted>
          {row.note}
        </T>
        {row.danger && (
          <line
            x1={94}
            y1={row.y + 42}
            x2={134}
            y2={row.y + 8}
            strokeWidth={1.4}
            className="stroke-danger"
          />
        )}
      </g>
    ))}
    <line
      x1={16}
      y1={58}
      x2={304}
      y2={58}
      strokeWidth={0.8}
      strokeDasharray="4 3"
      className="stroke-border"
    />
  </svg>
);

const DIAGRAMS: Record<string, Diagram> = {
  field,
  turn,
  tributes,
  fusion,
  ritual,
  synchro,
  xyz,
  pendulum,
  link,
  emz,
  tokens,
  chain,
  counters,
  battle,
};

/** Rend le schéma `id` s'il existe, sinon rien. */
export function RuleDiagram({ id, labels }: { id: string; labels: DiagramLabels }) {
  const draw = DIAGRAMS[id];
  if (!draw) return null;
  return (
    <figure className="mt-5 overflow-hidden rounded-xl border border-border bg-bg-sunken/60 px-3 py-4">
      {draw(labels)}
    </figure>
  );
}
