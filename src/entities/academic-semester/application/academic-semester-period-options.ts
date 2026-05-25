// src/entities/academic-semester/application/academic-semester-period-options.ts

export type AcademicSemesterPeriodRecord = {
  id: number;
  isCurrent: boolean;
  schoolYear: number;
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

export const ACADEMIC_SEMESTER_TERM_OPTIONS = [
  { label: '第 1 学期', value: '1' },
  { label: '第 2 学期', value: '2' },
] as const;

export function buildAcademicSemesterPeriodOptions(
  records: readonly AcademicSemesterPeriodRecord[],
) {
  return [...records]
    .sort((left, right) => {
      if (left.isCurrent !== right.isCurrent) {
        return left.isCurrent ? -1 : 1;
      }

      if (left.schoolYear !== right.schoolYear) {
        return right.schoolYear - left.schoolYear;
      }

      if (left.termNumber !== right.termNumber) {
        return right.termNumber - left.termNumber;
      }

      return right.id - left.id;
    })
    .map((semester) => ({
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
}) {
  const preferredSemester = input.options[0];

  return {
    schoolYear: input.currentValues.schoolYear || preferredSemester?.schoolYear,
    semester: input.currentValues.semester || preferredSemester?.semester,
  };
}
