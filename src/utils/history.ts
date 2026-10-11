/**
 * Undo/redo engine: a pure, framework-free history over immutable snapshots.
 *
 * Snapshots are structurally shared (state updates are immutable), so keeping
 * HISTORY_LIMIT of them costs only the changed objects, not full copies.
 *
 * Coalescing: high-frequency edits (dragging, typing in a spec field) arrive as
 * dozens of commits. Commits that share a `coalesceKey` merge into ONE undo step
 * until `breakCoalescing` is called (drag end) or the window elapses.
 */

export const HISTORY_LIMIT = 100;
export const DEFAULT_COALESCE_WINDOW_MS = 800;

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  lastKey: string | null;
  lastAt: number;
}

export interface CommitOptions {
  /** Merge with the previous commit when it used the same key. */
  coalesceKey?: string;
  /** Max gap (ms) between two commits for them to merge. */
  windowMs?: number;
  limit?: number;
  now?: number;
}

export const createHistory = <T>(present: T): History<T> => ({
  past: [],
  present,
  future: [],
  lastKey: null,
  lastAt: 0,
});

export const canUndo = <T>(h: History<T>): boolean => h.past.length > 0;
export const canRedo = <T>(h: History<T>): boolean => h.future.length > 0;

/** Record `next` as the new present. Referentially-equal states are ignored. */
export function commit<T>(h: History<T>, next: T, opts: CommitOptions = {}): History<T> {
  if (Object.is(next, h.present)) return h;
  const now = opts.now ?? Date.now();
  const window = opts.windowMs ?? DEFAULT_COALESCE_WINDOW_MS;
  const limit = opts.limit ?? HISTORY_LIMIT;
  const key = opts.coalesceKey ?? null;

  const merge = key !== null && key === h.lastKey && now - h.lastAt <= window && h.past.length > 0;
  if (merge) {
    // Same gesture: keep the pre-gesture snapshot in `past`, just advance present.
    return { ...h, present: next, future: [], lastAt: now };
  }
  const past = [...h.past, h.present];
  if (past.length > limit) past.splice(0, past.length - limit);
  return { past, present: next, future: [], lastKey: key, lastAt: now };
}

/** Close the current coalescing group so the next commit starts a new step. */
export const breakCoalescing = <T>(h: History<T>): History<T> =>
  h.lastKey === null ? h : { ...h, lastKey: null };

export function undo<T>(h: History<T>): History<T> {
  if (!canUndo(h)) return h;
  const past = h.past.slice(0, -1);
  return { past, present: h.past[h.past.length - 1], future: [h.present, ...h.future], lastKey: null, lastAt: 0 };
}

export function redo<T>(h: History<T>): History<T> {
  if (!canRedo(h)) return h;
  const [next, ...future] = h.future;
  return { past: [...h.past, h.present], present: next, future, lastKey: null, lastAt: 0 };
}

/** Replace the present WITHOUT creating an undo step and drop all history. */
export const resetHistory = <T>(present: T): History<T> => createHistory(present);
