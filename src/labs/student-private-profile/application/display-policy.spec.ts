// src/labs/student-private-profile/application/display-policy.spec.ts

import { describe, expect, it } from 'vitest';

import {
  formatStudentPrivateProfileBoolean,
  formatStudentPrivateProfileCompletenessStatus,
  normalizeStudentPrivateProfileFieldKey,
  resolveStudentPrivateProfileBatchStatusLabel,
  resolveStudentPrivateProfileClassOverviewAttentionColor,
  resolveStudentPrivateProfileClassOverviewAttentionLabel,
  resolveStudentPrivateProfileCompareField,
  resolveStudentPrivateProfileCompareResultLabel,
  resolveStudentPrivateProfileFamilyFieldLabel,
  resolveStudentPrivateProfileFamilyRelationshipLabel,
  resolveStudentPrivateProfileFieldLabel,
  resolveStudentPrivateProfileFieldOrder,
  resolveStudentPrivateProfileManualPatchField,
  resolveStudentPrivateProfilePhotoStatusLabel,
  resolveStudentPrivateProfileRecordChangeTypeLabel,
  resolveStudentPrivateProfileSectionLabel,
  resolveStudentPrivateProfileSourceLabel,
  resolveStudentPrivateProfileStatusLabel,
  resolveStudentPrivateProfileWarningCodeLabel,
  resolveStudentRegistrationCardGenerationCodeLabel,
  resolveStudentRegistrationCardTermMaterialStatusLabel,
  resolveStudentRegistrationCardTermReadinessStatusLabel,
} from './display-policy';

describe('student private profile display policy', () => {
  it('maps backend field and section keys to user-facing labels', () => {
    expect(resolveStudentPrivateProfileFieldLabel('STUDENT_PHONE')).toBe('学生手机号');
    expect(resolveStudentPrivateProfileFieldLabel('studentPhone')).toBe('学生手机号');
    expect(resolveStudentPrivateProfileFieldLabel('politicalStatus')).toBe('政治面貌');
    expect(resolveStudentPrivateProfileFieldLabel('home-address')).toBe('家庭地址');
    expect(normalizeStudentPrivateProfileFieldKey('idCard')).toBe('ID_CARD');
    expect(resolveStudentPrivateProfileCompareField('studentPhone')).toBe('STUDENT_PHONE');
    expect(resolveStudentPrivateProfileCompareField('homeAddress')).toBeNull();
    expect(resolveStudentPrivateProfileManualPatchField('homeAddress')).toBe('HOME_ADDRESS');
    expect(resolveStudentPrivateProfileFieldOrder('gender')).toBeLessThan(
      resolveStudentPrivateProfileFieldOrder('idCard'),
    );
    expect(resolveStudentPrivateProfileFamilyFieldLabel('RELATIONSHIP_CODE')).toBe('家庭关系');
    expect(resolveStudentPrivateProfileSectionLabel('sensitive_identifiers')).toBe('证件与卡号');
    expect(resolveStudentPrivateProfileSectionLabel('photoMeta')).toBe('照片');
    expect(resolveStudentPrivateProfileSectionLabel('EDUCATION_RESUME')).toBe('教育经历');
    expect(resolveStudentPrivateProfileSectionLabel('STATUS_CHANGE')).toBe('学籍异动');
    expect(resolveStudentPrivateProfileSectionLabel('unknown_section')).toBe('unknown_section');
  });

  it('maps backend source and status enums to stable-facing labels', () => {
    expect(resolveStudentPrivateProfileSourceLabel('UPSTREAM')).toBe('学工系统');
    expect(resolveStudentPrivateProfileSourceLabel('CACHE')).toBe('本地缓存');
    expect(resolveStudentPrivateProfileSourceLabel('CALCULATED')).toBe('系统推断');
    expect(resolveStudentPrivateProfileSourceLabel('MANUAL')).toBe('人工修正');
    expect(resolveStudentPrivateProfileStatusLabel('OBSERVED')).toBe('已同步');
    expect(resolveStudentPrivateProfileStatusLabel('PARTIAL')).toBe('部分同步');
    expect(resolveStudentPrivateProfileStatusLabel('MISSING')).toBe('暂无记录');
    expect(resolveStudentPrivateProfileStatusLabel('ENROLLED')).toBe('在读');
    expect(resolveStudentPrivateProfileStatusLabel('OFF_CAMPUS_INTERNSHIP')).toBe('下厂/校外实习');
    expect(resolveStudentPrivateProfileStatusLabel('SUSPENDED')).toBe('暂离（休学/兵役等）');
    expect(formatStudentPrivateProfileCompletenessStatus(true)).toBe('已同步');
    expect(formatStudentPrivateProfileCompletenessStatus(false)).toBe('待同步');
  });

  it('maps action result enums without leaking raw contract terms', () => {
    expect(resolveStudentPrivateProfileCompareResultLabel('MATCH')).toBe('一致');
    expect(resolveStudentPrivateProfileCompareResultLabel('MISSING')).toBe('本地暂无可核验值');
    expect(resolveStudentPrivateProfilePhotoStatusLabel('CACHE_RETAINED')).toBe('使用本地缓存');
    expect(resolveStudentPrivateProfileBatchStatusLabel('FAILED')).toBe('失败');
    expect(resolveStudentPrivateProfileClassOverviewAttentionLabel('READY')).toBe('资料正常');
    expect(resolveStudentPrivateProfileClassOverviewAttentionLabel('MISSING_SNAPSHOT')).toBe(
      '未同步',
    );
    expect(resolveStudentPrivateProfileClassOverviewAttentionLabel('UPSTREAM_ID_MISSING')).toBe(
      '未关联学工系统',
    );
    expect(resolveStudentPrivateProfileClassOverviewAttentionColor('MANUAL_OVERRIDE')).toBe(
      'processing',
    );
    expect(resolveStudentPrivateProfileFamilyRelationshipLabel('3')).toBe('祖父母');
    expect(resolveStudentPrivateProfileFamilyRelationshipLabel('5')).toBe('关系代码 5');
    expect(resolveStudentPrivateProfileRecordChangeTypeLabel('10')).toBe('退学');
    expect(resolveStudentPrivateProfileRecordChangeTypeLabel('99')).toBe('未知类型（99）');
    expect(resolveStudentPrivateProfileWarningCodeLabel('PHOTO_BODY_SKIPPED')).toBe(
      '照片本体未随本次资料刷新返回',
    );
    expect(resolveStudentPrivateProfileWarningCodeLabel('UPSTREAM_EMPTY_FIELD')).toBe(
      '部分信息有缺失，可在班级概览详情中查看具体缺失项',
    );
    expect(resolveStudentPrivateProfileWarningCodeLabel('CLASS_PROJECTION_MISMATCH')).toBe(
      '当前班级信息与有效班级关系不一致，已按有效班级刷新',
    );
    expect(
      resolveStudentRegistrationCardGenerationCodeLabel('TERM_EVALUATION_COMMENT_MISSING'),
    ).toBe('存在学期评语缺失');
    expect(resolveStudentRegistrationCardGenerationCodeLabel('TERM_CONDUCT_GRADE_MISSING')).toBe(
      '存在学期操行缺失',
    );
    expect(resolveStudentRegistrationCardTermReadinessStatusLabel('INCOMPLETE')).toBe('存在缺失');
    expect(resolveStudentRegistrationCardTermMaterialStatusLabel('NOT_REQUIRED')).toBe('不要求');
    expect(formatStudentPrivateProfileBoolean(true)).toBe('是');
    expect(formatStudentPrivateProfileBoolean(null)).toBe('未返回');
  });
});
