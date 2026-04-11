/**
 * interpolate — Pure string interpolation for variable substitution.
 *
 * Replaces ${varName} tokens in a template string with values from a
 * variables record. Unknown variables are left as-is.
 *
 * **Security note:** `interpolate()` performs raw substitution and MUST NOT be
 * used to build shell commands from untrusted input. Use `shellInterpolate()`
 * for run-node commands — it shell-encodes substituted values, leaving only a
 * narrow safe unquoted subset untouched.
 */

import type { VariableStore, VariableValue } from './variable-value.js';
import { stringifyVariableValue } from './variable-value.js';

/** Maximum payload size (bytes) for JSON.parse in array index resolution. */
export const MAX_ARRAY_INDEX_PAYLOAD = 100_000;

/** Maximum number of elements allowed in a parsed array. */
const MAX_ARRAY_INDEX_ELEMENTS = 10_000;

/** Resolve an array index access on a JSON-array variable value. */
function resolveArrayIndex(value: VariableValue, indexStr: string): string | null {
  const serialized = stringifyVariableValue(value);
  if (serialized.length > MAX_ARRAY_INDEX_PAYLOAD) return null;
  let arr: unknown;
  try {
    arr = JSON.parse(serialized);
  } catch {
    return null;
  }
  if (!Array.isArray(arr)) return null;
  if (arr.length > MAX_ARRAY_INDEX_ELEMENTS) return null;
  let idx = parseInt(indexStr, 10);
  if (isNaN(idx)) return null;
  if (idx < 0) idx = arr.length + idx;
  if (idx < 0 || idx >= arr.length) return '';
  return String(arr[idx]);
}

export function interpolate(template: string, variables: VariableStore): string {
  // H#10: Support ${var:-default} syntax for default values.
  // H-LANG-004: Support ${var[index]} for array element access.
  // Three-branch alternation: default syntax, array index, plain variable.
  // Dot-notation keys (e.g. ${analysis.severity}) are supported via [\w.]+ —
  // the variables map stores them as flat keys like "analysis.severity".
  return template.replace(
    /\$\{([\w.]+):-((?:[^}\\]|\\.)*)\}|\$\{(\w+)\[(-?\d+)\]\}|\$\{([\w.]+)\}/g,
    (
      match,
      nameWithDefault: string | undefined,
      defaultVal: string | undefined,
      arrayName: string | undefined,
      arrayIndex: string | undefined,
      plainName: string | undefined,
    ) => {
      // H-LANG-004: Array index access ${var[N]}
      if (arrayName !== undefined && arrayIndex !== undefined) {
        if (!(arrayName in variables)) return match;
        const result = resolveArrayIndex(variables[arrayName]!, arrayIndex);
        return result ?? match;
      }

      const name = nameWithDefault ?? plainName!;
      if (name in variables) {
        return stringifyVariableValue(variables[name]!);
      }
      if (nameWithDefault !== undefined) {
        return defaultVal!;
      }
      return match;
    },
  );
}

/** Escape a value for safe inclusion in a shell command string. */
export function shellEscapeValue(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

const SAFE_UNQUOTED_SHELL_VALUE_RE = /^[A-Za-z0-9_./:-]+$/;

function shellEncodeInterpolatedValue(value: string): string {
  return SAFE_UNQUOTED_SHELL_VALUE_RE.test(value) ? value : shellEscapeValue(value);
}

/** Like interpolate(), but shell-encodes substituted values for command safety. */
export function shellInterpolate(template: string, variables: VariableStore): string {
  // H#10: Support ${var:-default} syntax for default values (shell-escaped)
  // H-LANG-004: Support ${var[index]} for array element access (shell-escaped)
  // Dot-notation keys (e.g. ${analysis.severity}) are supported via [\w.]+.
  return template.replace(
    /\$\{([\w.]+):-((?:[^}\\]|\\.)*)\}|\$\{(\w+)\[(-?\d+)\]\}|\$\{([\w.]+)\}/g,
    (
      match,
      nameWithDefault: string | undefined,
      defaultVal: string | undefined,
      arrayName: string | undefined,
      arrayIndex: string | undefined,
      plainName: string | undefined,
    ) => {
      // H-LANG-004: Array index access ${var[N]}
      if (arrayName !== undefined && arrayIndex !== undefined) {
        if (!(arrayName in variables)) return match;
        const result = resolveArrayIndex(variables[arrayName]!, arrayIndex);
        return result !== null ? shellEncodeInterpolatedValue(result) : match;
      }

      const name = nameWithDefault ?? plainName!;
      if (name in variables) {
        return shellEncodeInterpolatedValue(stringifyVariableValue(variables[name]!));
      }
      if (nameWithDefault !== undefined) {
        return shellEncodeInterpolatedValue(defaultVal!);
      }
      return match;
    },
  );
}
