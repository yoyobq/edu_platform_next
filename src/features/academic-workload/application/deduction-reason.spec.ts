// src/features/academic-workload/application/deduction-reason.spec.ts

import { describe, expect, it } from 'vitest';

import { formatDeductionReason } from './deduction-reason';

describe('academic workload deduction summary labels', () => {
  it('renders military training in Chinese', () => {
    expect(formatDeductionReason('MILITARY_TRAINING')).toBe('军训');
  });
});
