export interface PlateResult {
  perSide: { plate: number; count: number }[];
  totalWeight: number;
  remainder: number;
}

export function calculatePlates(
  targetWeight: number,
  barWeight: number = 45,
  availablePlates: number[] = [45, 35, 25, 10, 5, 2.5],
): PlateResult {
  const sorted = [...availablePlates].sort((a, b) => b - a);
  let remaining = (targetWeight - barWeight) / 2;
  const perSide: { plate: number; count: number }[] = [];

  for (const plate of sorted) {
    if (remaining >= plate) {
      const count = Math.floor(remaining / plate);
      perSide.push({ plate, count });
      remaining -= plate * count;
    }
  }

  const loadedPerSide = perSide.reduce((sum, p) => sum + p.plate * p.count, 0);
  const totalWeight = loadedPerSide * 2 + barWeight;

  return {
    perSide,
    totalWeight,
    remainder: targetWeight - totalWeight,
  };
}

export function formatPlates(result: PlateResult): string {
  if (result.perSide.length === 0) return 'Bar only';
  return result.perSide
    .map((p) => (p.count > 1 ? `${p.count}×${p.plate}` : `${p.plate}`))
    .join(' + ');
}
