import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Route accessible sans être connecté (l'utilisateur est quand même résolu s'il a un token). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
