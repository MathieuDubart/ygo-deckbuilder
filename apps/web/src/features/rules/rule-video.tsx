import { ExternalLink } from 'lucide-react';

export interface RuleVideo {
  /** Identifiant YouTube */
  id: string;
  title: string;
  channel: string;
}

/**
 * Tuto vidéo d'une section. L'iframe est posée directement, en `loading="lazy"` : la page
 * compte une douzaine de vidéos, elles ne se chargent donc qu'au fur et à mesure du
 * défilement. L'hôte `youtube-nocookie.com` est l'embed sans cookie publicitaire de YouTube.
 */
export function RuleVideo({
  video,
  labels,
}: {
  video: RuleVideo;
  labels: { video: string; open: string };
}) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-medium text-fg-subtle">{labels.video}</p>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0`}
        title={video.title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full rounded-xl border border-border bg-bg-sunken"
      />
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
        <span>
          {video.title} — {video.channel}
        </span>
        <a
          href={`https://www.youtube.com/watch?v=${video.id}`}
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
