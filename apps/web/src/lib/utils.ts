import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

// Formats (prix, dates…) : voir useFormat() dans lib/format.ts — ils dépendent de la langue.
