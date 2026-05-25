// src/entities/department/application/department-select-options.spec.ts

import { describe, expect, it } from 'vitest';

import {
  buildDepartmentSelectOptions,
  ensureDepartmentSelectOption,
  resolveDepartmentDefaultId,
} from './department-select-options';

describe('department select options', () => {
  it('normalizes enabled department records into select options', () => {
    expect(
      buildDepartmentSelectOptions([
        {
          departmentName: ' 信息工程系 ',
          id: ' ORG0302 ',
          isEnabled: true,
          shortName: ' 信息 ',
        },
        {
          departmentName: '停用系部',
          id: 'ORG9999',
          isEnabled: false,
          shortName: null,
        },
        {
          departmentName: '空 ID',
          id: ' ',
          isEnabled: true,
          shortName: null,
        },
      ]),
    ).toEqual([
      {
        departmentName: '信息工程系',
        id: 'ORG0302',
        isEnabled: true,
        label: '信息工程系 (信息)',
        shortName: '信息',
        value: 'ORG0302',
      },
    ]);
  });

  it('falls back to id when department names are empty', () => {
    expect(
      buildDepartmentSelectOptions([
        {
          departmentName: '',
          id: 'ORG0101',
          isEnabled: true,
          shortName: '',
        },
      ]),
    ).toEqual([
      {
        departmentName: 'ORG0101',
        id: 'ORG0101',
        isEnabled: true,
        label: 'ORG0101',
        shortName: null,
        value: 'ORG0101',
      },
    ]);
  });

  it('adds a fallback department option when the default id is not returned', () => {
    expect(
      ensureDepartmentSelectOption(
        buildDepartmentSelectOptions([
          {
            departmentName: '基础部',
            id: 'ORG0101',
            isEnabled: true,
            shortName: null,
          },
        ]),
        { id: 'ORG0302' },
      ).map((option) => option.value),
    ).toEqual(['ORG0302', 'ORG0101']);
  });

  it('does not duplicate an existing fallback department option', () => {
    const options = buildDepartmentSelectOptions([
      {
        departmentName: '信息工程系',
        id: 'ORG0302',
        isEnabled: true,
        shortName: '信息',
      },
    ]);

    expect(ensureDepartmentSelectOption(options, { id: 'ORG0302' })).toEqual(options);
  });

  it('keeps the current valid department before falling back to the default id', () => {
    const options = buildDepartmentSelectOptions([
      {
        departmentName: '基础部',
        id: 'ORG0101',
        isEnabled: true,
        shortName: null,
      },
      {
        departmentName: '信息工程系',
        id: 'ORG0302',
        isEnabled: true,
        shortName: null,
      },
    ]);

    expect(
      resolveDepartmentDefaultId({
        currentDepartmentId: ' ORG0101 ',
        defaultDepartmentId: 'ORG0302',
        options,
      }),
    ).toBe('ORG0101');
  });

  it('uses the configured default id when the current department is missing', () => {
    expect(
      resolveDepartmentDefaultId({
        currentDepartmentId: 'ORG9999',
        defaultDepartmentId: 'ORG0302',
        options: [],
      }),
    ).toBe('ORG0302');
  });
});
