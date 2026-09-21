// src/features/class-sync/ui/class-sync-page-content.spec.ts

import { describe, expect, it } from 'vitest';

import { formatClassAdmissionCategory } from '../application/class-sync-presentation';

describe('class sync admission category labels', () => {
  it('formats both admission categories and empty values', () => {
    expect(formatClassAdmissionCategory('JUNIOR_HIGH_ORIGIN')).toBe('初中起点');
    expect(formatClassAdmissionCategory('HIGH_SCHOOL_ORIGIN')).toBe('高中起点');
    expect(formatClassAdmissionCategory(null)).toBe('—');
  });
});
