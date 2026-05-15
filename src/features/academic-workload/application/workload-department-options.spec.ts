// src/features/academic-workload/application/workload-department-options.spec.ts
import { describe, expect, it } from 'vitest';

import {
  buildAcademicWorkloadDepartmentSelectOptions,
  ensureSelectedAcademicWorkloadDepartmentOption,
} from './workload-department-options';

describe('academic workload department option helpers', () => {
  it('normalizes workload department records into sorted select options', () => {
    expect(
      buildAcademicWorkloadDepartmentSelectOptions([
        { departmentName: ' 信息工程系 ', id: ' ORG0302 ', shortName: '信工' },
        { departmentName: '', id: 'ORG0101', shortName: '基础部' },
        { departmentName: '忽略', id: ' ' },
      ]),
    ).toEqual([
      { label: '基础部', value: 'ORG0101' },
      { label: '信息工程系', value: 'ORG0302' },
    ]);
  });

  it('keeps a missing selected workload department visible at the requested edge', () => {
    const options = [{ label: '信息工程系', value: 'ORG0302' }];

    expect(
      ensureSelectedAcademicWorkloadDepartmentOption({
        fallbackLabel: '当前归口系',
        options,
        selectedDepartmentId: 'ORG9999',
      }),
    ).toEqual([
      { label: '当前归口系', value: 'ORG9999' },
      { label: '信息工程系', value: 'ORG0302' },
    ]);
    expect(
      ensureSelectedAcademicWorkloadDepartmentOption({
        appendMissing: true,
        fallbackLabel: '当前归口系',
        options,
        selectedDepartmentId: 'ORG9999',
      }),
    ).toEqual([
      { label: '信息工程系', value: 'ORG0302' },
      { label: '当前归口系', value: 'ORG9999' },
    ]);
  });
});
