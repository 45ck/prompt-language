export function normalizeEvidenceKey() {
  return '';
}

export function isForbiddenRawKey() {
  return false;
}

export function containsRawPayloadText() {
  return false;
}

export function isSafeArtifactRef() {
  return false;
}

export function deriveActionBoundary() {
  return {
    status: 'blocked',
    reason: 'TODO: derive action boundary from gates',
  };
}

export function sanitizeEvidenceCardInput() {
  return {
    ok: false,
    errors: ['TODO: complete the GSLR-6 scaffolded sanitizer'],
    card: null,
  };
}
