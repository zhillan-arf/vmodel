// A minimized window delivers zero animation frames: measured 60.04 fps before,
// 0.00 while minimized, 59.91 after restoring. The avatar freezes and an OBS
// window capture of it goes blank, which is the symptom pair that took a long
// time to explain. Nobody can read a warning while the window is hidden, so the
// useful moment is when it comes back: say what happened and for how long.
const MINIMUM_REPORTABLE_MS = 1000;

export interface FreezeNotice {
  /** Call when the page becomes hidden. Repeat calls keep the earliest moment. */
  hidden(atMs: number): void;
  /** Call when the page becomes visible. Returns a message, or null if too brief to matter. */
  visible(atMs: number): string | null;
  /** True while the page is known to be hidden. */
  isHidden(): boolean;
}

export function describeFreeze(seconds: number): string {
  const rounded = seconds >= 10 ? Math.round(seconds) : Math.round(seconds * 10) / 10;
  return `Output was hidden for ${rounded} s, so the avatar stopped and any OBS capture of this window was blank. `
    + 'Keep this window open — covering it with other windows is fine, minimizing it is not.';
}

export function createFreezeNotice({ minimumMs = MINIMUM_REPORTABLE_MS } = {}): FreezeNotice {
  let hiddenAt: number | null = null;
  return {
    hidden(atMs: number) {
      if (!Number.isFinite(atMs)) return;
      if (hiddenAt === null) hiddenAt = atMs;
    },
    visible(atMs: number) {
      const start = hiddenAt;
      hiddenAt = null;
      if (start === null || !Number.isFinite(atMs)) return null;
      const elapsed = atMs - start;
      // A clock that jumped backwards, or a flicker too short to break a stream,
      // is not worth interrupting the user over.
      if (!(elapsed >= minimumMs)) return null;
      return describeFreeze(elapsed / 1000);
    },
    isHidden: () => hiddenAt !== null,
  };
}
