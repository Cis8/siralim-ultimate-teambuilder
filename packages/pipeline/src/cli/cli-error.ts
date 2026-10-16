/** The command was used wrongly, e.g. it was run before its input exists. Reported as a message, not a stack trace. */
export class CliError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CliError';
  }
}
