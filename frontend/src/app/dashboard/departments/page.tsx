'use client';

import { useEffect, useState } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Department {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  isActive: boolean;
  categoryCount: number;
}

const EMPTY_FORM = { name: '', code: '', sortOrder: 0 };

function slugify(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [codeManual, setCodeManual] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/departments');
      setDepartments(r.data);
    } catch {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setCodeManual(false);
    setShowPanel(true);
  }

  function openEdit(d: Department) {
    setEditing(d);
    setForm({ name: d.name, code: d.code, sortOrder: d.sortOrder });
    setCodeManual(true);
    setShowPanel(true);
  }

  function closePanel() {
    setShowPanel(false);
    setEditing(null);
  }
  useEscapeKey(closePanel, showPanel);

  async function save() {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    if (!form.code.trim()) { toast.error('Code required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/departments/${editing.id}`, { name: form.name, sortOrder: form.sortOrder });
        toast.success('Department updated');
      } else {
        await api.post('/departments', { name: form.name, code: form.code, sortOrder: form.sortOrder });
        toast.success('Department created');
      }
      closePanel();
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(d: Department) {
    try {
      await api.patch(`/departments/${d.id}`, { isActive: !d.isActive });
      toast.success(d.isActive ? 'Department deactivated' : 'Department activated');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed');
    }
  }

  async function remove(d: Department) {
    if (d.categoryCount > 0) { toast.error(`Has ${d.categoryCount} categories — cannot delete`); return; }
    if (!confirm(`Delete department "${d.name}"?`)) return;
    try {
      await api.delete(`/departments/${d.id}`);
      toast.success('Department deleted');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Delete failed');
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Department Management" />
      <div className="flex-1 p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">{departments.length} department{departments.length !== 1 ? 's' : ''}</p>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-[#1B4F8A] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#163f6e] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Department
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#1B4F8A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 w-20">Code</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 w-28">Categories</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 w-24">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-gray-400">
                      No departments yet. Run the seed or add one manually.
                    </td>
                  </tr>
                ) : departments.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.code}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{d.categoryCount}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${d.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {d.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(d)} title="Edit" className="p-1.5 text-gray-400 hover:text-[#1B4F8A] hover:bg-blue-50 rounded transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggleActive(d)} title={d.isActive ? 'Deactivate' : 'Activate'} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors">
                          {d.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => remove(d)}
                          title={d.categoryCount > 0 ? `Has ${d.categoryCount} categories` : 'Delete'}
                          disabled={d.categoryCount > 0}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-in panel */}
      {showPanel && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={closePanel} />
          <div className="w-96 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">{editing ? 'Edit Department' : 'Add Department'}</h2>
              <button onClick={closePanel} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({
                      ...f,
                      name,
                      code: codeManual ? f.code : slugify(name),
                    }));
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  placeholder="e.g. Food & Grocery"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Code *</label>
                <input
                  value={form.code}
                  onChange={(e) => { setCodeManual(true); setForm((f) => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })); }}
                  disabled={!!editing}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] font-mono disabled:bg-gray-50 disabled:text-gray-400"
                  placeholder="e.g. FOOD"
                  maxLength={10}
                />
                {!editing && <p className="text-xs text-gray-400 mt-1">Auto-generated from name. Cannot change after creation.</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Sort Order</label>
                <input
                  type="number" min="0"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={closePanel} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163f6e] disabled:opacity-50 font-semibold"
              >
                {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
