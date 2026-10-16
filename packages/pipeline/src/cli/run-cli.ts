import { SheetFetchError } from '../fetch/fetch-sheet';
import { OverridesError } from '../overrides/overrides-error';
import { SheetFormatError } from '../sheet/sheet-format-error';
import { CliError } from './cli-error';

/** Runs a command; a failure is printed (just the message when it is a known kind) and sets the exit code. */
export async function runCli(command: () => Promise<unknown>): Promise<void> {
  try {
    await command();
  } catch (error) {
    const expected =
      error instanceof CliError ||
      error instanceof SheetFetchError ||
      error instanceof SheetFormatError ||
      error instanceof OverridesError;
    console.error(expected ? error.message : error);
    process.exitCode = 1;
  }
}
