/** The downloaded sheet does not have the shape the pipeline expects. Fatal: nothing should be published from it. */
export class SheetFormatError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SheetFormatError';
  }
}
