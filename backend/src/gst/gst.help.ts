import { ModuleHelp } from '../platform/help/help.interface';

export const GST_HELP: ModuleHelp = {
  module: 'gst',
  title: 'GST Module',
  phase: 'Phase 1',
  description:
    'Manages GST compliance: Input Tax Credit tracking, GSTR-1 (outward supplies), ' +
    'GSTR-3B (liability vs ITC), challan payments, and JSON export for portal filing. ' +
    'All GST rates are computed via the Rule Engine — no hardcoded rates.',
  caNote:
    'GSTR-1 due by 11th; GSTR-3B due by 20th of following month. ' +
    'Ensure all purchase invoices are entered before computing GSTR-3B to capture full ITC.',
  endpoints: [
    {
      method: 'POST',
      path: '/api/gst/compute/:period',
      summary: 'Compute GSTR-1 and GSTR-3B for a given tax period (YYYY-MM)',
      example: { period: '2025-07' },
    },
    {
      method: 'GET',
      path: '/api/gst/returns',
      summary: 'List all GST returns with their status (DRAFT / COMPUTED / FILED)',
    },
    {
      method: 'GET',
      path: '/api/gst/returns/:id',
      summary: 'Get a specific GST return with full breakdown',
    },
    {
      method: 'GET',
      path: '/api/gst/returns/:id/export/json',
      summary: 'Export GSTR-1 or GSTR-3B as GSTN-compatible JSON for portal upload',
    },
    {
      method: 'GET',
      path: '/api/gst/itc-ledger',
      summary: 'View ITC ledger — all input tax credits by tax period',
    },
    {
      method: 'POST',
      path: '/api/gst/challans',
      summary: 'Record a GST challan payment (CGST / SGST / IGST + interest/late fee)',
    },
    {
      method: 'GET',
      path: '/api/gst/challans',
      summary: 'List all GST challans',
    },
    {
      method: 'GET',
      path: '/api/gst/summary',
      summary: 'GST dashboard: liability, ITC balance, net payable, pending returns',
    },
    {
      method: 'POST',
      path: '/api/gst/returns/:id/file',
      summary: 'Mark a return as FILED (manual; GSTN API integration is feature-ready)',
      comingSoon: false,
    },
    {
      method: 'GET',
      path: '/api/gst/gstin/validate/:gstin',
      summary: 'Validate GSTIN format. API verification stub — live check coming in Phase 2',
      comingSoon: false,
    },
  ],
  guides: [
    'GST Monthly Workflow: Enter sales/purchases → Compute (11th) → Verify ITC → Pay challan → File GSTR-3B (20th)',
    'GSTR-1 vs GSTR-3B: GSTR-1 = what you sold. GSTR-3B = net liability after ITC.',
    'ITC Rules: ITC available only on business purchases. Blocked credits: motor vehicles, personal use.',
  ],
};
