import { Module } from '@nestjs/common';
import { MetaDecksController } from './meta-decks.controller';
import { MetaDecksService } from './meta-decks.service';

@Module({ controllers: [MetaDecksController], providers: [MetaDecksService] })
export class MetaDecksModule {}
