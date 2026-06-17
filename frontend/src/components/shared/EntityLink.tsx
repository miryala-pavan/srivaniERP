'use client';
import Link from 'next/link';

const ROUTES: Record<string, string> = {
  product:      '/dashboard/products',
  supplier:     '/dashboard/suppliers',
  customer:     '/dashboard/customers',
  grn:          '/dashboard/grn',
  bill:         '/dashboard/bills',
  payment:      '/dashboard/payments',
  'credit-note': '/dashboard/credit-notes',
  user:         '/dashboard/users',
  category:     '/dashboard/categories',
};

export function EntityLink({
  type, id, children, className = '',
}: {
  type: keyof typeof ROUTES;
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const base = ROUTES[type];
  if (!base) {
    console.warn(`EntityLink: unknown type "${type}"`);
    return <span>{children}</span>;
  }
  return (
    <Link href={`${base}/${id}`} className={`text-blue-600 hover:underline ${className}`}>
      {children}
    </Link>
  );
}
