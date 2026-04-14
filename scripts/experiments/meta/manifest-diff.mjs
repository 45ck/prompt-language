// manifest-diff.mjs — compare two manifests produced by compute-manifest.mjs.

import { isProtectedPath } from './compute-manifest.mjs';

/**
 * Diff two manifests.
 * Returns { added, removed, changed, protectedChanged }.
 * Each list entry is a relative POSIX path.
 */
export function diffManifests(pre, post) {
  const added = [];
  const removed = [];
  const changed = [];
  const preKeys = new Set(Object.keys(pre));
  const postKeys = new Set(Object.keys(post));
  for (const k of postKeys) {
    if (!preKeys.has(k)) {
      added.push(k);
    } else if (pre[k] !== post[k]) {
      changed.push(k);
    }
  }
  for (const k of preKeys) {
    if (!postKeys.has(k)) removed.push(k);
  }
  const protectedChanged = [...added, ...removed, ...changed].filter(isProtectedPath);
  added.sort();
  removed.sort();
  changed.sort();
  protectedChanged.sort();
  return { added, removed, changed, protectedChanged };
}
