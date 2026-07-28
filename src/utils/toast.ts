/**
 * Tiny framework-free toast helper. Previously each call site built the same
 * floating <div> by hand; this centralises the styling and lifecycle so toasts
 * look and behave consistently across the app.
 */
export type ToastTone = 'success' | 'error' | 'info';

const TONE_CLASSES: Record<ToastTone, string> = {
  success: 'from-emerald-600 to-teal-600 border-emerald-400',
  error: 'from-rose-600 to-red-600 border-red-400',
  info: 'from-cyan-600 to-teal-600 border-cyan-400',
};

/**
 * Show a transient toast in the bottom-right corner.
 *
 * @param message  Body text.
 * @param tone     Visual style (success | error | info).
 * @param opts     Optional title and display duration (ms).
 */
export function showToast(
  message: string,
  tone: ToastTone = 'success',
  opts: { title?: string; durationMs?: number } = {}
): void {
  if (typeof document === 'undefined') return;

  const { title, durationMs = 4500 } = opts;
  const toast = document.createElement('div');
  toast.className =
    `fixed bottom-14 right-5 bg-gradient-to-r ${TONE_CLASSES[tone]} text-white text-xs ` +
    'font-semibold px-4 py-3 rounded-xl shadow-2xl border z-[120] flex flex-col gap-1 ' +
    'max-w-sm animate-in slide-in-from-bottom-4 duration-300';

  if (title) {
    const heading = document.createElement('div');
    heading.className = 'font-bold text-[12px] flex items-center gap-1.5';
    heading.textContent = title;
    toast.appendChild(heading);
  }

  const body = document.createElement('p');
  body.className = 'text-[11px] font-medium leading-relaxed';
  body.textContent = message;
  toast.appendChild(body);

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), durationMs);
}
