// src/features/student-profile-filing/application/student-graduation-info-form-values.spec.ts
import { describe, expect, it } from 'vitest';

import type { GraduationInfo } from '../infrastructure/student-graduation-info-api';

import { buildStudentGraduationInfoFormValues } from './student-graduation-info-form-values';

function missingInfo(): GraduationInfo {
  return {
    studentId: 'S1',
    revision: 'revision-1',
    expectedGraduationYear: 2027,
    trainingLevel: null,
    updatedAt: null,
    canEdit: true,
    mainSnapshotPresent: true,
    fields: [
      'ACTUAL_GRADUATION_DATE',
      'INTERNSHIP_START_DATE',
      'INTERNSHIP_END_DATE',
      'DESTINATION',
    ].map((field) => ({
      field,
      value: null,
      localValue: null,
      source: 'MISSING',
      canSet: true,
      warningCodes: ['GRADUATION_FIELD_MISSING'],
    })),
  };
}

describe('毕业信息表单默认值', () => {
  it('缺失字段预填当年毕业及实习日期和就业去向', () => {
    const info = missingInfo();

    expect(buildStudentGraduationInfoFormValues(info, 2026)).toEqual({
      ACTUAL_GRADUATION_DATE: '2026-06-30',
      INTERNSHIP_START_DATE: '2026-01-16',
      INTERNSHIP_END_DATE: '2026-06-30',
      DESTINATION: '就业',
    });
    expect(info.fields.every((field) => field.localValue === null)).toBe(true);
    expect(buildStudentGraduationInfoFormValues(info, 2028).ACTUAL_GRADUATION_DATE).toBe(
      '2028-06-30',
    );
  });

  it.each(['LOCAL', 'UPSTREAM'])(
    '已有 %s 毕业日期时，实习开始默认使用毕业当年的一月十六日',
    (source) => {
      const info = missingInfo();
      info.fields = info.fields.map((field) =>
        field.field === 'ACTUAL_GRADUATION_DATE'
          ? {
              ...field,
              value: '2025-06-30',
              localValue: source === 'LOCAL' ? '2025-06-30' : null,
              source,
              canSet: source === 'LOCAL',
            }
          : field,
      );

      expect(buildStudentGraduationInfoFormValues(info, 2026).INTERNSHIP_START_DATE).toBe(
        '2025-01-16',
      );
    },
  );

  it('已有本地日期和毕业去向不被默认值覆盖', () => {
    const info = missingInfo();
    const saved: Record<string, string> = {
      ACTUAL_GRADUATION_DATE: '2025-07-01',
      INTERNSHIP_START_DATE: '2024-09-01',
      INTERNSHIP_END_DATE: '2025-06-15',
      DESTINATION: '升学',
    };
    info.fields = info.fields.map((field) => ({
      ...field,
      source: 'LOCAL',
      value: saved[field.field],
      localValue: saved[field.field],
    }));

    expect(buildStudentGraduationInfoFormValues(info, 2026)).toEqual(saved);
  });

  it('保存后的服务端结果不再预填，保留用户主动清空的字段', () => {
    expect(buildStudentGraduationInfoFormValues(missingInfo(), null)).toEqual({
      ACTUAL_GRADUATION_DATE: '',
      INTERNSHIP_START_DATE: '',
      INTERNSHIP_END_DATE: '',
      DESTINATION: '',
    });
  });

  it.each([{ canEdit: false }, { mainSnapshotPresent: false }])(
    '只读或没有主档案时不预填待保存值：%o',
    (restriction) => {
      const info = { ...missingInfo(), ...restriction };
      expect(Object.values(buildStudentGraduationInfoFormValues(info, 2026))).toEqual([
        '',
        '',
        '',
        '',
      ]);
    },
  );

  it('上游字段或被禁止编辑的字段不产生本地默认候选', () => {
    const info = missingInfo();
    info.fields = info.fields.map((field) => ({
      ...field,
      source: 'UPSTREAM',
      canSet: false,
      value: field.field === 'DESTINATION' ? '升学' : '2025-06-30',
    }));

    expect(Object.values(buildStudentGraduationInfoFormValues(info, 2026))).toEqual([
      '',
      '',
      '',
      '',
    ]);
  });

  it.each([
    ['技师', '技师'],
    ['技师班', '技师'],
    ['高级', '高级工'],
    ['高级工班', '高级工'],
    [' 中级班 ', '中级工'],
    ['高级技师班', '高级技师'],
    [null, ''],
    ['未知层次', ''],
  ])('培养层次 %p 预填职业技能类型 %p', (trainingLevel, expected) => {
    const info = missingInfo();
    info.trainingLevel = trainingLevel;
    info.fields = [
      {
        field: 'VOCATIONAL_SKILL_TYPE',
        value: null,
        localValue: null,
        source: 'MISSING',
        canSet: true,
        warningCodes: [],
      },
    ];

    expect(buildStudentGraduationInfoFormValues(info, 2026).VOCATIONAL_SKILL_TYPE).toBe(expected);
    expect(buildStudentGraduationInfoFormValues(info, null).VOCATIONAL_SKILL_TYPE).toBe('');
  });

  it('培养层次不覆盖已有技能类型或上游字段', () => {
    const info = missingInfo();
    info.trainingLevel = '技师';
    info.fields = [
      {
        field: 'VOCATIONAL_SKILL_TYPE',
        value: '电工',
        localValue: '电工',
        source: 'LOCAL',
        canSet: true,
        warningCodes: [],
      },
    ];
    expect(buildStudentGraduationInfoFormValues(info, 2026).VOCATIONAL_SKILL_TYPE).toBe('电工');
    info.fields = info.fields.map((field) => ({
      ...field,
      source: 'UPSTREAM',
      localValue: null,
      canSet: false,
    }));
    expect(buildStudentGraduationInfoFormValues(info, 2026).VOCATIONAL_SKILL_TYPE).toBe('');
  });
});
