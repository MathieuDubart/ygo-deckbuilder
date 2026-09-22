import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { localeMiddleware } from './common/i18n/locale-context';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const config = app.get(AppConfig);

  app.set('trust proxy', 1); // derrière Caddy/Traefik/Nginx : vraie IP pour le rate-limit
  app.use(helmet());
  app.use(cookieParser());
  // Langue de la requête (cookie NEXT_LOCALE / Accept-Language) pour les textes générés
  app.use(localeMiddleware);
  app.enableCors({ origin: config.get('WEB_ORIGIN'), credentials: true });
  app.enableShutdownHooks();

  const port = config.get('PORT');
  await app.listen(port, '0.0.0.0');
  Logger.log(`API prête sur http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
