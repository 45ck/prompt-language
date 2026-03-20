/**
 * interpolate — Pure string interpolation for variable substitution.
 *
 * Replaces ${varName} tokens in a template string with values from a
 * variables record. Unknown variables are left as-is.
 */

export function interpolate(
  template: string,
  variables: Readonly<Record<string, string | number | boolean>>,
): string {
  return template.replace(/\$\{(\w+)\}/g, (match, name: string) => {
    if (name in variables) {
      return String(variables[name]);
    }
    return match;
  });
}
