'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface Department { id: string; name: string; }
interface Category   { id: string; name: string; departmentId: string | null; }
interface SubCategory {
  id: string; name: string; label: string; sortOrder: number; isActive: boolean;
  parentId: string | null;
  parent: { id: string; name: string; label: string } | null;
  department: { id: string; name: string } | null;
  _count: { products: number };
}

const EMPTY_FORM = { name: '', categoryId: '', sortOrder: 0, isActive: true };

export default function SubCategoriesPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [filterDeptId, setFilterDeptId] = useState('');
  const [filterCatId, setFilterCatId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [editing, setEditing] = useState<SubCategory | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formDeptId, setFormDeptId] = useState('');
  const [saving, setSaving] = useState(false);

  useEscapeKey(closePanel, showPanel);

  async function loadDepts() {
    try {
      const r = await api.get('/departments?isActive=true');
      setDepartments(r.data);
    } catch {}
  }

  async function loadAllCats() {
    try {
      const r = await api.get('/products/categories');
      setAllCategories(r.data);
    } catch {}
  }

  async function loadSubCats(catId?: string, deptId?: string) {
    setLoading(true);
    try {
      const params: any = {};
      if (catId)  params.categoryId  = catId;
      if (deptId) params.departmentId = deptId;
      const r = await api.get('/products/subcategories', { params });
      setSubCategories(r.data);
    } catch {
      toast.error('Failed to load sub-categories');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDepts(); loadAllCats(); loadSubCats(); }, []);

  useEffect(() => {
    setFilterCatId('');
    loadSubCats(undefined, filterDeptId || undefined);
  }, [filterDeptId]);

  useEffect(() => {
    if (filterCatId) loadSubCats(filterCatId, undefined);
    else loadSubCats(undefined, filterDeptId || undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCatId]);

  const filteredCatsForDept = filterDeptId
    ? allCategories.filter((c) => c.departmentId === filterDeptId)
    : allCategories;

  const formCatsForDept = formDeptId
    ? allCategories.filter((c) => c.departmentId === formDeptId)
    : allCategories;

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFormDeptId(filterDeptId);
    setShowPanel(true);
  }

  function openEdit(s: SubCategory) {
    setEditing(s);
    setFormDeptId(s.department?.id ?? '');
    setForm({ name: s.name, categoryId: s.parentId ?? '', sortOrder: s.sortOrder, isActive: s.isActive });
    setShowPanel(true);
  }

  function closePanel() { setShowPanel(false); setEditing(null); }

  async function save() {
    if (!form.name.trim())    { toast.error('Name required'); return; }
    if (!form.categoryId)     { toast.error('Category required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/products/subcategories/${editing.id}`, {
          name: form.name, categoryId: form.categoryId,
          sortOrder: form.sortOrder, isActive: form.isActive,
        });
        toast.success('Sub-category updated');
      } else {
        await api.post('/products/subcategories', {
          name: form.name, categoryId: form.categoryId, sortOrder: form.sortOrder,
        });
        toast.success('Sub-category created');
      }
      closePanel();
      loadSubCats(filterCatId || undefined, filterCatId ? undefined : filterDeptId || undefined);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: SubCategory) {
    if (s._count.products > 0) { toast.error(`Has ${s._count.products} products — cannot delete`); return; }
    if (!confirm(`Delete sub-category "${s.name}"?`)) return;
    try {
      await api.delete(`/products/subcategories/${s.id}`);
      toast.success('Sub-category deleted');
      loadSubCats(filterCatId || undefined, filterCatId ? undefined : filterDeptId || undefined);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Delete failed');
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Sub-Category Management" />
      <div className="flex-1 p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={filterDeptId}
              onChange={(e) => setFilterDeptId(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
            >
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select
              value={filterCatId}
              onChange={(e) => setFilterCatId(e.target.value)}
              disabled={filteredCatsForDept.length === 0}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">All Categories</option>
              {filteredCatsForDept.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="text-sm text-gray-500">{subCategories.length} sub-categor{subCategories.length !== 1 ? 'ies' : 'y'}</span>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-[#1B4F8A] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#163f6e] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Sub-Category
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
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Department</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 w-24">Products</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 w-24">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subCategories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-gray-400">
                      No sub-categories found. Run the department seed to create "General" placeholders.
                    </td>
                  </tr>
                ) : subCategories.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.department?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{s.parent?.name ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{s._count.products}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(s)} title="Edit" className="p-1.5 text-gray-400 hover:text-[#1B4F8A] hover:bg-blue-50 rounded transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => remove(s)}
                          title={s._count.products > 0 ? `Has ${s._count.products} products` : 'Delete'}
                          disabled={s._count.products > 0}
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

      {showPanel && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={closePanel} />
          <div className="w-96 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">{editing ? 'Edit Sub-Category' : 'Add Sub-Category'}</h2>
              <button onClick={closePanel} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Department (for filtering)</label>
                <select
                  value={formDeptId}
                  onChange={(e) => { setFormDeptId(e.target.value); setForm((f) => ({ ...f, categoryId: '' })); }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Category *</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                >
                  <option value="">Select category…</option>
                  {formCatsForDept.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  placeholder="e.g. Basmati Rice"
                />
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
              {editing && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="sub-active" checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="rounded" />
                  <label htmlFor="sub-active" className="text-sm text-gray-700">Active</label>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={closePanel} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 py-2 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163f6e] disabled:opacity-50 font-semibold">
                {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
