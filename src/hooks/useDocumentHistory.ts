/**
 * React binding for the pure history engine. `update` takes a pure updater so
 * it composes with React batching (each call reads the latest present).
 */
import { useCallback, useReducer } from 'react';
import {
  History, CommitOptions, createHistory, commit, undo, redo, breakCoalescing, resetHistory,
  canUndo, canRedo,
} from '../utils/history';

type Action<T> =
  | { type: 'update'; updater: (prev: T) => T; opts?: CommitOptions }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'break' }
  | { type: 'reset'; value: T };

function reducer<T>(h: History<T>, a: Action<T>): History<T> {
  switch (a.type) {
    case 'update': return commit(h, a.updater(h.present), a.opts);
    case 'undo': return undo(h);
    case 'redo': return redo(h);
    case 'break': return breakCoalescing(h);
    case 'reset': return resetHistory(a.value);
  }
}

export function useDocumentHistory<T>(initial: T | (() => T)) {
  const [history, dispatch] = useReducer(
    reducer as (h: History<T>, a: Action<T>) => History<T>,
    undefined as unknown as History<T>,
    () => createHistory(typeof initial === 'function' ? (initial as () => T)() : initial)
  );
  const update = useCallback((updater: (prev: T) => T, opts?: CommitOptions) => dispatch({ type: 'update', updater, opts }), []);
  const undoFn = useCallback(() => dispatch({ type: 'undo' }), []);
  const redoFn = useCallback(() => dispatch({ type: 'redo' }), []);
  const endGesture = useCallback(() => dispatch({ type: 'break' }), []);
  const reset = useCallback((value: T) => dispatch({ type: 'reset', value }), []);
  return {
    doc: history.present,
    update,
    undo: undoFn,
    redo: redoFn,
    endGesture,
    reset,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
  };
}
