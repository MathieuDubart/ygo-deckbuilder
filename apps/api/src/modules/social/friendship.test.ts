import { describe, expect, it } from 'vitest';
import { canSeeProfile, otherSide, relationTo, type FriendshipRow } from './friendship';

const row = (over: Partial<FriendshipRow> = {}): FriendshipRow => ({
  id: 'f1',
  requesterId: 'alice',
  addresseeId: 'bob',
  status: 'PENDING',
  ...over,
});

describe('relationTo', () => {
  it('reconnaît son propre profil', () => {
    expect(relationTo('alice', 'alice', null)).toEqual({ state: 'SELF', requestId: null });
    // Même avec une ligne en base (qui ne devrait pas exister), on reste sur SELF
    expect(relationTo('alice', 'alice', row({ addresseeId: 'alice' })).state).toBe('SELF');
  });

  it('sans ligne, aucun lien', () => {
    expect(relationTo('alice', 'bob', null)).toEqual({ state: 'NONE', requestId: null });
    expect(relationTo('alice', 'bob', undefined).state).toBe('NONE');
  });

  it('une demande en attente se lit dans les deux sens', () => {
    expect(relationTo('alice', 'bob', row())).toEqual({ state: 'REQUEST_SENT', requestId: 'f1' });
    expect(relationTo('bob', 'alice', row())).toEqual({
      state: 'REQUEST_RECEIVED',
      requestId: 'f1',
    });
  });

  it('une relation acceptée est symétrique et sans demande', () => {
    const accepted = row({ status: 'ACCEPTED' });
    expect(relationTo('alice', 'bob', accepted)).toEqual({ state: 'FRIENDS', requestId: null });
    expect(relationTo('bob', 'alice', accepted)).toEqual({ state: 'FRIENDS', requestId: null });
  });
});

describe('otherSide', () => {
  it("renvoie l'autre personne, quel que soit le sens", () => {
    expect(otherSide('alice', row())).toBe('bob');
    expect(otherSide('bob', row())).toBe('alice');
  });
});

describe('canSeeProfile', () => {
  it('ouvre le profil à soi-même et aux amis, à personne d’autre', () => {
    expect(canSeeProfile({ state: 'SELF', requestId: null })).toBe(true);
    expect(canSeeProfile({ state: 'FRIENDS', requestId: null })).toBe(true);
    expect(canSeeProfile({ state: 'NONE', requestId: null })).toBe(false);
    expect(canSeeProfile({ state: 'REQUEST_SENT', requestId: 'f1' })).toBe(false);
    // Le cas qui compte : recevoir une demande n'ouvre rien tant qu'on n'a pas accepté
    expect(canSeeProfile({ state: 'REQUEST_RECEIVED', requestId: 'f1' })).toBe(false);
  });
});
