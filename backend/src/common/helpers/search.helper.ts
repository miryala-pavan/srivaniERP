/**
 * Wildcard search helper
 * Converts user-facing * wildcard to Prisma filter conditions.
 *
 * Rules:
 *   *term   → endsWith 'term'
 *   term*   → startsWith 'term'
 *   *term*  → contains 'term'
 *   a*b     → startsWith 'a' (fallback for mid-wildcard; use rawLike for exact)
 *   no *    → contains 'term' (unchanged behaviour)
 */

type PrismaStringFilter = {
  contains?:   string;
  startsWith?: string;
  endsWith?:   string;
  mode?:       'insensitive';
};

export function wildcardFilter(term: string): PrismaStringFilter {
  const mode = 'insensitive' as const;

  if (!term || !term.includes('*')) {
    return { contains: term, mode };
  }

  const startsWithStar = term.startsWith('*');
  const endsWithStar   = term.endsWith('*');
  const inner          = term.replace(/^\*+|\*+$/g, ''); // strip leading/trailing *
  const hasMidStar     = inner.includes('*');

  // *term* or ** → contains inner
  if (startsWithStar && endsWithStar) {
    return { contains: inner.replace(/\*/g, ''), mode };
  }

  // *term → endsWith
  if (startsWithStar && !hasMidStar) {
    return { endsWith: inner, mode };
  }

  // term* → startsWith
  if (endsWithStar && !hasMidStar) {
    return { startsWith: inner, mode };
  }

  // a*b → startsWith 'a' (Prisma can't do mid-wildcard natively)
  const firstPart = term.split('*')[0];
  return { startsWith: firstPart, mode };
}

/**
 * Convert * wildcard to SQL % for use in raw ILIKE queries.
 * If no * present, wraps with % for contains behaviour.
 *
 * Always adds a trailing % so partial matches work correctly.
 * Example: 'mt* s' → 'mt% s%'  (finds "MTR SAMBAR POWDER", not just strings ending in " s")
 * Example: 'mt*'   → 'mt%'     (starts with mt — trailing % already present)
 * Example: '*oil'  → '%oil%'   (contains oil)
 * Example: 'sun*oil' → 'sun%oil%' (starts with sun, has oil somewhere)
 */
export function toSqlLike(term: string): string {
  if (!term) return '%';
  if (term.includes('*')) {
    const pattern = term.replace(/\*/g, '%').toLowerCase();
    // Add trailing % so the pattern doesn't require an exact end-of-string match
    return pattern.endsWith('%') ? pattern : pattern + '%';
  }
  return `%${term.toLowerCase()}%`;
}

/** True if search term contains a wildcard */
export function hasWildcard(term: string): boolean {
  return term.includes('*');
}
