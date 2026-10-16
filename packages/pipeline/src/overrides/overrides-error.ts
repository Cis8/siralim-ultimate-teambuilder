/** `overrides.yaml` is invalid, or asks for something the data cannot do. Fatal: a correction nobody can trust is worse than none. */
export class OverridesError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'OverridesError';
  }
}
