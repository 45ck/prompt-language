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

export function interpolate(
  template: string,
  variables: Readonly<Record<string, string | number | boolean>>,
): string {
  // H#10: Support ${var:-default} syntax for default values.
  // Two-branch alternation: first matches ${var:-default} (including empty default),
  // second matches plain ${var}. Avoids backtracking issues with optional groups.
  return template.replace(
    /\$\{(\w+):-((?:[^}\\]|\\.)*)\}|\$\{(\w+)\}/g,
    (
      match,
      nameWithDefault: string | undefined,
      defaultVal: string | undefined,
      plainName: string | undefined,
    ) => {
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
  return template.replace(
    /\$\{(\w+):-((?:[^}\\]|\\.)*)\}|\$\{(\w+)\}/g,
    (
      match,
      nameWithDefault: string | undefined,
      defaultVal: string | undefined,
      plainName: string | undefined,
    ) => {
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
