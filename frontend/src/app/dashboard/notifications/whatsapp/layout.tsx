import type { Metadata } from 'next';

// Overrides the root ERP manifest with a WhatsApp-only one, scoped to this
// route, so the browser offers to install PaVa Connect as its own separate
// desktop app — distinct from installing the full ERP.
export const metadata: Metadata = {
  title: 'PaVa Connect',
  manifest: '/manifest-whatsapp.json',
};

export default function WhatsAppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
