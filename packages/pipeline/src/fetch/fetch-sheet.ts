import { csvUrl, type SheetSource } from './sheet-source';

/** The sheet could not be downloaded. */
export class SheetFetchError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SheetFetchError';
  }
}

export interface FetchSheetOptions {
  /** Defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
  /** Defaults to a timer. */
  readonly sleep?: (milliseconds: number) => Promise<void>;
  /** Total tries, the first included. */
  readonly attempts?: number;
}

const DEFAULT_ATTEMPTS = 4;
const FIRST_WAIT_MS = 1000;

/** Answers that are the server's, not ours, and may pass: worth another try. */
const isTemporary = (status: number) => status === 408 || status === 425 || status === 429 || status >= 500;

/**
 * Downloads one tab as CSV. A temporary failure (network error, 408, 425, 429, 5xx) is retried with doubling waits
 * (1 s, 2 s, 4 s); anything else fails at once, since asking again would not change the answer.
 *
 * @throws SheetFetchError
 */
export async function fetchSheet(source: SheetSource, options: FetchSheetOptions = {}): Promise<string> {
  const request = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const attempts = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS);

  let lastFailure: SheetFetchError | undefined;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (attempt > 1) await sleep(FIRST_WAIT_MS * 2 ** (attempt - 2));
    const result = await tryOnce(request, source);
    if ('csv' in result) return result.csv;
    lastFailure = result.temporaryFailure;
  }
  throw new SheetFetchError(
    `Giving up on the "${source.name}" tab after ${attempts} attempts: ${lastFailure?.message}`,
    {
      cause: lastFailure?.cause ?? lastFailure,
    },
  );
}

type Attempt = { readonly csv: string } | { readonly temporaryFailure: SheetFetchError };

/** One request. Returns a temporary failure; throws one that asking again would not cure. */
async function tryOnce(request: typeof fetch, source: SheetSource): Promise<Attempt> {
  let response: Response;
  try {
    response = await request(csvUrl(source));
  } catch (error) {
    return { temporaryFailure: networkFailure(source, error) };
  }

  if (!response.ok) {
    const failure = new SheetFetchError(`Google answered ${response.status} for the "${source.name}" tab`);
    if (isTemporary(response.status)) return { temporaryFailure: failure };
    throw failure;
  }
  if (response.headers.get('content-type')?.includes('text/html')) {
    throw new SheetFetchError(
      `Google sent a web page instead of CSV for the "${source.name}" tab: is the sheet still shared by link?`,
    );
  }

  try {
    return { csv: await response.text() };
  } catch (error) {
    return { temporaryFailure: networkFailure(source, error) };
  }
}

function networkFailure(source: SheetSource, error: unknown): SheetFetchError {
  const reason = error instanceof Error ? error.message : String(error);
  return new SheetFetchError(`Could not reach Google for the "${source.name}" tab (${reason})`, { cause: error });
}

const defaultSleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
