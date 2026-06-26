/** Error carrying an HTTP status and a client-safe, human-readable message. */
export class HttpError extends Error {
  readonly status: number;
  /** Optional extra context (e.g. upstream Gemini status/body) surfaced to the client for debugging. */
  readonly detail?: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.detail = detail;
  }
}
