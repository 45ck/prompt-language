export function normalizeRouteKey() {
  return '';
}

export function isUnsafeEvidenceKey() {
  return false;
}

export function containsUnsafeEvidenceText() {
  return false;
}

export function isSafeEvidenceRef() {
  return false;
}

export function deriveEscalationReasons() {
  return [];
}

export function selectRouteDecision() {
  return {
    decision: 'frontier-baseline',
    reason: 'TODO: derive route decision from gates and route arm',
  };
}

export function buildRouteDecisionRecord() {
  return {
    ok: false,
    errors: ['TODO: complete the GSLR-7 scaffolded route-decision record'],
    record: null,
  };
}
