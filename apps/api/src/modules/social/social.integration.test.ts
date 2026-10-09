/**
 * Vérification du SQL social contre un vrai PostgreSQL : état d'une relation dans les deux
 * sens, repères de collection, avancement des amis par extension, possession impression par
 * impression, et cartes mises en avant. Rien n'est simulé — le reste du module est du SQL,
 * et du SQL qui compile n'est pas du SQL qui répond juste.
 *
 * Le point le plus important ici est la **frontière de visibilité** : un compte qui n'est pas
 * ami ne doit apparaître dans aucune des réponses, même en connaissant son identifiant.
 *
 * Désactivé sans base. Pour le lancer, un Postgres vide suffit :
 *   INTEGRATION_DATABASE_URL=postgresql://ygo@127.0.0.1:5432/ygo_test \
 *     pnpm --filter @ygo/api test
 *
 * ATTENTION : ce test vide les tables de la base pointée. Jamais sur une base utile.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../../generated/prisma/client';
import { SetProgressService } from '../collection/set-progress.service';
import { FriendProgressService } from './friend-progress.service';
import { FriendsService } from './friends.service';
import { ProfileService } from './profile.service';

const URL = process.env.INTEGRATION_DATABASE_URL;

describe.runIf(URL)('profils et amitiés (PostgreSQL réel)', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL! }) });
  const asService = prisma as unknown as ConstructorParameters<typeof FriendsService>[0];
  const friends = new FriendsService(asService);
  const progress = new SetProgressService(asService);
  const friendProgress = new FriendProgressService(asService, friends);
  // Le stockage n'intervient pas dans ce qu'on vérifie ici (aucune image n'est écrite).
  const storage = {} as unknown as ConstructorParameters<typeof ProfileService>[2];
  const profile = new ProfileService(asService, friends, storage);

  const ME = 'u-me';
  const PAL = 'u-pal';
  const STRANGER = 'u-stranger';
  let setA = '';
  let setB = '';
  let printA1 = '';
  let printA2 = '';
  let printB1 = '';

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE "User", "CardSet", "Card" CASCADE`);
    for (const [id, username] of [
      [ME, 'mathieu'],
      [PAL, 'thomas'],
      [STRANGER, 'inconnu'],
    ] as const) {
      await prisma.user.create({
        data: { id, email: `${id}@b.c`, username, passwordHash: 'x' },
      });
    }

    const a = await prisma.cardSet.create({
      data: { name: 'Beyond the Brave', code: 'BETB', tcgDate: new Date('2026-10-01') },
    });
    const b = await prisma.cardSet.create({
      data: { name: 'Old Reprint Tin', code: 'OTIN', tcgDate: new Date('2015-01-01') },
    });
    setA = a.id;
    setB = b.id;

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
          priceCardmarket: 10,
          searchText: name.toLowerCase(),
        },
      });
    }

    // Extension A : deux impressions de la carte 1 (deux raretés) et une de la carte 2
    const a1 = await prisma.cardPrint.create({
      data: { cardId: 1, setId: setA, printCode: 'BETB-EN001', rarity: 'Ultra Rare', price: 20 },
    });
    const a2 = await prisma.cardPrint.create({
      data: { cardId: 1, setId: setA, printCode: 'BETB-EN001', rarity: 'Secret Rare', price: 50 },
    });
    const a3 = await prisma.cardPrint.create({
      data: { cardId: 2, setId: setA, printCode: 'BETB-EN002', rarity: 'Common', price: 1 },
    });
    printA1 = a1.id;
    printA2 = a2.id;
    // Extension B : une réimpression de la carte 1 — c'est elle qui fait la différence
    // entre « possédée ici » et « possédée ailleurs ».
    const b1 = await prisma.cardPrint.create({
      data: { cardId: 1, setId: setB, printCode: 'OTIN-EN001', rarity: 'Common', price: 2 },
    });
    printB1 = b1.id;
    void a3;

    // Moi : l'Ultra Rare de A. L'ami : la réimpression de B (donc la carte 1, ailleurs)
    // et le Common de A. L'inconnu : tout, pour vérifier qu'il n'apparaît jamais.
    await prisma.collectionItem.create({ data: { userId: ME, cardId: 1, printId: printA1 } });
    await prisma.collectionItem.create({
      data: { userId: PAL, cardId: 1, printId: printB1, quantity: 3 },
    });
    await prisma.collectionItem.create({ data: { userId: PAL, cardId: 2, printId: a3.id } });
    for (const print of [a1, a2, a3, b1]) {
      await prisma.collectionItem.create({
        data: { userId: STRANGER, cardId: print.cardId, printId: print.id },
      });
    }
    await progress.rebuildAll();

    await prisma.friendship.create({
      data: {
        requesterId: ME,
        addresseeId: PAL,
        status: 'ACCEPTED',
        respondedAt: new Date('2026-01-01'),
      },
    });
  });

  describe('état d’une relation', () => {
    it('se lit identiquement dans les deux sens', async () => {
      expect(await friends.relation(ME, PAL)).toEqual({ state: 'FRIENDS', requestId: null });
      expect(await friends.relation(PAL, ME)).toEqual({ state: 'FRIENDS', requestId: null });
    });

    it('reste vide avec un compte sans lien', async () => {
      expect(await friends.relation(ME, STRANGER)).toEqual({ state: 'NONE', requestId: null });
    });

    it('ne liste que les amis acceptés', async () => {
      expect(await friends.friendIds(ME)).toEqual([PAL]);
      expect(await friends.friendIds(STRANGER)).toEqual([]);
    });
  });

  describe('recherche de comptes', () => {
    it('trouve sur un fragment, sans la casse, et ne renvoie jamais soi-même', async () => {
      const found = await friends.search(ME, 'THOM');
      expect(found.map((u) => u.username)).toEqual(['thomas']);
      expect(found[0]?.state).toBe('FRIENDS');
      expect((await friends.search(ME, 'mathieu')).map((u) => u.username)).toEqual([]);
    });

    it('rend l’état de chaque résultat, demande en attente comprise', async () => {
      const request = await prisma.friendship.create({
        data: { requesterId: STRANGER, addresseeId: ME },
      });
      const [result] = await friends.search(ME, 'inconnu');
      expect(result).toMatchObject({ state: 'REQUEST_RECEIVED', requestId: request.id });
      // Vu de l'autre côté, la même ligne est une demande envoyée
      const [mirror] = await friends.search(STRANGER, 'mathieu');
      expect(mirror).toMatchObject({ state: 'REQUEST_SENT', requestId: request.id });
      await prisma.friendship.delete({ where: { id: request.id } });
    });
  });

  describe('repères de collection', () => {
    it('compte les cartes distinctes, les exemplaires et les extensions complètes', async () => {
      const stats = await friends.stats([ME, PAL]);
      expect(stats.get(ME)).toEqual({
        distinctCards: 1,
        copies: 1,
        // La carte 1 est dans A et dans B : posséder une impression de A compte pour les deux
        sets: 2,
        completedSets: 0,
      });
      expect(stats.get(PAL)).toEqual({
        distinctCards: 2,
        copies: 4,
        sets: 2,
        // B n'a qu'une impression, et l'ami la possède
        completedSets: 1,
      });
    });

    it('renvoie des zéros plutôt que rien pour un compte vide', async () => {
      const stats = await friends.stats(['u-me', 'u-pal', 'u-ghost']);
      expect(stats.has('u-ghost')).toBe(false);
      expect(stats.size).toBe(2);
    });
  });

  describe('avancement des amis par extension', () => {
    it('ne renvoie que les amis, jamais un compte inconnu', async () => {
      const byset = await friendProgress.forSets(ME, [setA, setB]);
      expect(byset[setA]?.map((row) => row.user.id)).toEqual([PAL]);
      expect(byset[setB]?.map((row) => row.user.id)).toEqual([PAL]);
      // L'inconnu possède tout, et n'apparaît nulle part
      const flat = Object.values(byset).flat();
      expect(flat.some((row) => row.user.id === STRANGER)).toBe(false);
    });

    it('rend les deux lectures de l’avancement', async () => {
      const byset = await friendProgress.forSets(ME, [setA]);
      // A compte 2 cases (EN001 et EN002) pour 3 lignes d'impression : la carte 1 y est
      // éditée deux fois sous le même code. L'ami en a 1 sur 2, mais 2 cartes sur 2 — la
      // deuxième lui vient de B.
      expect(byset[setA]?.[0]).toMatchObject({
        prints: 2,
        cards: 2,
        ownedPrints: 1,
        ownedCards: 2,
      });
    });

    it('ne renvoie rien à qui n’a pas d’ami', async () => {
      expect(await friendProgress.forSets(STRANGER, [setA, setB])).toEqual({});
      expect(await friendProgress.forSet(STRANGER, setA)).toEqual({
        friends: [],
        owners: {},
        ownersAnyEdition: {},
      });
    });

    it('sépare « possédée ici » de « possédée dans une autre édition »', async () => {
      const detail = await friendProgress.forSet(ME, setA);
      expect(detail.friends.map((row) => row.user.username)).toEqual(['thomas']);
      // L'ami possède le Common de A : impression exacte
      expect(Object.keys(detail.owners)).toHaveLength(1);
      expect(Object.values(detail.owners).flat()).toEqual([PAL]);
      // Et la carte 1 via B : les deux impressions de A la comptent comme « ailleurs »
      expect(Object.keys(detail.ownersAnyEdition).sort()).toEqual([printA1, printA2].sort());
      expect(detail.ownersAnyEdition[printA1]).toEqual([PAL]);
      // Les deux ensembles sont disjoints : aucune impression dans les deux listes
      const exact = new Set(Object.keys(detail.owners));
      expect(Object.keys(detail.ownersAnyEdition).some((id) => exact.has(id))).toBe(false);
    });
  });

  describe('cartes mises en avant', () => {
    it('refuse une impression qu’on ne possède pas', async () => {
      await expect(profile.setCards(ME, [printA2])).rejects.toThrow();
      expect(await prisma.profileCard.count({ where: { userId: ME } })).toBe(0);
    });

    it('garde l’ordre envoyé et déduplique', async () => {
      const cards = await profile.setCards(ME, [printA1, printA1]);
      expect(cards.map((card) => card.printId)).toEqual([printA1]);
      expect(cards[0]).toMatchObject({ printCode: 'BETB-EN001', setName: 'Beyond the Brave' });
      expect(cards[0]?.card.name).toBe('Blue-Eyes White Dragon');
    });

    it('cache une carte qui a quitté la collection, sans l’oublier', async () => {
      await prisma.collectionItem.deleteMany({ where: { userId: ME, printId: printA1 } });
      expect(await profile.cards(ME)).toEqual([]);
      // La ligne est toujours là : rendre la carte la remet en avant
      expect(await prisma.profileCard.count({ where: { userId: ME } })).toBe(1);
      await prisma.collectionItem.create({ data: { userId: ME, cardId: 1, printId: printA1 } });
      expect(await profile.cards(ME)).toHaveLength(1);
    });
  });

  describe('visibilité d’un profil', () => {
    it('ouvre le profil d’un ami, avec ses repères et ses cartes', async () => {
      const view = await profile.view(ME, 'thomas');
      expect(view.visible).toBe(true);
      if (!view.visible) return;
      expect(view.user.username).toBe('thomas');
      expect(view.state).toBe('FRIENDS');
      expect(view.friendsSince).toBe(new Date('2026-01-01').toISOString());
      expect(view.friendCount).toBe(1);
      expect(view.stats.distinctCards).toBe(2);
    });

    it('ferme celui d’un inconnu, en laissant de quoi l’ajouter', async () => {
      const view = await profile.view(ME, 'inconnu');
      expect(view.visible).toBe(false);
      if (view.visible) return;
      expect(view.user.username).toBe('inconnu');
      expect(view.state).toBe('NONE');
      // Aucun repère de collection ne doit filtrer
      expect(Object.keys(view)).toEqual(['visible', 'user', 'state', 'requestId']);
    });

    it('ne se dit pas ami avec soi-même', async () => {
      const view = await profile.view(ME, 'mathieu');
      expect(view.visible).toBe(true);
      if (!view.visible) return;
      expect(view.state).toBe('SELF');
      expect(view.friendsSince).toBeNull();
    });
  });
});
