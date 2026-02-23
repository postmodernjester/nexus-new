// ─── Similarity Engine ───────────────────────────────────────
// Scores how similar two nodes are based on companies (with time
// overlap), shared skills, education, location, interests, and tags.
// Used to create invisible attraction links in the force simulation
// so semantically similar people cluster together.

export interface NodeProfile {
  companies: { name: string; start?: string; end?: string | null }[];
  skills: string[];
  education: { institution: string; field?: string }[];
  location?: string;
  interests: string[];
  tags: string[];
}

// ─── Helpers ─────────────────────────────────────────────────

const CORP_SUFFIXES = /\b(inc|llc|ltd|corp|co|gmbh|plc|ag|sa|srl|pvt|private|limited|corporation|incorporated|company|group|holdings)\b\.?/gi;

function norm(s: string): string {
  return s.toLowerCase().trim().replace(CORP_SUFFIXES, "").replace(/[.,]/g, "").trim();
}

/** Convert YYYY-MM date string to months since epoch for overlap calc */
function toMonths(d: string | undefined | null): number {
  if (!d) return 30000; // treat null as "still ongoing" (far future)
  const [y, m] = d.split("-").map(Number);
  return y * 12 + (m || 1);
}

function hasTimeOverlap(
  a: { start?: string; end?: string | null },
  b: { start?: string; end?: string | null }
): boolean {
  // If neither has a start, can't determine — assume mild overlap
  if (!a.start && !b.start) return true;
  const aS = a.start ? toMonths(a.start) : 0;
  const aE = toMonths(a.end);
  const bS = b.start ? toMonths(b.start) : 0;
  const bE = toMonths(b.end);
  return aS < bE && bS < aE;
}

function normIntersection(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b.map(norm));
  let count = 0;
  for (const s of a) {
    if (setB.has(norm(s))) count++;
  }
  return count;
}

// ─── Main scoring function ───────────────────────────────────

export function computeSimilarity(a: NodeProfile, b: NodeProfile): number {
  let score = 0;

  // 1. Company matching — strongest signal
  //    Same company + overlapping time = 0.6
  //    Same company, no overlap = 0.2
  const scoredCompanies = new Set<string>();
  for (const ac of a.companies) {
    const nA = norm(ac.name);
    if (!nA) continue;
    for (const bc of b.companies) {
      const nB = norm(bc.name);
      if (!nB || nA !== nB) continue;
      if (scoredCompanies.has(nA)) continue;
      scoredCompanies.add(nA);
      score += hasTimeOverlap(ac, bc) ? 0.6 : 0.2;
    }
  }

  // 2. Shared skills — each worth 0.08, cap 0.4
  score += Math.min(normIntersection(a.skills, b.skills) * 0.08, 0.4);

  // 3. Same institution — 0.25 each, plus 0.1 if same field
  const scoredInst = new Set<string>();
  for (const ae of a.education) {
    const nA = norm(ae.institution);
    if (!nA) continue;
    for (const be of b.education) {
      const nB = norm(be.institution);
      if (!nB || nA !== nB) continue;
      if (scoredInst.has(nA)) continue;
      scoredInst.add(nA);
      score += 0.25;
      if (ae.field && be.field && norm(ae.field) === norm(be.field)) {
        score += 0.1;
      }
    }
  }

  // 4. Same location — 0.08 (fuzzy: either contains the other)
  if (a.location && b.location) {
    const lA = norm(a.location);
    const lB = norm(b.location);
    if (lA && lB && (lA === lB || lA.includes(lB) || lB.includes(lA))) {
      score += 0.08;
    }
  }

  // 5. Shared interests — each 0.06, cap 0.2
  score += Math.min(normIntersection(a.interests, b.interests) * 0.06, 0.2);

  // 6. Shared tags — each 0.05, cap 0.15
  score += Math.min(normIntersection(a.tags, b.tags) * 0.05, 0.15);

  return Math.min(score, 1.0);
}

// ─── Convert score to force-link parameters ──────────────────

export function similarityToLink(
  score: number
): { distance: number; strength: number } | null {
  if (score < 0.15) return null; // too weak — no link
  return {
    distance: Math.max(50, Math.round(250 * (1 - score))),
    strength: 0.02 + score * 0.06,
  };
}
