// A beginner picking the wrong file is an ordinary mistake, and the load path
// reported failures with String(error). That prepends "Error:" to our own
// guidance and, for a malformed file, surfaces the parser's exception verbatim
// — an observed example being "RangeError: Offset is outside the bounds of the
// DataView", which tells the user nothing they can act on.
const ACTIONABLE = /\b(vrm|pmx|vmd|avatar)\b/i;

export function describeLoadFailure(error: unknown): string {
  const raw = (error instanceof Error ? error.message : String(error)).trim();
  // Messages this application raises already name the file kinds and what to do.
  if (raw && ACTIONABLE.test(raw)) return raw;
  return 'This file could not be read as a VRM avatar. It may be incomplete, or not a VRM at all. '
    + 'Use Load another VRM to choose a different file.';
}
