/**
 * interpolate — Pure string interpolation for variable substitution.
 *
 * Replaces ${varName} tokens in a template string with values from a
 * variables record. Unknown variables are left as-is.
 *
 * **Security note:** `interpolate()` performs raw substitution and MUST NOT be
 * used to build shell commands from untrusted input. Use `shellInterpolate()`
 * for run-node commands — it wraps substituted values in single-quotes to
 * prevent shell injection.
 */

/** Resolve an array index access on a JSON-array variable value. */
function resolveArrayIndex(value: string, indexStr: string): string | null {
  let arr: unknown;
  try {
    arr = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(arr)) return null;
  let idx = parseInt(indexStr, 10);
  if (isNaN(idx)) return null;
  if (idx < 0) idx = arr.length + idx;
  if (idx < 0 || idx >= arr.length) return '';
  return String(arr[idx]);
}

export function interpolate(
  template: string,
  variables: Readonly<Record<string, string | number | boolean>>,
): string {
  // H#10: Support ${var:-default} syntax for default values.
  // H-LANG-004: Support ${var[index]} for array element access.
  // Three-branch alternation: default syntax, array index, plain variable.
  return template.replace(
    /\$\{(\w+):-((?:[^}\\]|\\.)*)\}|\$\{(\w+)\[(-?\d+)\]\}|\$\{(\w+)\}/g,
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
        const result = resolveArrayIndex(String(variables[arrayName]), arrayIndex);
        return result ?? match;
      }

      const name = nameWithDefault ?? plainName!;
      if (name in variables) {
        return String(variables[name]);
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

/** Like interpolate(), but wraps substituted values in single-quotes for shell safety. */
export function shellInterpolate(
  template: string,
  variables: Readonly<Record<string, string | number | boolean>>,
): string {
  // H#10: Support ${var:-default} syntax for default values (shell-escaped)
  // H-LANG-004: Support ${var[index]} for array element access (shell-escaped)
  return template.replace(
    /\$\{(\w+):-((?:[^}\\]|\\.)*)\}|\$\{(\w+)\[(-?\d+)\]\}|\$\{(\w+)\}/g,
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
        const result = resolveArrayIndex(String(variables[arrayName]), arrayIndex);
        return result !== null ? shellEscapeValue(result) : match;
      }

      const name = nameWithDefault ?? plainName!;
      if (name in variables) {
        return shellEscapeValue(String(variables[name]));
      }
      if (nameWithDefault !== undefined) {
        return shellEscapeValue(defaultVal!);
      }
      return match;
    },
  );
}
