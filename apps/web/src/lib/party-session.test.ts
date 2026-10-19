import { emptyParty, slotRules, traitAt, type SlotPosition, type Trait } from '@atlas/core';
import { describe, expect, it, vi } from 'vitest';
import { createLastPartyStore, LAST_PARTY_KEY, type StorageLike } from './last-party-store';
import type { Focusable } from './party-actions';
import { createPartySession, type AddressStep, type PartyDataset, type PartySession } from './party-session';

function trait(id: string, overrides: Partial<Trait> = {}): Trait {
  return {
    id,
    name: id,
    creature: 'Abomination Brute',
    family: 'Abomination',
    class: 'Death',
    kind: 'creature',
    description: 'Heals an ally.',
    material: 'Ferrous Ore',
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    keywords: [],
    conditionalSources: [],
    ...overrides,
  };
}

const flesh = trait('abomination--flesh-rot', { name: 'Flesh Rot' });
const mirror = trait('mirror-image', { name: 'Mirror Image' });
const mastery = trait('master-of-mirelings', { name: 'Master of Mirelings', kind: 'mastery', creature: null });
const known = [flesh, mirror, mastery];
const dataset: PartyDataset = { trait: (id) => known.find((candidate) => candidate.id === id), datasetVersion: '2.0' };

const innate: SlotPosition = { member: 0, slot: 'innate' };
const fused: SlotPosition = { member: 0, slot: 'fused' };
const artifact: SlotPosition = { member: 0, slot: 'artifact' };

/** A browser's storage that lives in a map: the session's remembering can be read back from it. */
function memoryStorage(): StorageLike & { readonly saved: Map<string, string> } {
  const saved = new Map<string, string>();
  return {
    saved,
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => {
      saved.set(key, value);
    },
    removeItem: (key) => {
      saved.delete(key);
    },
  };
}

function setup(options: { readonly dataset?: boolean; readonly rendered?: () => Promise<void> } = {}) {
  const storage = memoryStorage();
  const session = createPartySession({
    store: createLastPartyStore(() => storage),
    rendered: options.rendered ?? (() => Promise.resolve()),
  });
  if (options.dataset ?? true) session.useDataset(dataset);
  const steps: AddressStep[] = [];
  session.syncAddress((step) => steps.push(step));
  const changes = vi.fn();
  session.subscribe(changes);
  return { session, storage, steps, changes };
}

const placed = (session: PartySession, at: SlotPosition) => traitAt(session.planner.history.party, at);
const params = (query: string) => new URLSearchParams(query);

describe('createPartySession', () => {
  it('starts with an empty party, nothing announced and no choice of slot open', () => {
    const { session } = setup();

    expect(session.partyState.party).toEqual(emptyParty);
    expect(placed(session, innate)).toBeNull();
    expect(session.message).toBe('');
    expect(session.choosing).toBeUndefined();
    expect(session.choices).toEqual([]);
  });

  describe('the version of the dataset a party is written under', () => {
    it('is none before the data and the address say one', () => {
      expect(setup({ dataset: false }).session.datasetVersion).toBeNull();
    });

    it('is the one the address stated while the data loads: a link opened early is written back as it was', () => {
      const { session } = setup({ dataset: false });

      session.arrive(params('party=1.9,abomination--flesh-rot'), true);

      expect(session.datasetVersion).toBe('1.9');
    });

    it('is the dataset in use once it is there, whatever the address said', () => {
      const { session } = setup({ dataset: false });
      session.arrive(params('party=1.9,abomination--flesh-rot'), true);

      session.useDataset(dataset);

      expect(session.datasetVersion).toBe('2.0');
    });
  });

  describe('adding a trait', () => {
    it('puts it in the target slot, moves the target on and says so', () => {
      const { session } = setup();

      session.actions.add(flesh);

      expect(placed(session, innate)).toBe(flesh.id);
      expect(session.planner.target).not.toEqual(innate);
      expect(session.message).toBe('Added Flesh Rot to Creature 1 · Innate.');
    });

    it('is a step of its own in the address, remembered for the next visit', () => {
      const { session, steps, storage } = setup();

      session.actions.add(flesh);

      expect(steps).toEqual(['chosen']);
      expect(storage.saved.get(LAST_PARTY_KEY)).toContain('abomination--flesh-rot');
    });

    it('names the trait it replaces, when the slot held one', () => {
      const { session } = setup();
      session.actions.add(flesh);
      session.chooseSlot(innate);

      session.actions.add(mirror);

      expect(session.message).toBe('Added Mirror Image to Creature 1 · Innate, replacing Flesh Rot.');
    });

    it('names a replaced trait the dataset does not know by its id', () => {
      const { session } = setup();
      session.arrive(params('party=1.9,vanished--trait&target=1-innate'), true);

      session.actions.add(flesh);

      expect(session.message).toBe('Added Flesh Rot to Creature 1 · Innate, replacing vanished--trait.');
    });

    it('is refused with the rule’s reason, and changes nothing: no address step, nothing remembered', () => {
      const { session, steps, storage } = setup();
      const refusal = slotRules.canPlace(mastery, 'innate');

      session.actions.add(mastery);

      expect(refusal.ok).toBe(false);
      expect(session.message).toBe(refusal.ok ? '' : refusal.reason);
      expect(placed(session, innate)).toBeNull();
      expect(steps).toEqual([]);
      expect(storage.saved.size).toBe(0);
    });

    it('says why the target refuses a trait, ready to be shown on the result, and follows the target', () => {
      const { session } = setup();

      expect(session.actions.refusal(flesh)).toBeNull();
      // A mastery goes in the Artifact slot only (GAME_RULES R6).
      expect(session.actions.refusal(mastery)).toEqual(expect.any(String));
      session.chooseSlot(artifact);
      expect(session.actions.refusal(mastery)).toBeNull();
    });

    it('does nothing, and says nothing, for a trait that is in the target slot already', () => {
      const { session, steps, changes } = setup();
      session.actions.add(flesh);
      session.chooseSlot(innate);
      const message = session.message;
      steps.length = 0;
      changes.mockClear();

      session.actions.add(flesh);

      expect(session.message).toBe(message);
      expect(steps).toEqual([]);
      expect(changes).not.toHaveBeenCalled();
    });

    it('lists the slots that hold a trait, in reading order', () => {
      const { session } = setup();
      const second: SlotPosition = { member: 1, slot: 'innate' };
      session.chooseSlot(second);
      session.actions.add(flesh);
      session.chooseSlot(innate);
      session.actions.add(flesh);

      expect(session.actions.placesOf(flesh)).toEqual([innate, second]);
      expect(session.actions.placesOf(mirror)).toEqual([]);
    });
  });

  describe('choosing the slot of a trait the target refuses', () => {
    it('opens with the trait and the slots that take it, each with what it holds', () => {
      const { session } = setup();
      session.actions.add(flesh);
      const opener: Focusable = { isConnected: true, focus: vi.fn() };

      session.actions.chooseSlot(mirror, opener);

      expect(session.choosing).toBe(mirror);
      expect(session.choices).toEqual([
        { position: innate, holds: { kind: 'other', name: 'Flesh Rot' } },
        { position: fused, holds: { kind: 'empty' } },
        { position: artifact, holds: { kind: 'empty' } },
      ]);
    });

    it('says a trait that goes in the slot chosen was added there, once the sheet is shut and the page has caught up', async () => {
      let settle: () => void = () => undefined;
      const rendered = () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        });
      const { session, steps } = setup({ rendered });
      session.actions.add(flesh);
      steps.length = 0;
      session.actions.chooseSlot(mirror, { isConnected: true, focus: vi.fn() });
      const target = session.planner.target;

      const adding = session.addToChosenSlot(artifact);

      // The sheet is shut at once; the party is only changed, and told, when the page behind it can be heard again.
      expect(session.choosing).toBeUndefined();
      expect(placed(session, artifact)).toBeNull();
      settle();
      await adding;
      expect(placed(session, artifact)).toBe(mirror.id);
      expect(session.message).toBe('Added Mirror Image to Creature 1 · Artifact.');
      expect(session.planner.target).toEqual(target);
      expect(steps).toEqual(['chosen']);
    });

    it('does nothing when no trait is being chosen for', async () => {
      const { session, steps } = setup();

      await session.addToChosenSlot(artifact);

      expect(placed(session, artifact)).toBeNull();
      expect(steps).toEqual([]);
    });

    it('gives the focus back to the button that opened it when the sheet is shut', () => {
      const { session } = setup();
      const focus = vi.fn();
      session.actions.chooseSlot(mirror, { isConnected: true, focus });

      session.closeChooser();

      expect(session.choosing).toBeUndefined();
      expect(focus).toHaveBeenCalledOnce();
    });

    it('does not, when its row is gone from the page', () => {
      const { session } = setup();
      const focus = vi.fn();
      session.actions.chooseSlot(mirror, { isConnected: false, focus });

      session.closeChooser();

      expect(focus).not.toHaveBeenCalled();
    });

    it('is dropped without a focus when the page that opened it goes away', () => {
      const { session } = setup();
      const focus = vi.fn();
      session.actions.chooseSlot(mirror, { isConnected: true, focus });

      session.forgetChooser();
      session.closeChooser();

      expect(session.choosing).toBeUndefined();
      expect(focus).not.toHaveBeenCalled();
    });

    it('tells the page nothing when no sheet was open to be shut or dropped', () => {
      const { session, changes } = setup();
      changes.mockClear();

      session.closeChooser();
      session.forgetChooser();

      expect(changes).not.toHaveBeenCalled();
    });

    it('offers a slot only for a trait one of them takes', () => {
      const { session } = setup();

      expect(session.actions.canChooseSlot(flesh)).toBe(true);
      expect(session.actions.canChooseSlot({ ...mastery, material: null })).toBe(false);
    });
  });

  describe('clearing', () => {
    it('empties a slot and says which', () => {
      const { session, steps } = setup();
      session.actions.add(flesh);
      steps.length = 0;

      session.clearSlot(innate);

      expect(placed(session, innate)).toBeNull();
      expect(session.message).toBe('Cleared Creature 1 · Innate.');
      expect(steps).toEqual(['chosen']);
    });

    it('empties the party, and forgets it for the next visit', () => {
      const { session, storage } = setup();
      session.actions.add(flesh);

      session.clearAll();

      expect(placed(session, innate)).toBeNull();
      expect(session.message).toBe('Cleared the party.');
      expect(storage.saved.size).toBe(0);
    });

    it('does nothing for a slot, or a party, that is empty already', () => {
      const { session, steps, changes } = setup();

      session.clearSlot(fused);
      session.clearAll();

      expect(session.message).toBe('');
      expect(steps).toEqual([]);
      expect(changes).not.toHaveBeenCalled();
    });
  });

  describe('undo and redo', () => {
    it('take back the last edit and bring it again, saying what it was', () => {
      const { session } = setup();
      session.actions.add(flesh);

      session.undo();
      expect(placed(session, innate)).toBeNull();
      expect(session.message).toBe('Undid: added Flesh Rot to Creature 1 · Innate.');

      session.redo();
      expect(placed(session, innate)).toBe(flesh.id);
      expect(session.message).toBe('Redid: added Flesh Rot to Creature 1 · Innate.');
    });

    it('are steps of their own in the address', () => {
      const { session, steps } = setup();
      session.actions.add(flesh);
      steps.length = 0;

      session.undo();
      session.redo();

      expect(steps).toEqual(['chosen', 'chosen']);
    });

    it('do nothing when there is nothing to undo or to redo', () => {
      const { session, steps, changes } = setup();

      session.undo();
      session.redo();

      expect(session.message).toBe('');
      expect(steps).toEqual([]);
      expect(changes).not.toHaveBeenCalled();
    });
  });

  describe('choosing the slot results go to', () => {
    it('replaces the history entry, no step of its own, and is remembered', () => {
      const { session, steps, storage } = setup();
      session.actions.add(flesh);
      steps.length = 0;

      session.chooseSlot(artifact);

      expect(session.planner.target).toEqual(artifact);
      expect(steps).toEqual(['refined']);
      expect(storage.saved.get(LAST_PARTY_KEY)).toContain('target=1-artifact');
    });

    it('is not an edit: it leaves what can be undone as it was', () => {
      const { session } = setup();
      session.actions.add(flesh);
      const done = session.planner.history.done;

      session.chooseSlot(artifact);

      expect(session.planner.history.done).toBe(done);
    });

    it('does nothing for the slot that is the target already', () => {
      const { session, steps, changes } = setup();
      changes.mockClear();

      session.chooseSlot(session.planner.target);

      expect(steps).toEqual([]);
      expect(changes).not.toHaveBeenCalled();
    });
  });

  describe('when the browser arrives at an address', () => {
    it('takes the party and the target the address states, with nothing to undo', () => {
      const { session } = setup();

      session.arrive(params('party=2.0,abomination--flesh-rot&target=1-fused'), false);

      expect(placed(session, innate)).toBe(flesh.id);
      expect(session.planner.target).toEqual(fused);
      expect(session.planner.history.done).toEqual([]);
    });

    it('keeps the planner, and what can be undone, when the address stands for the party it has', () => {
      const { session } = setup();
      session.actions.add(flesh);
      const planner = session.planner;
      const address = params(`party=2.0,abomination--flesh-rot&target=${targetParam(planner.target)}`);

      session.arrive(address, false);

      expect(session.planner).toBe(planner);
    });

    it('starts the history over for another party', () => {
      const { session } = setup();
      session.actions.add(flesh);

      session.arrive(params('party=2.0,mirror-image'), false);

      expect(placed(session, innate)).toBe(mirror.id);
      expect(session.planner.history.done).toEqual([]);
    });

    it('empties the party for an address that has none, when it is back or forward', () => {
      const { session, storage } = setup();
      session.actions.add(flesh);

      const restored = session.arrive(params(''), false);

      expect(restored).toBe(false);
      expect(placed(session, innate)).toBeNull();
      // Back to an entry with no party is not the end of the party the last visit left: that is for a new visit.
      expect(storage.saved.size).toBe(1);
    });

    describe('a new visit', () => {
      it('starts from the party of the last visit when the address names none, and says the address must follow', () => {
        const first = setup();
        first.session.actions.add(flesh);
        const { session, storage } = setup({ dataset: false });
        storage.saved.set(LAST_PARTY_KEY, first.storage.saved.get(LAST_PARTY_KEY) ?? '');

        const restored = session.arrive(params('q=weak'), true);

        expect(restored).toBe(true);
        expect(placed(session, innate)).toBe(flesh.id);
        // The version the party was kept under is the one it is written back under while the data loads.
        expect(session.datasetVersion).toBe('2.0');
      });

      it('keeps the party of the address when it names one', () => {
        const { session, storage } = setup();
        storage.saved.set(LAST_PARTY_KEY, 'party=2.0%2Cabomination--flesh-rot');

        const restored = session.arrive(params('party=2.0,mirror-image'), true);

        expect(restored).toBe(false);
        expect(placed(session, innate)).toBe(mirror.id);
      });

      it('has nothing to restore when the last visit left no party', () => {
        const { session } = setup();

        expect(session.arrive(params(''), true)).toBe(false);
        expect(placed(session, innate)).toBeNull();
      });
    });

    it('tells the page only when something changed', () => {
      const { session, changes } = setup();
      session.arrive(params('party=2.0,abomination--flesh-rot'), false);
      changes.mockClear();

      session.arrive(params('party=2.0,abomination--flesh-rot'), false);

      expect(changes).not.toHaveBeenCalled();
    });
  });

  describe('telling the page', () => {
    it('calls the watchers once for each change, and no more once one has left', () => {
      const { session } = setup();
      const watcher = vi.fn();
      const leave = session.subscribe(watcher);

      session.actions.add(flesh);
      expect(watcher).toHaveBeenCalledTimes(1);

      leave();
      session.undo();
      expect(watcher).toHaveBeenCalledTimes(1);
    });

    it('calls them when the dataset arrives, a refusal is announced and the sheet opens', () => {
      const { session, changes } = setup({ dataset: false });

      session.useDataset(dataset);
      session.actions.add(mastery);
      session.actions.chooseSlot(mirror, { isConnected: true, focus: vi.fn() });

      expect(changes).toHaveBeenCalledTimes(3);
    });
  });

  describe('keeping the address in step', () => {
    it('tells the page that registered last: the one that left after the next had come does not take it away', () => {
      const { session } = setup();
      const old: AddressStep[] = [];
      const current: AddressStep[] = [];
      const leaveOld = session.syncAddress((step) => old.push(step));
      const leaveCurrent = session.syncAddress((step) => current.push(step));

      leaveOld();
      session.actions.add(flesh);
      leaveCurrent();
      session.undo();

      expect(old).toEqual([]);
      expect(current).toEqual(['chosen']);
    });
  });
});

/** The `target` parameter of a slot, as an address writes it. */
const targetParam = ({ member, slot }: SlotPosition): string => `${String(member + 1)}-${slot}`;
