export type OptionalTextEmptyPolicy = 'keep_empty_string' | 'to_null' | 'to_undefined';

type RequiredTextOptions = {
  label?: string;
  message?: string;
};

export function normalizeRequiredTextValue(
  value: string | null | undefined,
  options: RequiredTextOptions = {},
) {
  const normalizedValue = value?.trim() ?? '';

  if (!normalizedValue) {
    throw new Error(
      options.message ?? (options.label ? `请输入${options.label}。` : '请输入必填内容。'),
    );
  }

  return normalizedValue;
}

export function normalizeOptionalTextValue(
  value: string | null | undefined,
  emptyPolicy: 'to_null',
): string | null;
export function normalizeOptionalTextValue(
  value: string | null | undefined,
  emptyPolicy: 'to_undefined',
): string | undefined;
export function normalizeOptionalTextValue(
  value: string | null | undefined,
  emptyPolicy: 'keep_empty_string',
): string;
export function normalizeOptionalTextValue(
  value: string | null | undefined,
  emptyPolicy: OptionalTextEmptyPolicy,
) {
  const normalizedValue = value?.trim() ?? '';

  if (normalizedValue) {
    return normalizedValue;
  }

  if (emptyPolicy === 'to_null') {
    return null;
  }

  if (emptyPolicy === 'to_undefined') {
    return undefined;
  }

  return '';
}

export function normalizeTextListValue(
  values: readonly string[],
  options: {
    dedupe?: boolean;
    emptyItemPolicy: 'filter';
  },
) {
  const normalizedValues = values.map((value) => value.trim()).filter((value) => value.length > 0);

  if (!options.dedupe) {
    return normalizedValues;
  }

  return Array.from(new Set(normalizedValues));
}
