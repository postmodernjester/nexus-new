export const CLOSENESS: Record<string, number> = {
  Family: 60,
  "Close Friend": 90,
  "Work-Friend": 140,
  "Business Contact": 190,
  Acquaintance: 230,
  None: 300,
};

export function computeRecency(mostRecent: string | null): number {
  if (!mostRecent) return 0.25;
  const daysSince =
    (Date.now() - new Date(mostRecent).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 7) return 1.0;
  if (daysSince <= 30) return 1.0 - ((daysSince - 7) / 23) * 0.2;
  if (daysSince <= 365) return 0.8 - ((daysSince - 30) / 335) * 0.3;
  return Math.max(0.25, 0.5 - ((daysSince - 365) / 730) * 0.25);
}

export function lineColor(
  _isMutual: boolean,
  isLinkedUser: boolean,
  recency: number,
  isSecondDegree?: boolean,
  isCrossLink?: boolean
): string {
  // Cross-links: linked user -> my non-linked contact (amber, distinct)
  if (isCrossLink) {
    return "rgba(251, 146, 60, 0.6)";
  }
  // 2nd degree links: lighter grey so they don't vanish against dark bg
  if (isSecondDegree) {
    return "rgba(160, 180, 200, 0.5)";
  }
  // Linked user connections: red, alpha matches recency
  if (isLinkedUser) {
    return `rgba(220, 80, 80, ${recency})`;
  }
  // 1st degree: brighter slate, alpha matches recency
  return `rgba(160, 180, 200, ${recency})`;
}

export function lineThickness(count: number): number {
  if (count === 0) return 1.2;
  if (count <= 2) return 2;
  if (count <= 5) return 2.5;
  if (count <= 10) return 3.5;
  if (count <= 20) return 4.5;
  return 6;
}

export function nodeSize(count: number): number {
  return 8 + Math.min(count * 1.2, 16);
}
