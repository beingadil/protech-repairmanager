/** Formats a counter value as a job token, e.g. 1006 -> TK-1006. */
export function formatTokenNumber(counter: number): string {
  const safe = Number.isFinite(counter) ? Math.max(0, Math.floor(counter)) : 0;
  return `TK-${safe.toString().padStart(4, '0')}`;
}
