/** How the badge of an option is coloured: the kind of keyword it names, or none (a neutral badge). The word in it says the rest. */
export type ComboboxTone = 'neutral' | 'buff' | 'debuff' | 'mechanic' | 'event';

/** One row of the list of a `Combobox`: what the person sees, and what a screen reader reads of it (all of the text, in this order). */
export interface ComboboxOption {
  /** A short word for what the option is ("Debuff", "Field"): the colour of the badge never says it alone. */
  readonly badge: string;
  readonly tone: ComboboxTone;
  /** What is written when the option is accepted, in the font of the field. */
  readonly label: string;
  /** One line on what it is or means, beside the label (under it on a narrow screen). */
  readonly detail: string;
  /** A number at the end of the row, as drawn ("42"). The words that follow it for a screen reader are `trailingUnit`. */
  readonly trailing?: string;
  readonly trailingUnit?: string;
  /** Accepting it leaves the person in the middle of a term (a field, an operator): the list stays open for what comes next. */
  readonly continues: boolean;
}
