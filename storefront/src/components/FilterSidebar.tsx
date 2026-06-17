'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useCallback } from 'react';
import type { ShopDepartment, SortOption } from '@/lib/shop';

const SORT_LABELS: Record<string, string> = {
  nameAsc:   'Name A–Z',
  priceAsc:  'Price: Low to High',
  priceDesc: 'Price: High to Low',
  savings:   'Best Savings',
};

interface Props {
  departments: ShopDepartment[];
  total: number;
  currentDept: string;
  currentSort: SortOption;
  currentInStock: boolean;
}

export default function FilterSidebar({
  departments,
  total,
  currentDept,
  currentSort,
  currentInStock,
}: Props) {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navigate = useCallback((updates: Record<string, string | undefined>) => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('page'); // reset to page 1 on filter change
    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined || val === '' || val === 'false') p.delete(key);
      else p.set(key, val);
    }
    router.push(`/products?${p.toString()}`);
    setDrawerOpen(false);
  }, [router, searchParams]);

  const hasFilters = !!(currentDept || currentSort !== 'nameAsc' || currentInStock);

  const FilterContent = () => (
    <>
      {/* Sort */}
      <div className="sidebar-section">
        <p className="sidebar-label">Sort by</p>
        <select
          className="sidebar-select"
          value={currentSort}
          onChange={e => navigate({ sort: e.target.value === 'nameAsc' ? undefined : e.target.value })}
        >
          {Object.entries(SORT_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* In Stock toggle */}
      <div className="sidebar-section">
        <label className="sidebar-toggle">
          <input
            type="checkbox"
            checked={currentInStock}
            onChange={e => navigate({ inStock: e.target.checked ? 'true' : undefined })}
          />
          In Stock Only
        </label>
      </div>

      {/* Department filter */}
      <div className="sidebar-section">
        <p className="sidebar-label">Department</p>
        <div className="dept-list">
          {departments.map(dept => {
            const active = currentDept === dept.code;
            return (
              <label
                key={dept.code}
                className={`dept-item${active ? ' active' : ''}`}
                onClick={() => navigate({ dept: active ? undefined : dept.code })}
              >
                <input
                  type="checkbox"
                  readOnly
                  checked={active}
                  style={{ pointerEvents: 'none' }}
                />
                <span style={{ flex: 1 }}>{dept.name}</span>
                <span className="dept-count">{dept.productCount.toLocaleString()}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Clear filters */}
      {hasFilters && (
        <button
          className="clear-filters"
          onClick={() => navigate({ dept: undefined, sort: undefined, inStock: undefined })}
        >
          Clear all filters
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="browse-sidebar">
        <p className="sidebar-head">All Products</p>
        <p className="sidebar-count">{total.toLocaleString()} products</p>
        <FilterContent />
      </aside>

      {/* Mobile filter button */}
      <button
        className="mobile-filter-btn"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open filters"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="14" y2="12" />
          <line x1="4" y1="18" x2="10" y2="18" />
        </svg>
        Filters{hasFilters ? ' •' : ''}
      </button>

      {/* Mobile drawer */}
      <div
        className={`filter-drawer-overlay${drawerOpen ? ' open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />
      <div className={`filter-drawer${drawerOpen ? ' open' : ''}`}>
        <div className="drawer-handle" />
        <FilterContent />
      </div>
    </>
  );
}
