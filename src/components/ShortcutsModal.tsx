import { Keyboard, X } from 'lucide-react';
import { useEffect } from 'react';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: 'C', desc: 'Compose a new email' },
  { keys: '/', desc: 'Focus global search bar' },
  { keys: '↑ / ↓', desc: 'Navigate messages in list' },
  { keys: 'R', desc: 'Reply to selected message' },
  { keys: 'F', desc: 'Forward selected message' },
  { keys: 'Del', desc: 'Delete selected message(s)' },
  { keys: 'Esc', desc: 'Close active dialog or drawer' },
  { keys: '?', desc: 'Open keyboard shortcuts guide' },
];

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#232328] rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <h2 id="shortcuts-modal-title" className="font-display font-semibold text-sm flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-[#0F6CBD] dark:text-[#479EF5]" aria-hidden="true" />
            <span>Keyboard Shortcuts</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts dialog"
            className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 divide-y divide-neutral-100 dark:divide-neutral-800">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="py-2 flex items-center justify-between gap-4 text-xs">
              <span className="text-neutral-700 dark:text-neutral-200">{s.desc}</span>
              <kbd className="px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800 font-mono text-[11px] font-semibold shrink-0">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
