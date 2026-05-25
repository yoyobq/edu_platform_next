// src/entities/academic-semester/application/academic-semester-period-options.spec.ts

import { describe, expect, it } from 'vitest';

import {
  buildAcademicSemesterPeriodOptions,
  buildAcademicSemesterSchoolYearOptions,
  resolveAcademicSemesterPeriodValues,
} from './academic-semester-period-options';

describe('academic semester period options', () => {
  it('sorts current semester first, then newer school years and terms', () => {
    const options = buildAcademicSemesterPeriodOptions([
      { id: 1, isCurrent: false, schoolYear: 2024, termNumber: 2 },
      { id: 2, isCurrent: true, schoolYear: 2025, termNumber: 1 },
      { id: 3, isCurrent: false, schoolYear: 2025, termNumber: 2 },
    ]);

    expect(options.map((option) => option.id)).toEqual([2, 3, 1]);
    expect(options[0]).toMatchObject({
      label: '2025-2026 学年第1学期',
      schoolYear: '2025',
      semester: '1',
    });
  });

  it('builds unique school year options in semester option order', () => {
    const options = buildAcademicSemesterPeriodOptions([
      { id: 1, isCurrent: true, schoolYear: 2025, termNumber: 1 },
      { id: 2, isCurrent: false, schoolYear: 2025, termNumber: 2 },
      { id: 3, isCurrent: false, schoolYear: 2024, termNumber: 2 },
    ]);

    expect(buildAcademicSemesterSchoolYearOptions(options)).toEqual([
      { label: '2025-2026 学年', value: '2025' },
      { label: '2024-2025 学年', value: '2024' },
    ]);
  });

  it('keeps existing values and fills missing period fields from the preferred semester', () => {
    const options = buildAcademicSemesterPeriodOptions([
      { id: 1, isCurrent: true, schoolYear: 2025, termNumber: 2 },
    ]);

    expect(
      resolveAcademicSemesterPeriodValues({
        currentValues: { schoolYear: '2024' },
        options,
      }),
    ).toEqual({
      schoolYear: '2024',
      semester: '2',
    });
  });
});
