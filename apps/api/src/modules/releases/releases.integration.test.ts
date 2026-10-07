/**
 * Vérification du SQL du suivi par extension contre un vrai PostgreSQL : agrégats
 * d'avancement, filtres, tris, facettes, étiquettes. Rien ici n'est simulé — c'est le seul
 * moyen d'attraper une requête qui compile mais ne tourne pas.
 *
 * Désactivé sans base : la CI n'en a pas. Pour le lancer, un Postgres vide suffit (les
 * migrations sont appliquées par Prisma), puis :
 *   INTEGRATION_DATABASE_URL=postgresql://ygo@127.0.0.1:5432/ygo_test \
 *     pnpm --filter @ygo/api test
 *
 * ATTENTION : ce test vide les tables de la base pointée. Jamais sur une base utile.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../../generated/prisma/client';
import { CollectionService } from '../collection/collection.service';
import { TagsService } from '../tags/tags.service';
import { ReleasesService } from './releases.service';

const URL = process.env.INTEGRATION_DATABASE_URL;

describe.runIf(URL)('suivi par extension (PostgreSQL réel)', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL! }) });
  // Les services ne reçoivent qu'un PrismaClient : pas besoin du contexte Nest ici.
  const asService = prisma as unknown as ConstructorParameters<typeof ReleasesService>[0];
  const releases = new ReleasesService(asService);
  const collection = new CollectionService(asService);
  const tags = new TagsService(asService);

  const USER = 'user-test';
  const soon = new Date(Date.now() + 20 * 86_400_000);

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE "User", "CardSet", "Card" CASCADE`);
    await prisma.user.create({
      data: { id: USER, email: 'a@b.c', username: 'tester', passwordHash: 'x' },
    });
    // Un booster sorti, avec deux cartes et trois impressions
    const released = await prisma.cardSet.create({
      data: {
        name: 'Beyond the Brave',
        code: 'BETB',
        cardCount: 100,
        tcgDate: new Date('2026-10-01'),
      },
    });
    // Une extension annoncée, liste pas encore révélée
    await prisma.cardSet.create({
      data: { name: 'Glorious Victors', code: 'GLVI', tcgDate: soon, announcedAt: new Date() },
    });
    const other = await prisma.cardSet.create({
      data: { name: 'Old Reprint Tin', code: 'OTIN', tcgDate: new Date('2015-01-01') },
    });

    for (const [id, name] of [
      [1, 'Blue-Eyes White Dragon'],
      [2, 'Raigeki'],
    ] as const) {
      await prisma.card.create({
        data: {
          id,
          name,
          category: id === 1 ? 'MONSTER' : 'SPELL',
          type: 'x',
          frameType: 'y',
          desc: 'd',
          archetype: id === 1 ? 'Blue-Eyes' : null,
          attribute: id === 1 ? 'LIGHT' : null,
          race: id === 1 ? 'Dragon' : null,
          priceCardmarket: 10,
          searchText: name.toLowerCase(),
        },
      });
    }
    const p1 = await prisma.cardPrint.create({
      data: {
        cardId: 1,
        setId: released.id,
        printCode: 'BETB-EN001',
        rarity: 'Ultra Rare',
        price: 20,
      },
    });
    await prisma.cardPrint.create({
      data: {
        cardId: 1,
        setId: released.id,
        printCode: 'BETB-EN001',
        rarity: 'Secret Rare',
        price: 50,
      },
    });
    await prisma.cardPrint.create({
      data: { cardId: 2, setId: released.id, printCode: 'BETB-EN002', rarity: 'Common', price: 1 },
    });
    // La même carte 2, mais dans une autre extension : c'est elle qui alimente « toutes éditions »
    const elsewhere = await prisma.cardPrint.create({
      data: { cardId: 2, setId: other.id, printCode: 'OTIN-EN050', rarity: 'Common', price: 2 },
    });

    await prisma.collectionItem.create({
      data: { userId: USER, cardId: 1, printId: p1.id, quantity: 2 },
    });
    await prisma.collectionItem.create({
      data: { userId: USER, cardId: 2, printId: elsewhere.id, quantity: 1 },
    });
    await prisma.ownedProduct.create({ data: { userId: USER, setId: other.id, copies: 1 } });
    // Index de recherche, comme le fait la synchro du catalogue
    await prisma.$executeRawUnsafe(
      `UPDATE "CardSet" SET "searchText" = ygo_normalize(concat_ws(' ', name, code))`,
    );
  });

  describe('SQL du suivi par extension', () => {
    it('liste les extensions avec leur avancement', async () => {
      const page = await releases.list(USER, { page: 1, pageSize: 24 });
      expect(page.total).toBe(3);
      const betb = page.items.find((r) => r.set.code === 'BETB');
      expect(betb).toBeDefined();
      // 3 impressions, 2 cartes ; 1 impression possédée, et 2 cartes si on compte l'autre édition
      expect(betb!.progress).toMatchObject({
        prints: 3,
        cards: 2,
        ownedPrints: 1,
        ownedCards: 2,
        copies: 2,
      });
      expect(betb!.ownedValue).toBeCloseTo(40); // 2 × 20
      expect(betb!.missingValue).toBeCloseTo(51); // 50 + 1
      expect(betb!.status).toBe('RECENT');
      expect(betb!.set.kind).toBe('BOOSTER'); // cardCount 100 → booster
    });

    it('garde l_extension annoncée sans impression', async () => {
      const page = await releases.list(USER, { page: 1, pageSize: 24, status: 'UPCOMING' });
      expect(page.items.map((r) => r.set.code)).toEqual(['GLVI']);
      expect(page.items[0]!.progress.prints).toBe(0);
      expect(page.items[0]!.daysUntil).toBeGreaterThan(15);
    });

    it('filtre par avancement et par produit scellé', async () => {
      expect(
        (await releases.list(USER, { page: 1, pageSize: 24, progress: 'STARTED' })).total,
      ).toBe(1);
      expect((await releases.list(USER, { page: 1, pageSize: 24, ownedProduct: true })).total).toBe(
        1,
      );
      expect((await releases.list(USER, { page: 1, pageSize: 24, q: 'brave' })).total).toBe(1);
      expect((await releases.list(USER, { page: 1, pageSize: 24, year: 2015 })).total).toBe(1);
      expect((await releases.list(USER, { page: 1, pageSize: 24, kind: 'BOOSTER' })).total).toBe(1);
    });

    it('trie sans casser', async () => {
      for (const sort of ['date', 'progress', 'name', 'cards'] as const) {
        expect((await releases.list(USER, { page: 1, pageSize: 24, sort })).items).toHaveLength(3);
      }
    });

    it('met en avant les sorties', async () => {
      const spot = await releases.spotlight(USER);
      expect(spot.upcoming.map((r) => r.set.code)).toEqual(['GLVI']);
      expect(spot.recent.map((r) => r.set.code)).toEqual(['BETB']);
    });

    it('calcule les facettes', async () => {
      const facets = await releases.facets();
      expect(facets.kinds.find((f) => f.value === 'BOOSTER')?.count).toBe(1);
      expect(facets.statuses.find((f) => f.value === 'UPCOMING')?.count).toBe(1);
      expect(facets.years.map((f) => f.value)).toContain('2015');
    });

    it('détaille une extension carte par carte', async () => {
      const page = await releases.list(USER, { page: 1, pageSize: 24, q: 'brave' });
      const detail = await releases.detail(USER, page.items[0]!.set.id);
      expect(detail.cards).toHaveLength(3);
      const ultra = detail.cards.find((c) => c.rarity === 'Ultra Rare')!;
      expect(ultra.owned).toBe(2);
      const common = detail.cards.find((c) => c.rarity === 'Common')!;
      expect(common.owned).toBe(0);
      expect(common.ownedElsewhere).toBe(1); // possédée via l'autre extension
      expect(detail.rarities.map((r) => r.rarity)).toEqual(['Common', 'Ultra Rare', 'Secret Rare']);
    });
  });

  describe('SQL de la collection', () => {
    it('liste, filtre et trie', async () => {
      expect((await collection.list(USER, { page: 1, pageSize: 50 })).total).toBe(2);
      for (const sort of ['name', 'quantity', 'value', 'newest', 'rarity'] as const) {
        expect((await collection.list(USER, { page: 1, pageSize: 50, sort })).items).toHaveLength(
          2,
        );
      }
      expect(
        (await collection.list(USER, { page: 1, pageSize: 50, category: 'MONSTER' })).total,
      ).toBe(1);
      expect(
        (await collection.list(USER, { page: 1, pageSize: 50, archetype: 'blue-eyes' })).total,
      ).toBe(1);
      expect((await collection.list(USER, { page: 1, pageSize: 50, rarity: 'Common' })).total).toBe(
        1,
      );
      expect((await collection.list(USER, { page: 1, pageSize: 50, q: 'raigeki' })).total).toBe(1);
    });

    it('calcule les facettes, extension nommée comprise', async () => {
      const facets = await collection.facets(USER);
      expect(facets.categories.map((f) => f.value).sort()).toEqual(['MONSTER', 'SPELL']);
      expect(facets.rarities.map((f) => f.value).sort()).toEqual(['Common', 'Ultra Rare']);
      expect(facets.sets.map((f) => f.label).sort()).toEqual([
        'Beyond the Brave',
        'Old Reprint Tin',
      ]);
    });

    it('filtre par étiquettes, en les cumulant', async () => {
      const sell = await tags.create(USER, { name: 'à vendre', color: 'red' });
      const dupes = await tags.create(USER, { name: 'doublons', color: 'blue' });
      await tags.setCard(USER, sell.id, 1, true);
      await tags.setCard(USER, dupes.id, 1, true);
      await tags.setCard(USER, sell.id, 2, true);

      const one = await collection.list(USER, { page: 1, pageSize: 50, tagIds: [sell.id] });
      expect(one.total).toBe(2);
      const both = await collection.list(USER, {
        page: 1,
        pageSize: 50,
        tagIds: [sell.id, dupes.id],
      });
      expect(both.total).toBe(1);
      expect(both.items[0]!.card.tagIds).toHaveLength(2);

      // Étiquette sur une extension → filtre de l'onglet Extensions
      const sets = await releases.list(USER, { page: 1, pageSize: 24 });
      const betb = sets.items.find((r) => r.set.code === 'BETB')!;
      await tags.setSet(USER, sell.id, betb.set.id, true);
      const tagged = await releases.list(USER, { page: 1, pageSize: 24, tagIds: [sell.id] });
      expect(tagged.items.map((r) => r.set.code)).toEqual(['BETB']);
      expect(tagged.items[0]!.tagIds).toEqual([sell.id]);
    });
  });
});
