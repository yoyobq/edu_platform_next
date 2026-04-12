import { normalizeOptionalTextValue } from './formatters';

export function parseGeographicValue(
  value:
    | {
        city: string | null;
        province: string | null;
      }
    | string
    | null
    | undefined,
) {
  if (!value) {
    return {
      city: null,
      province: null,
    };
  }

  if (typeof value === 'object') {
    return {
      city: typeof value.city === 'string' && value.city.trim() ? value.city.trim() : null,
      province:
        typeof value.province === 'string' && value.province.trim() ? value.province.trim() : null,
    };
  }

  try {
    const parsedValue = JSON.parse(value) as { city?: unknown; province?: unknown };

    return {
      city:
        typeof parsedValue.city === 'string' && parsedValue.city.trim()
          ? parsedValue.city.trim()
          : null,
      province:
        typeof parsedValue.province === 'string' && parsedValue.province.trim()
          ? parsedValue.province.trim()
          : null,
    };
  } catch {
    return {
      city: null,
      province: value.trim() || null,
    };
  }
}

export function buildGeographicInput(value: { city?: string | null; province?: string | null }) {
  const city = normalizeOptionalTextValue(value.city);
  const province = normalizeOptionalTextValue(value.province);

  if (!city && !province) {
    return null;
  }

  return {
    ...(province ? { province } : {}),
    ...(city ? { city } : {}),
  };
}

export function formatGeographicValue(
  value:
    | {
        city: string | null;
        province: string | null;
      }
    | string
    | null
    | undefined,
) {
  const parsedValue = parseGeographicValue(value);

  return [parsedValue.province, parsedValue.city].filter(Boolean).join(' / ') || '—';
}
