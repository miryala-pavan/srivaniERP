'use client';

import { useState, useMemo, useCallback } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, X, ChevronRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';

interface Department { id: string; name: string; code: string; }

interface Category {
  id: string; name: string; code: string; label: string;
  sortOrder: number; isActive: boolean;
  departmentId: string | null;
  department: { id: string; name: string; code: string } | null;
  _count: { products: number; children: number };
}

interface SubCategory {
  id: string; name: string; code: string; label: string;
  sortOrder: number; isActive: boolean;
  parentId: string | null;
  parent: { id: string; name: string; code: string } | null;
  department: { id: string; name: string } | null;
  _count: { products: number };
}

type PanelMode = 'add-sub' | 'edit-sub';

const EMPTY_SUB_FORM = { name: '', sortOrder: 0, isActive: true };

export default function CategoriesPage() {
  const queryClient = useQueryClient();

  const [filterDeptId, setFilterDeptId] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [showPanel, setShowPanel] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('add-sub');
  const [panelCat, setPanelCat] = useState<Category | null>(null);
  const [panelSub, setPanelSub] = useState<SubCategory | null>(null);
  const [form, setForm] = useState({ ...EMPTY_SUB_FORM });
  const [saving, setSaving] = useState(false);

  // ── Data ────────────────────────────────────────────────────────────────────

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments?isActive=true').then((r) => r.data),
  });

  const { data: categories = [], isLoading: catsLoading } = useQuery<Category[]>({
    queryKey: ['categories', filterDeptId],
    queryFn: () =>
      api.get('/products/categories', {
        params: filterDeptId ? { departmentId: filterDeptId } : {},
      }).then((r) => r.data),
  });

  const { data: subcategories = [] } = useQuery<SubCategory[]>({
    queryKey: ['subcategories', filterDeptId],
    queryFn: () =>
      api.get('/products/subcategories', {
        params: filterDeptId ? { departmentId: filterDeptId } : {},
      }).then((r) => r.data),
  });

  // ── WebSocket ────────────────────────────────────────────────────────────────

  const invalidateSubs = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['subcategories'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  }, [queryClient]);

  useWebSocketEvent('subcategory.created', invalidateSubs);
  useWebSocketEvent('subcategory.updated', invalidateSubs);
  useWebSocketEvent('subcategory.deleted', invalidateSubs);
  useWebSocketEvent('category.created', invalidateSubs);
  useWebSocketEvent('category.updated', invalidateSubs);
  useWebSocketEvent('category.deleted', invalidateSubs);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const subsByParent = useMemo(() => {
    const map = new Map<string, SubCategory[]>();
    for (const s of subcategories) {
      if (!s.parentId) continue;
      const arr = map.get(s.parentId) ?? [];
      arr.push(s);
      map.set(s.parentId, arr);
    }
    return map;
  }, [subcategories]);

  const catsByDept = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of categories) {
      const key = c.departmentId ?? '__none__';
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return map;
  }, [categories]);

  const displayDepts = filterDeptId
    ? departments.filter((d) => d.id === filterDeptId)
    : departments;

  // ── Tree expand/collapse ─────────────────────────────────────────────────────

  function toggleCat(id: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpandedCats(new Set(categories.map((c) => c.id)));
  }

  function collapseAll() {
    setExpandedCats(new Set());
  }

  // ── Panel helpers ────────────────────────────────────────────────────────────

  function openAddSub(cat: Category) {
    setPanelMode('add-sub');
    setPanelCat(cat);
    setPanelSub(null);
    setForm({ ...EMPTY_SUB_FORM });
    setShowPanel(true);
  }

  function openEditSub(sub: SubCategory) {
    setPanelMode('edit-sub');
    setPanelCat(null);
    setPanelSub(sub);
    setForm({ name: sub.name, sortOrder: sub.sortOrder, isActive: sub.isActive });
    setShowPanel(true);
  }

  function closePanel() { setShowPanel(false); }
  useEscapeKey(closePanel, showPanel);

  async function saveSub() {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      if (panelMode === 'add-sub') {
        await api.post('/products/subcategories', {
          name: form.name.trim(),
          categoryId: panelCat!.id,
          sortOrder: form.sortOrder,
        });
        toast.success('Subcategory added');
        setExpandedCats((prev) => new Set(prev).add(panelCat!.id));
      } else {
        await api.patch(`/products/subcategories/${panelSub!.id}`, {
          name: form.name.trim(),
          sortOrder: form.sortOrder,
          isActive: form.isActive,
        });
        toast.success('Subcategory updated');
      }
      closePanel();
      invalidateSubs();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSub(sub: SubCategory) {
    if (sub.code.endsWith('_GEN')) {
      toast.error('Cannot delete the General fallback subcategory');
      return;
    }
    if (sub._count.products > 0) {
      toast.error(`Has ${sub._count.products} product${sub._count.products !== 1 ? 's' : ''} — reassign first`);
      return;
    }
    if (!confirm(`Delete subcategory "${sub.name}"?`)) return;
    try {
      await api.delete(`/products/subcategories/${sub.id}`);
      toast.success('Subcategory deleted');
      invalidateSubs();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Delete failed');
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Category Management" />

      <div className="flex-1 p-6">
        {/* Back + Breadcrumbs */}
        <div className="flex items-center gap-3 mb-4">
          <BackButton fallbackHref="/dashboard" />
          <span className="text-gray-300">/</span>
          <Breadcrumbs
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Categories' },
            ]}
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={filterDeptId}
              onChange={(e) => { setFilterDeptId(e.target.value); setExpandedCats(new Set()); }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
            >
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>

            <span className="text-sm text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2 tabular-nums">
              {subcategories.length} sub-categor{subcategories.length !== 1 ? 'ies' : 'y'}
            </span>

            <button onClick={expandAll} className="text-xs text-[#1B4F8A] hover:underline">Expand all</button>
            <button onClick={collapseAll} className="text-xs text-gray-500 hover:underline">Collapse all</button>
          </div>
        </div>

        {/* Tree */}
        {catsLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#1B4F8A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {displayDepts.map((dept) => {
              const cats = catsByDept.get(dept.id) ?? [];
              if (cats.length === 0) return null;
              return (
                <div key={dept.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Department header */}
                  <div className="px-4 py-2.5 bg-[#1B4F8A]/5 border-b border-gray-200 flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">{dept.code}</span>
                    <span className="font-semibold text-gray-800 text-sm">{dept.name}</span>
                    <span className="ml-auto text-xs text-gray-400">
                      {cats.length} categor{cats.length !== 1 ? 'ies' : 'y'}
                    </span>
                  </div>

                  {/* Categories */}
                  {cats.map((cat, ci) => {
                    const subs = subsByParent.get(cat.id) ?? [];
                    const isExpanded = expandedCats.has(cat.id);

                    return (
                      <div key={cat.id} className={ci > 0 ? 'border-t border-gray-100' : ''}>
                        {/* Category row */}
                        <div
                          className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/60 hover:bg-gray-100/60 cursor-pointer select-none"
                          onClick={() => toggleCat(cat.id)}
                        >
                          <ChevronRight
                            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                          />
                          <span className="text-xs font-mono text-gray-400 w-28 shrink-0">{cat.code}</span>
                          <span className="font-medium text-gray-800 text-sm flex-1">{cat.name}</span>
                          <span className="text-xs text-gray-400 shrink-0">
                            {subs.length} sub-cat{subs.length !== 1 ? 's' : ''}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); openAddSub(cat); }}
                            className="flex items-center gap-1 text-xs text-[#1B4F8A] hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors shrink-0"
                          >
                            <Plus className="w-3 h-3" />
                            Add Sub
                          </button>
                        </div>

                        {/* Subcategory rows */}
                        {isExpanded && (
                          <div>
                            {subs.length === 0 ? (
                              <p className="pl-14 pr-4 py-3 text-xs text-gray-400 italic border-t border-gray-50">
                                No subcategories yet.
                              </p>
                            ) : (
                              subs.map((sub) => {
                                const isGen = sub.code.endsWith('_GEN');
                                const hasProds = sub._count.products > 0;
                                const canEdit = !isGen;
                                const canDelete = !isGen && !hasProds;

                                return (
                                  <div
                                    key={sub.id}
                                    className="flex items-center gap-2 pl-14 pr-4 py-2 border-t border-gray-50 hover:bg-blue-50/20"
                                  >
                                    <span className="text-xs font-mono text-gray-300 w-28 shrink-0">{sub.code}</span>
                                    <span className={`text-sm flex-1 ${isGen ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                                      {sub.name}
                                      {isGen && (
                                        <span className="ml-1.5 text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full font-medium">
                                          system
                                        </span>
                                      )}
                                    </span>

                                    {!sub.isActive && (
                                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full shrink-0">
                                        Inactive
                                      </span>
                                    )}

                                    <span className={`text-xs w-20 text-right shrink-0 ${hasProds ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                                      {sub._count.products} prod{sub._count.products !== 1 ? 's' : ''}
                                    </span>

                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button
                                        onClick={() => openEditSub(sub)}
                                        disabled={!canEdit}
                                        title={isGen ? 'System fallback — cannot rename' : 'Edit'}
                                        className="p-1.5 text-gray-400 hover:text-[#1B4F8A] hover:bg-blue-50 rounded transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => deleteSub(sub)}
                                        disabled={!canDelete}
                                        title={
                                          isGen ? 'System fallback — cannot delete'
                                            : hasProds ? `${sub._count.products} products assigned`
                                            : 'Delete'
                                        }
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {categories.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400 text-sm">
                No categories found.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Side panel — Add / Edit subcategory */}
      {showPanel && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={closePanel} />
          <div className="w-80 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">
                {panelMode === 'add-sub' ? 'Add Subcategory' : 'Edit Subcategory'}
              </h2>
              <button onClick={closePanel} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {panelMode === 'add-sub' && panelCat && (
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-800">
                  Adding to <span className="font-mono font-semibold">{panelCat.code}</span> — {panelCat.name}
                </div>
              )}

              {panelMode === 'edit-sub' && panelSub && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 font-mono">
                  {panelSub.code}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && saveSub()}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  placeholder="e.g. Basmati Rice"
                  autoFocus
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

              {panelMode === 'edit-sub' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sub-active"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="sub-active" className="text-sm text-gray-700">Active</label>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={closePanel}
                className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveSub}
                disabled={saving}
                className="flex-1 py-2 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163f6e] disabled:opacity-50 font-semibold"
              >
                {saving ? 'Saving...' : panelMode === 'add-sub' ? 'Add' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
