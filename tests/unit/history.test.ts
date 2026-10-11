import { describe, it, expect } from 'vitest';
import {
  createHistory, commit, undo, redo, canUndo, canRedo, breakCoalescing, HISTORY_LIMIT,
} from '../../src/utils/history';

describe('history', () => {
  it('undoes and redoes sequential commits', () => {
    let h = createHistory(0);
    h = commit(h, 1); h = commit(h, 2); h = commit(h, 3);
    expect(h.present).toBe(3);
    h = undo(h); expect(h.present).toBe(2);
    h = undo(h); expect(h.present).toBe(1);
    h = redo(h); expect(h.present).toBe(2);
    expect(canUndo(h) && canRedo(h)).toBe(true);
  });

  it('is a no-op at the ends of history', () => {
    const h = createHistory('a');
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it('clears the redo stack when a new edit follows an undo', () => {
    let h = createHistory(0);
    h = commit(h, 1); h = commit(h, 2);
    h = undo(h);
    h = commit(h, 9);
    expect(h.present).toBe(9);
    expect(canRedo(h)).toBe(false);
    expect(undo(h).present).toBe(1);
  });

  it('ignores commits that do not change the state (same reference)', () => {
    const obj = { a: 1 };
    let h = createHistory(obj);
    h = commit(h, obj);
    expect(canUndo(h)).toBe(false);
  });

  it('coalesces a drag into ONE undo step', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 50; i++) h = commit(h, i, { coalesceKey: 'move:a', now: 1000 + i * 16 });
    expect(h.present).toBe(50);
    expect(h.past).toEqual([0]);
    expect(undo(h).present).toBe(0);
  });

  it('starts a new step after the gesture is explicitly ended (drag end)', () => {
    let h = createHistory(0);
    h = commit(h, 1, { coalesceKey: 'move:a', now: 1000 });
    h = commit(h, 2, { coalesceKey: 'move:a', now: 1010 });
    h = breakCoalescing(h);
    h = commit(h, 3, { coalesceKey: 'move:a', now: 1020 });
    expect(undo(h).present).toBe(2);
    expect(undo(undo(h)).present).toBe(0);
  });

  it('does not merge different keys or commits outside the window', () => {
    let h = createHistory(0);
    h = commit(h, 1, { coalesceKey: 'specs:a', now: 1000 });
    h = commit(h, 2, { coalesceKey: 'specs:b', now: 1100 });
    h = commit(h, 3, { coalesceKey: 'specs:b', now: 5000, windowMs: 800 });
    expect(h.past).toEqual([0, 1, 2]);
  });

  it('never merges the very first commit into the initial state', () => {
    let h = createHistory(0);
    h = commit(h, 1, { coalesceKey: 'k', now: 10 });
    expect(undo(h).present).toBe(0);
  });

  it('caps history length, dropping the oldest steps', () => {
    let h = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 25; i++) h = commit(h, i);
    expect(h.past.length).toBe(HISTORY_LIMIT);
    expect(h.past[0]).toBe(25);
  });
});
