export const CLOSENESS: Record<string, number> = {
  Family: 160,
  "Close Friend": 230,
  "Work-Friend": 360,
  "Business Contact": 480,
  Acquaintance: 580,
  None: 750,
};

export function computeRecency(mostRecent: string | null): number {
  if (!mostRecent) return 0.15;
  const daysSince =
    (Date.now() - new Date(mostRecent).getTime()) / (1000 * 60 * 60 * 24);
  // Stepped decay with clear drops at each threshold:
  // ≤1 day:  full bright (1.0)
  // 1d→1w:   0.90 → 0.65  (still quite visible)
  // 1w→1mo:  0.65 → 0.40  (noticeably faded)
  // 1mo→1yr: 0.40 → 0.20  (dim but visible)
  // >1yr:    0.15          (very dim, still there)
  if (daysSince <= 1) return 1.0;
  if (daysSince <= 7) return 0.90 - ((daysSince - 1) / 6) * 0.25;
  if (daysSince <= 30) return 0.65 - ((daysSince - 7) / 23) * 0.25;
  if (daysSince <= 365) return 0.40 - ((daysSince - 30) / 335) * 0.20;
  return 0.15;
}

export function lineColor(
  _isMutual: boolean,
  isLinkedUser: boolean,
  recency: number,
  isSecondDegree?: boolean,
  isCrossLink?: boolean
): string {
  // Cross-links: linked user -> my non-linked contact (red, like linked connections)
  if (isCrossLink) {
    return `rgba(220, 80, 80, ${Math.max(recency, 0.4)})`;
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
