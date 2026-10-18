import { describe, expect, it, vi } from 'vitest';
import { fieldRegistry } from '../query/fields';
import { taxonomy } from '../taxonomy/taxonomy';
import type { SuggestionContext } from './context';
import type { Candidate } from './suggestion';
import {
  createSuggestionRegistry,
  SuggestionRegistryError,
  suggestionProvider,
  type SuggestionEnvironment,
  type SuggestionProvider,
} from './suggestion-registry';

const environment: SuggestionEnvironment = {
  fields: fieldRegistry,
  taxonomy,
  vocabulary: { class: [], family: [], creature: [], name: [] },
};

const offer = (insert: string): Candidate => ({ kind: 'field', insert, detail: '', complete: false, tier: 'prefix' });

const fieldContext: SuggestionContext = { kind: 'field', replace: [0, 0] };
const freeContext: SuggestionContext = { kind: 'free', replace: [0, 2], prefix: 'we', operator: false };

describe('suggestionProvider', () => {
  it('is a provider of the kind, whose handler is given the context of that kind', () => {
    const provider = suggestionProvider('free', ({ prefix }) => [offer(prefix)]);

    expect(provider.kind).toBe('free');
    expect(provider.suggest(freeContext, environment)).toEqual([offer('we')]);
  });

  it('offers nothing for a context of another kind, and does not ask the handler', () => {
    const handler = vi.fn((): Candidate[] => [offer('x')]);

    expect(suggestionProvider('free', handler).suggest(fieldContext, environment)).toEqual([]);
    expect(handler).not.toHaveBeenCalled();
  });
});

function problems(providers: SuggestionProvider[]): string {
  try {
    createSuggestionRegistry(providers);
  } catch (error) {
    if (error instanceof SuggestionRegistryError) return error.message;
    throw error;
  }
  throw new Error('Expected createSuggestionRegistry to throw');
}

describe('createSuggestionRegistry', () => {
  it('asks the provider of the kind of the context, with the context and the environment', () => {
    const suggest = vi.fn((): Candidate[] => [offer('from field')]);
    const other = vi.fn((): Candidate[] => [offer('from free')]);
    const registry = createSuggestionRegistry([
      { kind: 'field', suggest },
      { kind: 'free', suggest: other },
    ]);

    expect(registry.candidates(fieldContext, environment)).toEqual([offer('from field')]);
    expect(suggest).toHaveBeenCalledExactlyOnceWith(fieldContext, environment);
    expect(other).not.toHaveBeenCalled();
    expect(registry.candidates(freeContext, environment)).toEqual([offer('from free')]);
  });

  it('offers nothing for a context nobody answers, and when there are no providers at all', () => {
    expect(
      createSuggestionRegistry([{ kind: 'free', suggest: () => [offer('x')] }]).candidates(fieldContext, environment),
    ).toEqual([]);
    expect(createSuggestionRegistry([]).candidates(freeContext, environment)).toEqual([]);
  });

  it('lists the providers in the order they were given', () => {
    const providers: SuggestionProvider[] = [
      { kind: 'free', suggest: () => [] },
      { kind: 'field', suggest: () => [] },
    ];

    expect(createSuggestionRegistry(providers).providers).toEqual(providers);
  });

  it('refuses two providers for one kind of context, naming it', () => {
    const message = problems([
      { kind: 'free', suggest: () => [] },
      { kind: 'field', suggest: () => [] },
      { kind: 'free', suggest: () => [] },
    ]);

    expect(message).toContain('The suggestion providers are not valid');
    expect(message).toContain('"free" is answered by 2 providers');
    expect(message).not.toContain('"field"');
  });
});
