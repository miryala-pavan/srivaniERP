'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { MEASURE_TYPES, MEASURE_TYPE_LABELS, UNIT_SYMBOLS, calcBaseUnitQty, deriveUqc } from '@/lib/units';

export interface SavedUnitValues {
  measureType: string;
  unitSymbol: string;
  unitSize: number;
  baseUnitQty: number;
  gstUqc?: string;
}

type Target = { mode: 'plu'; ids: string[] } | { mode: 'product'; ids: string[] };

interface SetUnitModalProps {
  target: Target;
  title?: string;
  onClose: () => void;
  onSaved: (values: SavedUnitValues) => void;
}

export function SetUnitModal({ target, title, onClose, onSaved }: SetUnitModalProps) {
  const [measureType, setMeasureType] = useState('');
  const [unitSymbol, setUnitSymbol]   = useState('');
  const [unitSize, setUnitSize]       = useState('');
  const [saving, setSaving]           = useState(false);

  const count = target.ids.length;

  async function save() {
    const size = parseFloat(unitSize);
    if (!measureType || !unitSymbol || !size || size <= 0) { toast.error('Choose a measure, unit and size'); return; }
    const baseUnitQty = calcBaseUnitQty(unitSymbol, size);
    const gstUqc = deriveUqc(unitSymbol) ?? undefined;
    setSaving(true);
    try {
      const res = await api.patch('/products/unit-audit/bulk-set', {
        ...(target.mode === 'plu' ? { pluIds: target.ids } : { productIds: target.ids }),
        measureType, unitSymbol, unitSize: size, baseUnitQty, gstUqc,
      });
      toast.success(`Unit set on ${res.data.updated} ${target.mode === 'plu' ? 'PLU' : 'product'}${res.data.updated !== 1 ? 's' : ''}`);
      onSaved({ measureType, unitSymbol, unitSize: size, baseUnitQty, gstUqc });
    } catch {
      toast.error('Failed to update units');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{title ?? `Set unit for ${count} item${count !== 1 ? 's' : ''}`}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          {count > 1 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              The same unit is applied to every selected item. Only select items you know share the same pack size.
            </p>
          )}
          <select value={measureType} onChange={e => { setMeasureType(e.target.value); setUnitSymbol(''); }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">— Measure type —</option>
            {MEASURE_TYPES.map(mt => <option key={mt} value={mt}>{MEASURE_TYPE_LABELS[mt]}</option>)}
          </select>
          <div className="flex gap-2">
            <select value={unitSymbol} onChange={e => setUnitSymbol(e.target.value)}
              disabled={!measureType} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50">
              <option value="">Unit</option>
              {(UNIT_SYMBOLS[measureType] ?? []).map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input type="number" min="0" value={unitSize} onChange={e => setUnitSize(e.target.value)}
              disabled={!unitSymbol} placeholder="Size"
              className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50" />
          </div>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60 font-medium">
            {saving ? 'Saving…' : count > 1 ? 'Apply to Selected' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
