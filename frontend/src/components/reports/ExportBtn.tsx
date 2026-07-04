'use client';

import { useState } from 'react';
import { Download, Printer, FileJson, Loader2 } from 'lucide-react';

interface Props {
  onExcel?:   () => Promise<void>;
  onPrint?:   () => void;
  onJson?:    () => void;
  excelLabel?: string;
}

export default function ExportBtn({ onExcel, onPrint, onJson, excelLabel = 'Excel' }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleExcel() {
    if (!onExcel || loading) return;
    setLoading(true);
    try { await onExcel(); }
    finally { setLoading(false); }
  }

  return (
    <div className="flex items-center gap-2">
      {onExcel && (
        <button
          onClick={handleExcel}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Download className="w-3.5 h-3.5" />}
          {excelLabel}
        </button>
      )}
      {onJson && (
        <button
          onClick={onJson}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-700 text-white rounded-lg hover:bg-gray-800"
        >
          <FileJson className="w-3.5 h-3.5" /> JSON
        </button>
      )}
      {onPrint && (
        <button
          onClick={onPrint}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163d6e]"
        >
          <Printer className="w-3.5 h-3.5" /> Print
        </button>
      )}
    </div>
  );
}
