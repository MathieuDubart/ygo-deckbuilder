'use client';
import { ExternalLink, Play } from 'lucide-react';
import { useState } from 'react';

export interface RuleVideo {
  /** Identifiant YouTube */
  id: string;
  title: string;
  channel: string;
}

/**
 * Tuto vidéo d'une section, en « click-to-load » : tant que personne ne clique, rien n'est
 * demandé à YouTube — ni image, ni script, ni cookie. Au clic, l'iframe est chargée depuis
 * youtube-nocookie.com. La vignette est dessinée avec les couleurs du thème, donc la page
 * reste autonome (utile en self-hosting et hors ligne).
 */
export function RuleVideo({
  video,
  labels,
}: {
  video: RuleVideo;
  labels: { video: string; load: string; consent: string; open: string };
}) {
  const [playing, setPlaying] = useState(false);
  const watchUrl = `https://www.youtube.com/watch?v=${video.id}`;

  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">
        {labels.video}
      </p>
      <div className="overflow-hidden rounded-xl border border-border bg-bg-sunken">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="aspect-video w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`${labels.load} : ${video.title}`}
            className="group flex w-full cursor-pointer items-center gap-4 px-4 py-4 text-left transition hover:bg-bg-elevated"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg transition group-hover:brightness-110">
              <Play className="size-5 translate-x-px fill-current" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{video.title}</span>
              <span className="block truncate text-xs text-fg-subtle">{video.channel}</span>
            </span>
          </button>
        )}
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
        {!playing && <span>{labels.consent}</span>}
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-fg"
        >
          <ExternalLink className="size-3" />
          {labels.open}
        </a>
      </p>
    </div>
  );
}
