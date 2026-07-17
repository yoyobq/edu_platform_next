// src/features/student-conduct-alignment/application/conduct-grade-display.spec.ts

import { describe, expect, it } from 'vitest';

import {
  resolveConductGradeConflictCopy,
  resolveConductGradeFieldLabel,
  resolveConductGradeSourceLabel,
} from './conduct-grade-display';

describe('conduct grade display copy', () => {
  it('translates writable fields and effective sources', () => {
    expect(resolveConductGradeFieldLabel('score')).toBe('分数');
    expect(resolveConductGradeFieldLabel('confirmedGrade')).toBe('确认等级');
    expect(resolveConductGradeSourceLabel('UPSTREAM_CONFIRMED')).toBe('校园网');
    expect(resolveConductGradeSourceLabel('MISSING')).toBe('当前缺失');
  });

  it('explains why a stale correction is not applied', () => {
    expect(resolveConductGradeConflictCopy('UPSTREAM_CHANGED_SINCE_CORRECTION')).toEqual({
      description:
        '校园网操行记录的整体基线在本地补正后发生了变化。为避免误用旧补正，系统暂未采用该补正；基线变化不代表当前字段已经有校园网值。',
      label: '基线变化待复核',
    });
  });
});
