import {
  addTrait,
  addTraitAt,
  allowedSlots,
  chooseTarget,
  clearParty,
  clearSlot,
  createPlanner,
  decodePartyState,
  redoEdit,
  samePartyState,
  slotRules,
  SLOT_POSITIONS,
  traitAt,
  undoEdit,
  type AddResult,
  type PartyState,
  type Planner,
  type SlotPosition,
  type Trait,
  type TraitId,
  type TraitLookup,
} from '@atlas/core';
import { createSubscriber } from 'svelte/reactivity';
import { copy } from './copy';
import type { LastPartyStore } from './last-party-store';
import type { Focusable, PartyActions } from './party-actions';
import { slotChoices, type SlotChoice } from './slot-choices';

/** What the party is read against: the traits its slots hold, and the version of the data they come from. */
export interface PartyDataset {
  trait(id: TraitId): Trait | undefined;
  readonly datasetVersion: string;
}

/**
 * What a change of the party asks of the address, named as the methods of an `AddressWriter` are: an edit is a step of its
 * own in the history, and choosing the target replaces the entry.
 */
export type AddressStep = 'chosen' | 'refined';

export interface PartySessionDependencies {
  /** Where the party of the last visit is kept (ADR-0005). */
  readonly store: LastPartyStore;
  /** Settles once the page shows the state as it is so far (Svelte's `tick`). */
  readonly rendered: () => Promise<void>;
}

/**
 * The party being planned, shared by every page of the app: its planner (the undo history with it), what a screen reader is
 * told of the last change, the choice of slot in progress, and the keeping of the party in the address and in the browser.
 * It lives for as long as the app does, so that going to another page does not lose the party or what can be undone.
 *
 * Every field read through it is reactive: an effect that reads one runs again when it changes.
 */
export interface PartySession {
  readonly planner: Planner;
  /** The party and its target, as an address states them. */
  readonly partyState: PartyState;
  /** What the party panel's polite line tells a screen reader about the last change. */
  readonly message: string;
  /** The trait whose slot is being chosen, while the sheet is open. */
  readonly choosing: Trait | undefined;
  /** The slots that the sheet offers: those of the target's creature that take `choosing`, and what each holds now. */
  readonly choices: readonly SlotChoice[];
  /** The version a party is written under: the one of the dataset in use, or until it is there the one the address stated. */
  readonly datasetVersion: string | null;
  readonly lookup: TraitLookup;
  /** What a result can do with the party: add to it, say where a trait is, open the choice of slot. */
  readonly actions: PartyActions;

  /** The data a page loaded; the party is read against it from now on. */
  useDataset(dataset: PartyDataset): void;
  /**
   * The browser is at the address with `params`: the party and target it states become the planner's, keeping what can be
   * undone when they are those it has. A new visit (`entered`) to an address that names no party starts from the one the last
   * visit left: the result tells that the address must say so (it is `true` then).
   */
  arrive(params: URLSearchParams, entered: boolean): boolean;
  clearSlot(at: SlotPosition): void;
  clearAll(): void;
  undo(): void;
  redo(): void;
  /** Chooses the slot results go to: part of the address, but no step of its own. */
  chooseSlot(at: SlotPosition): void;
  /**
   * The trait being chosen for goes in the slot `position`, and the target stays where it was. The sheet is shut first and
   * the player told after: while it is open the page behind it, the live region with it, is inert and would not be heard.
   */
  addToChosenSlot(position: SlotPosition): Promise<void>;
  /** The sheet is shut, however it was: the focus goes back to the button that opened it, if its row is still on the page. */
  closeChooser(): void;
  /** The page that opened the sheet goes away: nothing is open any more, and there is no focus to give back. */
  forgetChooser(): void;
  /** `listener` is called after every change; the result stops it. */
  subscribe(listener: () => void): () => void;
  /**
   * Tells the page's address writer what the party's changes ask of it. One page is in front at a time: the last to register is
   * told, and one that leaves after another has come does not take the other's place away.
   */
  syncAddress(sink: (step: AddressStep) => void): () => void;
}

export function createPartySession({ store, rendered }: PartySessionDependencies): PartySession {
  let planner = createPlanner();
  let message = '';
  /** The version the address stated for its party: written back as it was while the data loads. */
  let linkedVersion: string | null = null;
  let dataset: PartyDataset | undefined;
  let choosing: Trait | undefined;
  let chooserOpener: Focusable | undefined;
  let addressSink: ((step: AddressStep) => void) | undefined;

  const watchers = new Set<() => void>();
  // A field read in an effect starts watching, and the effect runs again when `changed` calls its `update`.
  const observe = createSubscriber((update) => {
    watchers.add(update);
    return () => {
      watchers.delete(update);
    };
  });

  function changed(): void {
    for (const watcher of watchers) watcher();
  }

  const partyState = (): PartyState => ({ party: planner.history.party, target: planner.target });
  const versionInUse = (): string | null => dataset?.datasetVersion ?? linkedVersion;

  const lookup: TraitLookup = (id) => {
    observe();
    return dataset?.trait(id);
  };

  /** What the player is told a slot held before a trait took its place: its name, or its id when the dataset has no such trait. */
  const nameOfReplaced = (id: TraitId | null): string | undefined =>
    id === null ? undefined : (dataset?.trait(id)?.name ?? id);

  /** Keeps the party for the next visit. */
  function remember(): void {
    store.save(partyState(), versionInUse() ?? '');
  }

  function say(announcement: string): void {
    message = announcement;
    changed();
  }

  /** An edit of the party, told to the address as a step of its own and to a screen reader in words. */
  function edited(next: Planner, announcement: string): void {
    planner = next;
    message = announcement;
    changed();
    addressSink?.('chosen');
    remember();
  }

  /** A refusal is announced and changes nothing; a trait already in the slot changes nothing either, and says nothing. */
  function placed(result: AddResult, trait: Trait, at: SlotPosition): void {
    if (!result.ok) {
      say(result.reason);
      return;
    }
    if (result.planner !== planner) {
      edited(result.planner, copy.partyAnnouncements.added(trait.name, at, nameOfReplaced(result.replaced)));
    }
  }

  /** Nothing is being chosen for any more. Gives the button that opened the sheet, and tells the page only if something was open. */
  function dropChooser(): Focusable | undefined {
    const opener = chooserOpener;
    if (choosing === undefined && opener === undefined) return undefined;
    choosing = undefined;
    chooserOpener = undefined;
    changed();
    return opener;
  }

  const actions: PartyActions = {
    get target() {
      observe();
      return planner.target;
    },
    refusal(trait) {
      observe();
      const placement = slotRules.canPlace(trait, planner.target.slot);
      return placement.ok ? null : placement.reason;
    },
    add(trait) {
      const at = planner.target;
      placed(addTrait(planner, trait), trait, at);
    },
    canChooseSlot: (trait) => allowedSlots(trait).length > 0,
    chooseSlot(trait, opener) {
      chooserOpener = opener;
      choosing = trait;
      changed();
    },
    placesOf(trait) {
      observe();
      return SLOT_POSITIONS.filter((at) => traitAt(planner.history.party, at) === trait.id);
    },
  };

  return {
    get planner() {
      observe();
      return planner;
    },
    get partyState() {
      observe();
      return partyState();
    },
    get message() {
      observe();
      return message;
    },
    get choosing() {
      observe();
      return choosing;
    },
    get choices() {
      observe();
      return choosing === undefined ? [] : slotChoices(planner.history.party, planner.target.member, choosing, lookup);
    },
    get datasetVersion() {
      observe();
      return versionInUse();
    },
    lookup,
    actions,

    useDataset(next) {
      dataset = next;
      changed();
    },

    arrive(params, entered) {
      const before = { planner, linkedVersion };
      const shared = decodePartyState(params);
      linkedVersion = shared.datasetVersion;
      // The same party as before (back to an entry that differed in the search only) keeps what can be undone.
      if (!samePartyState(partyState(), shared)) planner = createPlanner(shared);
      // A visit to an address with no party starts from the one of the last visit, which the address then says.
      let restored = false;
      if (entered && !params.has('party')) {
        const remembered = store.load();
        if (remembered !== undefined) {
          planner = createPlanner(remembered);
          linkedVersion = remembered.datasetVersion;
          restored = true;
        }
      }
      if (planner !== before.planner || linkedVersion !== before.linkedVersion) changed();
      return restored;
    },

    clearSlot(at) {
      const next = clearSlot(planner, at);
      if (next !== planner) edited(next, copy.clearedSlot(at));
    },
    clearAll() {
      const next = clearParty(planner);
      if (next !== planner) edited(next, copy.clearedParty);
    },
    undo() {
      const edit = planner.history.done.at(-1);
      if (edit !== undefined) edited(undoEdit(planner), copy.partyAnnouncements.undid(copy.partyEdit(edit.command)));
    },
    redo() {
      const edit = planner.history.undone.at(-1);
      if (edit !== undefined) edited(redoEdit(planner), copy.partyAnnouncements.redid(copy.partyEdit(edit.command)));
    },
    chooseSlot(at) {
      const next = chooseTarget(planner, at);
      if (next === planner) return;
      planner = next;
      changed();
      addressSink?.('refined');
      remember();
    },

    async addToChosenSlot(position) {
      const trait = choosing;
      if (trait === undefined) return;
      choosing = undefined;
      changed();
      await rendered();
      placed(addTraitAt(planner, trait, position), trait, position);
    },
    closeChooser() {
      const opener = dropChooser();
      if (opener?.isConnected === true) opener.focus();
    },
    forgetChooser() {
      dropChooser();
    },

    subscribe(listener) {
      watchers.add(listener);
      return () => {
        watchers.delete(listener);
      };
    },
    syncAddress(sink) {
      addressSink = sink;
      return () => {
        if (addressSink === sink) addressSink = undefined;
      };
    },
  };
}
