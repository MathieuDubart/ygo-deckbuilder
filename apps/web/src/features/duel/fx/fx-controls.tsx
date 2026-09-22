'use client';
import { Volume2, VolumeX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { FX_SPEEDS, setFxSettings, useFxSettings } from './settings';
import { play } from './sound';

/** Son et vitesse des animations du duel (mémorisés dans ce navigateur). */
export function FxControls() {
  const t = useTranslations('duel.controls');
  const { sound, speed } = useFxSettings();
  return (
    <div className="flex items-center gap-2 text-xs text-fg-muted">
      <button
        type="button"
        onClick={() => {
          setFxSettings({ sound: !sound });
          if (!sound) play('select');
        }}
        aria-pressed={sound}
        title={t('sound')}
        aria-label={t('sound')}
        className="rounded-lg p-1.5 hover:bg-bg-elevated hover:text-fg"
      >
        {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
      </button>
      <span className="hidden sm:inline">{t('speed.label')}</span>
      <div className="flex rounded-lg border border-border bg-bg-sunken p-0.5">
        {FX_SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={speed === s}
            onClick={() => setFxSettings({ speed: s })}
            className={cn(
              'rounded-md px-2 py-1 font-medium transition',
              speed === s ? 'bg-bg-elevated text-fg shadow-sm' : 'hover:text-fg',
            )}
          >
            {t(`speed.${s}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
