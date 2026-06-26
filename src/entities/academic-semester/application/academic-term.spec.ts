// src/entities/academic-semester/application/academic-term.spec.ts

import { describe, expect, it } from 'vitest';

import {
  buildAcademicTermKey,
  buildAcademicTermOrdinalByKey,
  formatAcademicSchoolYear,
  formatAcademicSemester,
  formatAcademicTermLabel,
  parsePositiveIntegerText,
  resolveAcademicTermTimelineOrder,
  sortAcademicTermsByTimelineDesc,
} from './academic-term';

describe('academic term helpers', () => {
  it('formats school year and semester labels', () => {
    expect(formatAcademicSchoolYear('2025')).toBe('25-26学年');
    expect(formatAcademicSemester('1')).toBe('第一学期');
    expect(formatAcademicSemester('2')).toBe('第二学期');
    expect(formatAcademicTermLabel({ schoolYear: '2025', semester: '2' })).toBe(
      '25-26学年 第二学期',
    );
    expect(
      formatAcademicTermLabel({ label: '自定义学期', schoolYear: '2025', semester: '2' }),
    ).toBe('自定义学期');
  });

  it('parses and orders valid academic terms', () => {
    expect(parsePositiveIntegerText(' 2025 ')).toBe(2025);
    expect(parsePositiveIntegerText('abc')).toBeNull();
    expect(resolveAcademicTermTimelineOrder({ schoolYear: '2025', semester: '2' })).toBe(20252);
    expect(buildAcademicTermKey({ schoolYear: '2025', semester: '2' })).toBe('2025::2');
  });

  it('sorts timeline descending and builds ascending ordinals', () => {
    const terms = [
      { label: '25-26学年 第一学期', schoolYear: '2025', semester: '1' },
      { label: '26-27学年 第一学期', schoolYear: '2026', semester: '1' },
      { label: '25-26学年 第二学期', schoolYear: '2025', semester: '2' },
    ];

    expect(sortAcademicTermsByTimelineDesc(terms).map(buildAcademicTermKey)).toEqual([
      '2026::1',
      '2025::2',
      '2025::1',
    ]);
    expect(Array.from(buildAcademicTermOrdinalByKey(terms).entries())).toEqual([
      ['2025::1', 1],
      ['2025::2', 2],
      ['2026::1', 3],
    ]);
  });

  it('falls back to labels for invalid timeline values', () => {
    const terms = [
      { label: 'B', schoolYear: 'invalid', semester: '1' },
      { label: 'A', schoolYear: 'invalid', semester: '2' },
    ];

    expect(sortAcademicTermsByTimelineDesc(terms).map((term) => term.label)).toEqual(['B', 'A']);
    expect(Array.from(buildAcademicTermOrdinalByKey(terms).entries())).toEqual([
      ['invalid::2', 1],
      ['invalid::1', 2],
    ]);
  });
});
