// src/features/academic-workload/infrastructure/external-teacher-compensation-excel-export.spec.ts
import { describe, expect, it } from 'vitest';

import { buildExternalTeacherCompensationActualHoursFormula } from './external-teacher-compensation-excel-export';

describe('external teacher compensation excel export', () => {
  it('uses the adjusted actual-hours formula with coefficient applied to adjustments', () => {
    expect(buildExternalTeacherCompensationActualHoursFormula(5)).toBe('(E5*F5+G5)*H5');
  });
});
