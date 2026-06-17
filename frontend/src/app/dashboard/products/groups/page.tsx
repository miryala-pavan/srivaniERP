'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Wand2, ChevronDown, ChevronUp, X } from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface GroupMember {
  id: string;
  displayLabel: string;
  sortOrder: number;
  product: { id: string; productCode: string; name: string; imageUrl: string | null; totalStock: number };
}
interface ProductGroup {
  id: string;
  name: string;
  members: GroupMember[];
}
interface Suggestion {
  groupName: string;
  members: { productId: string; productCode: string; name: string; suggestedLabel: string }[];
}

export default function ProductGroupsPage() {
  const qc = useQueryClient();

  const { data: groups = [], isLoading } = useQuery<ProductGroup[]>({
    queryKey: ['product-groups'],
    queryFn:  () => api.get('/product-groups').then(r => r.data),
  });

  const { data: suggestions, isFetching: detectingAuto, refetch: runAutoDetect } = useQuery<Suggestion[]>({
    queryKey: ['product-groups-auto'],
    queryFn:  () => api.get('/product-groups/auto-detect').then(r => r.data),
    enabled:  false,
  });

  const deleteMember = useMutation({
    mutationFn: (memberId: string) => api.delete(`/product-groups/members/${memberId}`),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['product-groups'] }); toast.success('Removed'); },
    onError:    () => toast.error('Failed to remove'),
  });

  const deleteGroup = useMutation({
    mutationFn: (groupId: string) => api.delete(`/product-groups/${groupId}`),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['product-groups'] }); toast.success('Group deleted'); },
    onError:    () => toast.error('Failed to delete group'),
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingGroup, setConfirmingGroups] = useState<{ [k: string]: boolean }>({});

  async function acceptSuggestion(s: Suggestion) {
    try {
      await api.post('/product-groups', {
        name:    s.groupName,
        members: s.members.map(m => ({ productId: m.productId, displayLabel: m.suggestedLabel })),
      });
      qc.invalidateQueries({ queryKey: ['product-groups'] });
      qc.invalidateQueries({ queryKey: ['product-groups-auto'] });
      toast.success(`Group "${s.groupName}" created`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Product Groups" />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Auto-detect panel */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-purple-500" /> Auto-detect Suggestions
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Scans online products for common name patterns (e.g. "Coconut Oil 200ml", "Coconut Oil 500ml")</p>
            </div>
            <button
              onClick={() => runAutoDetect()}
              disabled={detectingAuto}
              className="px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg disabled:opacity-60 hover:bg-purple-700"
            >
              {detectingAuto ? 'Scanning…' : 'Scan Now'}
            </button>
          </div>

          {suggestions && suggestions.length === 0 && (
            <p className="text-xs text-gray-400">No new groups detected — all matching products are already grouped or none found.</p>
          )}

          {suggestions && suggestions.map((s, i) => (
            <div key={i} className="border border-purple-100 rounded-xl bg-purple-50/40 p-4 mb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{s.groupName}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {s.members.map(m => (
                      <span key={m.productId} className="text-xs bg-white border border-purple-200 text-purple-700 rounded-lg px-2 py-1">
                        {m.suggestedLabel} — <span className="text-gray-500">{m.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => acceptSuggestion(s)}
                  className="shrink-0 px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Create Group
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Existing groups */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Existing Groups ({groups.length})</h2>

          {isLoading && <p className="text-xs text-gray-400">Loading…</p>}
          {!isLoading && groups.length === 0 && (
            <p className="text-xs text-gray-400">No groups yet. Use Auto-detect or create one manually.</p>
          )}

          <div className="space-y-3">
            {groups.map(g => (
              <div key={g.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedId === g.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    <span className="text-sm font-medium text-gray-800">{g.name}</span>
                    <span className="text-xs text-gray-400">{g.members.length} variants</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!confirm(`Delete group "${g.name}"? Products won't be affected.`)) return;
                      deleteGroup.mutate(g.id);
                    }}
                    className="text-red-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {expandedId === g.id && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                    {g.members.map(m => (
                      <div key={m.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-xs font-medium text-[#1B4F8A] bg-blue-50 border border-blue-100 rounded px-2 py-0.5 w-20 text-center shrink-0">
                          {m.displayLabel}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{m.product.name}</p>
                          <p className="text-[11px] text-gray-400 font-mono">{m.product.productCode}</p>
                        </div>
                        <span className="text-[11px] text-gray-400 shrink-0">Stock: {Number(m.product.totalStock).toFixed(0)}</span>
                        <button
                          onClick={() => deleteMember.mutate(m.id)}
                          className="text-red-400 hover:text-red-600 p-0.5 shrink-0"
                          title="Remove from group"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
