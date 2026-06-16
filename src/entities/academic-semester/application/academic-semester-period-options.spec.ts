// src/entities/academic-semester/application/academic-semester-period-options.spec.ts

import { describe, expect, it } from 'vitest';

import {
  buildAcademicSemesterPeriodOptions,
  buildAcademicSemesterSchoolYearOptions,
  pickAcademicSemesterId,
  resolveAcademicSemesterPeriodValues,
} from './academic-semester-period-options';

describe('academic semester period options', () => {
  it('sorts semesters by display order, then newer school years and terms', () => {
    const options = buildAcademicSemesterPeriodOptions([
      { id: 1, isCurrent: false, schoolYear: 2024, sortOrder: 20, termNumber: 2 },
      { id: 2, isCurrent: true, schoolYear: 2025, sortOrder: 10, termNumber: 1 },
      { id: 3, isCurrent: false, schoolYear: 2025, sortOrder: 10, termNumber: 2 },
    ]);

    expect(options.map((option) => option.id)).toEqual([3, 2, 1]);
    expect(options[0]).toMatchObject({
      label: '2025-2026 学年第2学期',
      schoolYear: '2025',
      semester: '2',
    });
  });

  it('picks current semester by default without changing display order', () => {
    const records = [
      { id: 1, isCurrent: false, schoolYear: 2025, sortOrder: 0, termNumber: 2 },
      { id: 2, isCurrent: true, schoolYear: 2025, sortOrder: 100, termNumber: 1 },
    ];

    expect(pickAcademicSemesterId(records, null)).toBe(2);
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
      { id: 1, isCurrent: false, schoolYear: 2025, termNumber: 2 },
      { id: 2, isCurrent: true, schoolYear: 2025, sortOrder: 100, termNumber: 1 },
    ]);

    expect(
      resolveAcademicSemesterPeriodValues({
        currentValues: { schoolYear: '2024' },
        options,
      }),
    ).toEqual({
      schoolYear: '2024',
      semester: '1',
    });
  });

  it('can fill missing period fields from the first display option', () => {
    const options = buildAcademicSemesterPeriodOptions([
      { id: 1, isCurrent: false, schoolYear: 2025, termNumber: 2 },
      { id: 2, isCurrent: true, schoolYear: 2025, sortOrder: 100, termNumber: 1 },
    ]);

    expect(
      resolveAcademicSemesterPeriodValues({
        currentValues: {},
        options,
        preferCurrent: false,
      }),
    ).toEqual({
      schoolYear: '2025',
      semester: '2',
    });
  });
});
