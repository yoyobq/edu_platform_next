export function includesAnyPattern(value: string | null | undefined, patterns: readonly string[]) {
  if (!value) {
    return false;
  }

  const normalizedValue = value.toLowerCase();

  return patterns.some((pattern) => normalizedValue.includes(pattern.toLowerCase()));
}
