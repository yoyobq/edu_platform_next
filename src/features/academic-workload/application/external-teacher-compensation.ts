// src/features/academic-workload/application/external-teacher-compensation.ts
export type ExternalTeacherCompensationActualHoursInput = {
  actualHours: number | string | null | undefined;
  adjustmentHours: number | string | null | undefined;
  coefficient: number | string | null | undefined;
  weekCount: number | string | null | undefined;
  weeklyHours: number | string | null | undefined;
};

export type ExternalTeacherCompensationActualHoursComparison =
  | {
      backendActualHours: number;
      calculatedActualHours: number;
      status: 'matched' | 'mismatched';
    }
  | {
      backendActualHours: number | null;
      calculatedActualHours: number | null;
      status: 'invalid';
    };

const ACTUAL_HOURS_COMPARISON_DECIMAL_PLACES = 2;
const ACTUAL_HOURS_COMPARISON_SCALE = 10 ** ACTUAL_HOURS_COMPARISON_DECIMAL_PLACES;

export function parseExternalTeacherCompensationNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const normalizedValue = value?.trim().replaceAll(',', '') ?? '';

  if (!normalizedValue) {
    return null;
  }

  const numericValue = Number(normalizedValue);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function roundActualHoursForComparison(value: number) {
  // 按数值符号微调，避免二进制浮点在分位边界上误判。
  return Math.round((value + Math.sign(value) * Number.EPSILON) * ACTUAL_HOURS_COMPARISON_SCALE);
}

export function calculateExternalTeacherCompensationActualHours(
  input: ExternalTeacherCompensationActualHoursInput,
) {
  const weeklyHours = parseExternalTeacherCompensationNumber(input.weeklyHours);
  const weekCount = parseExternalTeacherCompensationNumber(input.weekCount);
  const adjustmentHours = parseExternalTeacherCompensationNumber(input.adjustmentHours);
  const coefficient = parseExternalTeacherCompensationNumber(input.coefficient);

  if (
    weeklyHours === null ||
    weekCount === null ||
    adjustmentHours === null ||
    coefficient === null
  ) {
    return null;
  }

  return (weeklyHours * weekCount + adjustmentHours) * coefficient;
}

export function compareExternalTeacherCompensationActualHours(
  input: ExternalTeacherCompensationActualHoursInput,
): ExternalTeacherCompensationActualHoursComparison {
  const calculatedActualHours = calculateExternalTeacherCompensationActualHours(input);
  const backendActualHours = parseExternalTeacherCompensationNumber(input.actualHours);

  if (calculatedActualHours === null || backendActualHours === null) {
    return {
      backendActualHours,
      calculatedActualHours,
      status: 'invalid',
    };
  }

  return {
    backendActualHours,
    calculatedActualHours,
    status:
      roundActualHoursForComparison(calculatedActualHours) ===
      roundActualHoursForComparison(backendActualHours)
        ? 'matched'
        : 'mismatched',
  };
}
