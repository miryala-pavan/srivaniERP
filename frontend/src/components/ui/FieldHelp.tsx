'use client';

import { useState, useEffect } from 'react';

export interface FieldHelpProps {
  hint?: string;
  title?: string;
  description?: string;
  example?: string;
  level?: 'info' | 'warning' | 'critical';
}

const LEVEL_CLS: Record<string, string> = {
  info:     'bg-blue-50 border-blue-200 text-blue-800',
  warning:  'bg-amber-50 border-amber-200 text-amber-800',
  critical: 'bg-red-50 border-red-200 text-red-800',
};

export function FieldHelp({ hint, title, description, example, level }: FieldHelpProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onMouse(e: MouseEvent) {
      if (!(e.target as Element).closest('.help-popover')) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div>
      {/* Persistent level box — always visible, no dismiss */}
      {level && (title || description) && (
        <div className={`mt-1.5 border rounded-lg px-3 py-2 text-xs ${LEVEL_CLS[level]}`}>
          {title && <p className="font-semibold mb-0.5">{title}</p>}
          {description && <p className="leading-relaxed">{description}</p>}
          {example && (
            <p className="mt-1.5 font-mono bg-white/60 rounded px-1.5 py-1">{example}</p>
          )}
        </div>
      )}

      {/* Tooltip ? icon */}
      {!level && (title || description) && (
        <div className="help-popover relative inline-block ml-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs font-bold hover:bg-blue-100 hover:text-blue-600 inline-flex items-center justify-center leading-none"
          >
            ?
          </button>
          {open && (
            <div className="absolute z-50 left-0 top-6 w-72 bg-white border border-gray-200 rounded-lg shadow-xl p-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-base leading-none"
              >
                ×
              </button>
              {title && (
                <p className="font-semibold text-gray-800 text-sm mb-1 pr-5">{title}</p>
              )}
              {description && (
                <p className="text-gray-600 text-xs leading-relaxed">{description}</p>
              )}
              {example && (
                <p className="mt-2 text-xs font-mono bg-gray-50 rounded p-1.5 text-gray-700">
                  {example}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hint — always visible below field */}
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export function FieldLabel({
  label,
  required,
  help,
}: {
  label: string;
  required?: boolean;
  help?: FieldHelpProps;
}) {
  return (
    <div className="flex items-center gap-1 mb-1">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {help && <FieldHelp {...help} />}
    </div>
  );
}
