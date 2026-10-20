<script lang="ts">
  import { syntaxSegments, tokenize, type QueryDiagnostic, type SyntaxSegment } from '@atlas/core';

  /** How many frames the mirror goes on following the field once it has lost the focus: a field scrolls back to its start then. */
  const FRAMES_AFTER_BLUR = 3;

  /**
   * The text of the search field in colour (ADR-0010, QUERY_LANGUAGE §8), drawn under the field, which is transparent: the field keeps
   * the typing, the caret, the selection, the undo and the keyboard, and this copy of its text gives them their colours. Each piece of
   * the query is coloured by what it is, what is wrong is marked under the text at fault, and the rest of the suggestion that Tab
   * takes is grey after the text (`ghost`). It is `aria-hidden`: a screen reader has the field, and the badge and the list of issues
   * say in words what the line under a text says.
   *
   * The copy must line up with the field letter by letter, so both wear `.query-text` and sit in one box, and the copy follows the
   * field's own scroll: a text longer than the field runs on beyond its edge. The pieces and the ghost are all there is inside the
   * track, with no blank between them, since a blank here is a character the field has not got.
   */
  const {
    input,
    value,
    issues,
    ghost,
  }: {
    /** The `<input>` this is the copy of. */
    input: HTMLInputElement | undefined;
    /** The text of the field, as the page holds it. */
    value: string;
    /** What is wrong with `value` (QUERY_LANGUAGE §5), for the line under the text at fault. */
    issues: readonly QueryDiagnostic[];
    /** The rest of the suggestion Tab would accept, to be drawn after the text; empty for none. */
    ghost: string;
  } = $props();

  type Part = Pick<SyntaxSegment, 'text' | 'severity'> & { readonly kind: SyntaxSegment['kind'] | 'ghost' };

  const parts = $derived.by((): readonly Part[] => {
    const segments: readonly Part[] = syntaxSegments(value, tokenize(value), issues);
    return ghost === '' ? segments : [...segments, { kind: 'ghost', text: ghost }];
  });

  /** A field shows its text on one line: a line break in the value (an address can carry one) is not a character of it. */
  const shown = (text: string): string => text.replace(/[\r\n]/g, '');

  /** How far the field's text is scrolled; the copy is moved by as much. */
  let scrolled = $state(0);

  // The field scrolls to keep its caret in sight, as a key is typed or a finger drags the text, and not always with an event the
  // page hears. While it has the focus the copy asks it every frame, and a few frames after it loses it (it scrolls back to its start).
  $effect(() => {
    const field = input;
    // `bind:this` hands back null, not undefined, when the field goes away (the search sheet shuts).
    if (!(field instanceof HTMLInputElement)) return;
    let frame = 0;
    let away = 0;
    const follow = (): void => {
      scrolled = field.scrollLeft;
    };
    const watch = (): void => {
      follow();
      away = field.ownerDocument.activeElement === field ? 0 : away + 1;
      frame = away > FRAMES_AFTER_BLUR ? 0 : requestAnimationFrame(watch);
    };
    const start = (): void => {
      away = 0;
      if (frame === 0) frame = requestAnimationFrame(watch);
    };

    follow();
    if (field.ownerDocument.activeElement === field) start();
    field.addEventListener('focus', start);
    field.addEventListener('input', follow);
    field.addEventListener('scroll', follow);
    return () => {
      field.removeEventListener('focus', start);
      field.removeEventListener('input', follow);
      field.removeEventListener('scroll', follow);
      cancelAnimationFrame(frame);
    };
  });
</script>

<span class="mirror query-text" aria-hidden="true"
  ><span class="track" style:transform="translateX({-scrolled}px)"
    >{#each parts as part, index (index)}<span data-kind={part.kind} data-severity={part.severity}
        >{shown(part.text)}</span
      >{/each}</span
  ></span
>

<style>
  /* Over the box of the field, which it does not take room from, and under the field itself: the pointer goes through to the field. */
  .mirror {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    overflow: hidden;
    pointer-events: none;
    user-select: none;
    color: var(--syntax-text);
  }

  /* It runs on past the edge of the box, as the text of the field does, and is moved by the field's scroll. */
  .track {
    flex: none;
  }

  [data-kind='field'] {
    color: var(--syntax-field);
  }

  [data-kind='value'] {
    color: var(--syntax-value);
  }

  [data-kind='text'] {
    color: var(--syntax-text);
  }

  [data-kind='phrase'] {
    color: var(--syntax-phrase);
  }

  [data-kind='operator'] {
    color: var(--syntax-operator);
  }

  [data-kind='paren'] {
    color: var(--syntax-paren);
  }

  [data-kind='negation'] {
    color: var(--syntax-negation);
  }

  [data-kind='ghost'] {
    color: var(--syntax-ghost);
  }

  /* The line under what is wrong: wavy for an error, dotted for a warning, so that the two differ in more than the colour. */
  [data-severity='error'] {
    text-decoration: underline wavy var(--underline-error);
    text-decoration-skip-ink: none;
    text-underline-offset: 5px;
  }

  [data-severity='warning'] {
    text-decoration: underline dotted var(--underline-warning) 2px;
    text-decoration-skip-ink: none;
    text-underline-offset: 5px;
  }

  /* A high-contrast mode forces its own colours: the field then shows its text itself (query-input.svelte) and the copy is not drawn. */
  @media (forced-colors: active) {
    .mirror {
      display: none;
    }
  }
</style>
