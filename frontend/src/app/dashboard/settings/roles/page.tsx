'use client';

import Header from '@/components/layout/Header';
import { Check, Minus, Shield } from 'lucide-react';

const ROLES = [
  { key: 'SUPER_ADMIN',      short: 'SA',  label: 'Super Admin',       color: 'bg-purple-600' },
  { key: 'BRANCH_MANAGER',   short: 'BM',  label: 'Branch Manager',    color: 'bg-blue-600' },
  { key: 'CASHIER',          short: 'CSH', label: 'Cashier',           color: 'bg-green-600' },
  { key: 'PURCHASE_CHECKER', short: 'PC',  label: 'Purchase Checker',  color: 'bg-orange-500' },
  { key: 'ACCOUNTS_PERSON',  short: 'ACC', label: 'Accounts',          color: 'bg-cyan-600' },
  { key: 'FLOOR_SUPERVISOR', short: 'FS',  label: 'Floor Supervisor',  color: 'bg-teal-600' },
  { key: 'PACKING_STAFF',    short: 'PKG', label: 'Packing Staff',     color: 'bg-lime-600' },
  { key: 'SALES_REP',        short: 'SR',  label: 'Sales Rep',         color: 'bg-yellow-600' },
  { key: 'VIEWER',           short: 'VW',  label: 'Viewer',            color: 'bg-gray-500' },
  { key: 'CA',               short: 'CA',  label: 'CA / Auditor',      color: 'bg-amber-700' },
] as const;

type RoleKey = typeof ROLES[number]['key'];

interface Feature {
  label: string;
  roles: RoleKey[];
}
interface Section {
  section: string;
  items: Feature[];
}

const PERMISSIONS: Section[] = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard',       roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CASHIER', 'PURCHASE_CHECKER', 'ACCOUNTS_PERSON', 'FLOOR_SUPERVISOR', 'PACKING_STAFF', 'SALES_REP', 'VIEWER'] },
    ],
  },
  {
    section: 'Sales',
    items: [
      { label: 'POS / New Sale',  roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FLOOR_SUPERVISOR', 'SALES_REP'] },
      { label: 'Bills',           roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FLOOR_SUPERVISOR', 'SALES_REP'] },
      { label: 'Estimates',       roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { label: 'Shifts',          roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { label: 'Day Closure',     roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { label: 'Online Orders',   roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FLOOR_SUPERVISOR', 'ACCOUNTS_PERSON'] },
    ],
  },
  {
    section: 'Inventory',
    items: [
      { label: 'Products',        roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER', 'PACKING_STAFF'] },
      { label: 'PLU Management',  roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { label: 'Online Visibility', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { label: 'Categories',      roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { label: 'HSN Codes',       roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { label: 'Stock-take',      roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER', 'FLOOR_SUPERVISOR'] },
      { label: 'GRN',             roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER'] },
      { label: 'Purchase Orders', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER'] },
      { label: 'Print Labels',    roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER', 'PACKING_STAFF', 'FLOOR_SUPERVISOR'] },
      { label: 'Reorder Guide',   roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER'] },
      { label: 'Break Bulk',      roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FLOOR_SUPERVISOR', 'PURCHASE_CHECKER'] },
      { label: 'Expiry Tracker',  roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER', 'FLOOR_SUPERVISOR'] },
      { label: 'Volume Pricing',  roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
    ],
  },
  {
    section: 'People',
    items: [
      { label: 'Customers',        roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON', 'SALES_REP', 'CASHIER', 'FLOOR_SUPERVISOR'] },
      { label: 'Suppliers',        roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'] },
      { label: 'Supplier Payments',roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'] },
      { label: 'Expenses',         roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'] },
      { label: 'Bank & Accounts',  roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'] },
      { label: 'Staff',            roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
    ],
  },
  {
    section: 'Reports',
    items: [
      { label: 'Reports',            roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'VIEWER'] },
      { label: 'Activity Log',       roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'] },
      { label: 'GST Health',         roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON', 'CA'] },
      { label: 'GST Reports',        roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON', 'CA'] },
      { label: 'GST Reconciliation', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON', 'CA'] },
      { label: 'CA Export',          roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON', 'CA'] },
      { label: 'Year Comparison',    roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'] },
      { label: 'Payables Aging',     roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'] },
      { label: 'Historical Bills',   roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
    ],
  },
  {
    section: 'Settings',
    items: [
      { label: 'Business',         roles: ['SUPER_ADMIN'] },
      { label: 'Settings',         roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { label: 'Financial Years',  roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'] },
      { label: 'WhatsApp Msgs',    roles: ['SUPER_ADMIN'] },
      { label: 'Role Permissions', roles: ['SUPER_ADMIN'] },
    ],
  },
];

export default function RolesPage() {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header title="Role Permissions" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[1100px] mx-auto">

          {/* Header card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">What each role can access</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Read-only overview of permissions. To change what a role can do, update the sidebar roles config and backend <code className="bg-gray-100 px-1 rounded text-xs">@Roles()</code> decorators.
              </p>
            </div>
          </div>

          {/* Role legend */}
          <div className="flex flex-wrap gap-2 mb-5">
            {ROLES.map(r => (
              <span key={r.key} className={`${r.color} text-white text-xs font-semibold px-2.5 py-1 rounded-full`}>
                {r.short} — {r.label}
              </span>
            ))}
          </div>

          {/* Permissions table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 min-w-[180px] sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
                      Feature
                    </th>
                    {ROLES.map(r => (
                      <th key={r.key} className="px-2 py-3 text-center min-w-[48px]">
                        <span
                          title={r.label}
                          className={`${r.color} text-white text-[10px] font-bold px-1.5 py-0.5 rounded cursor-default`}
                        >
                          {r.short}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((section) => (
                    <>
                      <tr key={`sec-${section.section}`} className="bg-blue-50 border-y border-blue-100">
                        <td
                          colSpan={ROLES.length + 1}
                          className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-blue-700 sticky left-0"
                        >
                          {section.section}
                        </td>
                      </tr>
                      {section.items.map((item, i) => (
                        <tr
                          key={`${section.section}-${item.label}`}
                          className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30 transition-colors`}
                        >
                          <td className={`px-4 py-2.5 text-gray-800 font-medium sticky left-0 border-r border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30`}>
                            {item.label}
                          </td>
                          {ROLES.map(r => {
                            const allowed = (item.roles as readonly string[]).includes(r.key);
                            return (
                              <td key={r.key} className="px-2 py-2.5 text-center">
                                {allowed ? (
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100">
                                    <Check className="w-3 h-3 text-green-600 stroke-[2.5]" />
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center w-5 h-5">
                                    <Minus className="w-3 h-3 text-gray-300" />
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer note */}
          <p className="text-xs text-gray-400 mt-4 text-center">
            Adding a new role to <code className="bg-gray-100 px-1 rounded">schema.prisma</code> automatically makes it valid in the user creation form — no DTO changes needed.
          </p>
        </div>
      </div>
    </div>
  );
}
