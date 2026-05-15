// src/features/academic-workload/application/teaching-class-format.spec.ts
import { describe, expect, it } from 'vitest';

import {
  formatAcademicWorkloadTeachingClassMultiline,
  splitAcademicWorkloadTeachingClassNames,
} from './teaching-class-format';

describe('academic workload teaching class format helpers', () => {
  it('splits comma, pause, and semicolon separated teaching class names', () => {
    expect(
      splitAcademicWorkloadTeachingClassNames('高一1班，高一2班、 高一3班;高一4班；高一5班'),
    ).toEqual(['高一1班', '高一2班', '高一3班', '高一4班', '高一5班']);
  });

  it('formats separated teaching class names as multiline text', () => {
    expect(formatAcademicWorkloadTeachingClassMultiline('高一1班，高一2班、 高一3班')).toBe(
      '高一1班\n高一2班\n高一3班',
    );
    expect(formatAcademicWorkloadTeachingClassMultiline(' , ', '-')).toBe('-');
  });
});
