const TINTS = [
  'bg-green-100 text-green-700',
  'bg-indigo-100 text-indigo-700',
  'bg-amber-100 text-amber-700',
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const SIZE_CLS: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-xs',
  lg: 'w-14 h-14 text-lg',
};

export function Avatar({ seed, size = 'md' }: { seed: string; size?: 'sm' | 'md' | 'lg' }) {
  const tint = TINTS[hashString(seed) % TINTS.length];
  const letter = seed.trim().slice(0, 1).toUpperCase() || '?';
  return (
    <div className={`${SIZE_CLS[size]} rounded-full ${tint} flex items-center justify-center font-bold shrink-0`}>
      {letter}
    </div>
  );
}
