// A beginner picking the wrong file is an ordinary mistake, and several paths
// reported failures with String(error). That prepends "Error:" to our own
// guidance and, for a malformed file, surfaces the parser's exception verbatim
// — an observed example being "RangeError: Offset is outside the bounds of the
// DataView", which tells the user nothing they can act on.
//
// Messages this application raises name a file kind, a setting or a next step;
// exceptions thrown by a parser, a fetch or the platform do not.
// Kept deliberately narrow. Every message this application raises names one
// of these; widening it to words like "file" would let a platform exception
// such as "Failed to fetch file" through as if it were guidance.
const ACTIONABLE = /\b(vrm|pmx|vmd|avatar|settings)\b/i;

/** The thrown message without its exception prefix, or the fallback when it is
 *  a parser or platform exception the user cannot act on. */
export function readableError(error: unknown, fallback: string): string {
  const raw = (error instanceof Error ? error.message : String(error)).trim();
  return raw && ACTIONABLE.test(raw) ? raw : fallback;
}

export function describeLoadFailure(error: unknown): string {
  if (error instanceof Error && error.message === 'Model preparation exceeded 30 seconds. Retry the operation.') return error.message;
  return readableError(error,
    'This file could not be read as a VRM avatar. It may be incomplete, or not a VRM at all. '
    + 'Use Load another VRM to choose a different file.');
}
