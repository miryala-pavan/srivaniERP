export function OptInBadge({ on }: { on: boolean }) {
  return on
    ? <span className="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-50 text-green-700">Opted in</span>
    : <span className="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-400">Not opted in</span>;
}
