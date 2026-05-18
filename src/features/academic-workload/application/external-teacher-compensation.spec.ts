// src/features/academic-workload/application/external-teacher-compensation.spec.ts
import { describe, expect, it } from 'vitest';

import {
  calculateExternalTeacherCompensationActualHours,
  compareExternalTeacherCompensationActualHours,
} from './external-teacher-compensation';

describe('external teacher compensation helpers', () => {
  it('applies coefficient to both scheduled and adjusted hours', () => {
    expect(
      calculateExternalTeacherCompensationActualHours({
        actualHours: '42.60',
        adjustmentHours: '1.5',
        coefficient: '1.2',
        weekCount: 17,
        weeklyHours: '2',
      }),
    ).toBe(42.6);
  });

  it('matches backend actualHours after rounding to cents', () => {
    expect(
      compareExternalTeacherCompensationActualHours({
        actualHours: '42.60',
        adjustmentHours: '1.5',
        coefficient: '1.2',
        weekCount: 17,
        weeklyHours: '2',
      }),
    ).toMatchObject({
      backendActualHours: 42.6,
      calculatedActualHours: 42.6,
      status: 'matched',
    });
  });

  it('flags actualHours calculated with unscaled adjustment hours', () => {
    expect(
      compareExternalTeacherCompensationActualHours({
        actualHours: '42.30',
        adjustmentHours: '1.5',
        coefficient: '1.2',
        weekCount: 17,
        weeklyHours: '2',
      }),
    ).toMatchObject({
      backendActualHours: 42.3,
      calculatedActualHours: 42.6,
      status: 'mismatched',
    });
  });

  it('marks nonnumeric formula inputs as invalid', () => {
    expect(
      compareExternalTeacherCompensationActualHours({
        actualHours: '42.60',
        adjustmentHours: '1.5',
        coefficient: '一',
        weekCount: 17,
        weeklyHours: '2',
      }),
    ).toMatchObject({
      backendActualHours: 42.6,
      calculatedActualHours: null,
      status: 'invalid',
    });
  });
});
