import { fieldProvider, operatorOrFieldProvider, unknownFieldProvider } from './field-providers';
import { freeProvider } from './free-provider';
import { createSuggestionRegistry } from './suggestion-registry';
import { actorProvider, fieldValueProvider } from './value-providers';

/** QUERY_LANGUAGE §6. To answer a new kind of context, add a provider here. */
export const suggestionRegistry = createSuggestionRegistry([
  operatorOrFieldProvider,
  fieldProvider,
  freeProvider,
  fieldValueProvider,
  actorProvider,
  unknownFieldProvider,
]);
