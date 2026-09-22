import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../app.module';

/**
 * Lance une tâche ponctuelle dans le contexte Nest, sans serveur HTTP ni tâches de fond.
 * (Compilé par `nest build` : les métadonnées de décorateurs nécessaires à l'injection
 * de dépendances n'existent pas avec tsx/esbuild.)
 */
export async function runTask(task: (app: INestApplicationContext) => Promise<unknown>) {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    console.log(await task(app));
  } finally {
    await app.close();
  }
}

export const onError = (e: unknown) => {
  console.error(e);
  process.exit(1);
};
