export function formatWeight(weight: number): string {
  if (weight % 1 === 0) return String(weight);
  return weight.toFixed(1);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
