/**
 * fuzzy-match — simple fuzzy matching for gate predicates.
 *
 * Pure domain logic with zero external deps.
 * Uses Levenshtein edit distance to find the closest known predicate.
 */

const KNOWN_PREDICATES: readonly string[] = [
  'tests_pass',
  'tests_fail',
  'lint_pass',
  'lint_fail',
  'diff_nonempty',
  'file_exists',
  'pytest_pass',
  'pytest_fail',
  'go_test_pass',
  'go_test_fail',
  'cargo_test_pass',
  'cargo_test_fail',
];

/** Maximum edit distance to consider a match. */
const MAX_DISTANCE = 2;

/**
 * Find the most similar known predicate within edit distance 2.
 * Returns null if no close match exists.
 */
export function findSimilarPredicate(input: string): string | null {
  // Strip "not " prefix for matching, if present
  const bare = input.startsWith('not ') ? input.slice(4).trim() : input;
  if (bare.length === 0) return null;

  let best: string | null = null;
  let bestDist = MAX_DISTANCE + 1;

  for (const known of KNOWN_PREDICATES) {
    if (known === bare) return null; // exact match is not "unknown"
    const dist = levenshtein(known, bare);
    if (dist < bestDist) {
      bestDist = dist;
      best = known;
    }
  }

  return bestDist <= MAX_DISTANCE ? best : null;
}

/**
 * Levenshtein edit distance (insertions, deletions, substitutions).
 * O(n*m) but inputs are short predicate names so this is fine.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Early exit for large length differences
  if (Math.abs(m - n) > MAX_DISTANCE) return MAX_DISTANCE + 1;

  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j]! + 1, // deletion
        curr[j - 1]! + 1, // insertion
        prev[j - 1]! + cost, // substitution
      );
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]!;
  }

  return prev[n]!;
}
