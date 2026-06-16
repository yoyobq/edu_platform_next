// src/entities/academic-semester/application/academic-semester-period-options.ts

export type AcademicSemesterPeriodRecord = {
  id: number;
  isCurrent: boolean;
  isVisible?: boolean;
  schoolYear: number;
  sortOrder?: number;
  termNumber: number;
};

export type AcademicSemesterPeriodOption = {
  id: number;
  isCurrent: boolean;
  label: string;
  schoolYear: string;
  semester: string;
};

export type AcademicSemesterSchoolYearOption = {
  label: string;
  value: string;
};

export type AcademicSemesterPeriodValues = {
  schoolYear?: string;
  semester?: string;
};

export type AcademicSemesterSelectRecord = AcademicSemesterPeriodRecord & {
  name: string;
};

export type PickAcademicSemesterIdOptions = {
  canKeepCurrentSelection?: boolean;
  preferCurrent?: boolean;
  preferredSelection?: number | null;
};

export const VISIBLE_ACADEMIC_SEMESTERS_QUERY_INPUT = {
  isVisible: true,
  limit: 500,
} as const;

export const ACADEMIC_SEMESTER_TERM_OPTIONS = [
  { label: '第 1 学期', value: '1' },
  { label: '第 2 学期', value: '2' },
] as const;

export function sortAcademicSemestersForDisplay<TRecord extends AcademicSemesterPeriodRecord>(
  records: readonly TRecord[],
) {
  return [...records].sort((left, right) => {
    const leftSortOrder = left.sortOrder ?? 0;
    const rightSortOrder = right.sortOrder ?? 0;

    if (leftSortOrder !== rightSortOrder) {
      return leftSortOrder - rightSortOrder;
    }

    if (left.schoolYear !== right.schoolYear) {
      return right.schoolYear - left.schoolYear;
    }

    if (left.termNumber !== right.termNumber) {
      return right.termNumber - left.termNumber;
    }

    return right.id - left.id;
  });
}

export function pickAcademicSemesterId(
  records: readonly AcademicSemesterPeriodRecord[],
  currentSelection: number | null | undefined,
  options: PickAcademicSemesterIdOptions = {},
) {
  const {
    canKeepCurrentSelection = true,
    preferCurrent = true,
    preferredSelection = null,
  } = options;

  if (
    preferredSelection !== null &&
    preferredSelection !== undefined &&
    records.some((record) => record.id === preferredSelection)
  ) {
    return preferredSelection;
  }

  if (
    canKeepCurrentSelection &&
    currentSelection !== null &&
    currentSelection !== undefined &&
    records.some((record) => record.id === currentSelection)
  ) {
    return currentSelection;
  }

  if (preferCurrent) {
    const currentSemester = records.find((record) => record.isCurrent);

    if (currentSemester) {
      return currentSemester.id;
    }
  }

  return records[0]?.id ?? null;
}

export function pickAcademicSemesterRecord<TRecord extends AcademicSemesterPeriodRecord>(
  records: readonly TRecord[],
  currentSelection: number | null | undefined,
  options: PickAcademicSemesterIdOptions = {},
) {
  const id = pickAcademicSemesterId(records, currentSelection, options);

  return id === null ? null : (records.find((record) => record.id === id) ?? null);
}

export function formatAcademicSemesterLabel(
  semester: Pick<AcademicSemesterSelectRecord, 'isCurrent' | 'name'>,
) {
  return `${semester.name}${semester.isCurrent ? ' · 当前' : ''}`;
}

export function buildAcademicSemesterPeriodOptions(
  records: readonly AcademicSemesterPeriodRecord[],
) {
  return sortAcademicSemestersForDisplay(records).map((semester) => ({
    id: semester.id,
    isCurrent: semester.isCurrent,
    label: `${semester.schoolYear}-${semester.schoolYear + 1} 学年第${semester.termNumber}学期`,
    schoolYear: String(semester.schoolYear),
    semester: String(semester.termNumber),
  }));
}

export function buildAcademicSemesterSchoolYearOptions(
  options: readonly AcademicSemesterPeriodOption[],
) {
  const seen = new Set<string>();

  return options.reduce<AcademicSemesterSchoolYearOption[]>((result, option) => {
    if (seen.has(option.schoolYear)) {
      return result;
    }

    seen.add(option.schoolYear);
    result.push({
      label: `${option.schoolYear}-${Number(option.schoolYear) + 1} 学年`,
      value: option.schoolYear,
    });
    return result;
  }, []);
}

export function resolveAcademicSemesterPeriodValues(input: {
  currentValues: AcademicSemesterPeriodValues;
  options: readonly AcademicSemesterPeriodOption[];
  preferCurrent?: boolean;
}) {
  const preferredSemester =
    input.preferCurrent === false
      ? input.options[0]
      : (input.options.find((option) => option.isCurrent) ?? input.options[0]);

  return {
    schoolYear: input.currentValues.schoolYear || preferredSemester?.schoolYear,
    semester: input.currentValues.semester || preferredSemester?.semester,
  };
}
