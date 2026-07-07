export function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!ts || Number.isNaN(ts)) return '—';
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatTrendBadge(value: number | null, invert = false): { label: string; className: string } | null {
  if (value === null || Number.isNaN(value)) return null;
  const effective = invert ? -value : value;
  if (effective > 0) {
    return { label: `↗ ${Math.abs(value)}%`, className: 'text-[#137333]' };
  }
  if (effective < 0) {
    return { label: `↘ ${Math.abs(value)}%`, className: 'text-[#D93025]' };
  }
  return { label: '— 0%', className: 'text-[#80868B]' };
}
