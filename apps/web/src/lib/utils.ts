import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
export const formatPrice = (v: number | null | undefined) => (v == null ? '—' : eur.format(v));

export const formatPercent = (v: number) => `${Math.round(v * 100)} %`;
