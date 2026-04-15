/** Returns today's date as YYYY-MM-DD in the user's local timezone (not UTC). */
export function getLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatWeight(weight: number): string {
  if (weight % 1 === 0) return String(weight);
  return weight.toFixed(1);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
