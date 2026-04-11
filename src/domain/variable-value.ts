export type VariableValue =
  | string
  | number
  | boolean
  | readonly VariableValue[]
  | { readonly [key: string]: VariableValue };

export type VariableStore = Readonly<Record<string, VariableValue>>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isVariableValue(value: unknown): value is VariableValue {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((item) => isVariableValue(item));
  }
  if (isPlainObject(value)) {
    return Object.values(value).every((item) => isVariableValue(item));
  }
  return false;
}

export function stringifyVariableValue(value: VariableValue): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

export function decodeJsonVariableValue(raw: string): VariableValue {
  if (raw === '') return '';

  try {
    const parsed: unknown = JSON.parse(raw);
    return isVariableValue(parsed) ? parsed : raw;
  } catch {
    return raw;
  }
}
