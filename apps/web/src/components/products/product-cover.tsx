'use client';
import type { CardSetDto } from '@ygo/shared';
import { Package } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Visuel d'un produit (boîte, tin, structure deck) avec replis successifs. */
export function ProductCover({
  set,
  className,
  sizes,
}: {
  set: Pick<CardSetDto, 'imageUrl' | 'fallbackImageUrl'>;
  className?: string;
  sizes: string;
}) {
  // Visuel HD indisponible → visuel de secours → pictogramme (jamais d'image cassée)
  const sources = [set.imageUrl, set.fallbackImageUrl].filter((u): u is string => !!u);
  const [attempt, setAttempt] = useState(0);
  const src = sources[attempt];
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-bg-sunken', className)}>
      {src ? (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          sizes={sizes}
          quality={90}
          className="object-contain p-1.5"
          onError={() => setAttempt((a) => a + 1)}
        />
      ) : (
        <div className="grid h-full place-items-center">
          <Package className="size-8 text-fg-subtle" strokeWidth={1.25} />
        </div>
      )}
    </div>
  );
}
