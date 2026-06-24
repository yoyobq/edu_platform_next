// src/labs/student-private-profile/application/display-policy.spec.ts

import { describe, expect, it } from 'vitest';

import {
  formatStudentPrivateProfileBoolean,
  formatStudentPrivateProfileCompletenessStatus,
  normalizeStudentPrivateProfileFieldKey,
  resolveStudentPrivateProfileBatchStatusLabel,
  resolveStudentPrivateProfileCompareResultLabel,
  resolveStudentPrivateProfileFamilyFieldLabel,
  resolveStudentPrivateProfileFamilyRelationshipLabel,
  resolveStudentPrivateProfileFieldLabel,
  resolveStudentPrivateProfileFieldOrder,
  resolveStudentPrivateProfilePhotoStatusLabel,
  resolveStudentPrivateProfileRecordChangeTypeLabel,
  resolveStudentPrivateProfileSectionLabel,
  resolveStudentPrivateProfileSourceLabel,
  resolveStudentPrivateProfileStatusLabel,
  resolveStudentPrivateProfileWarningCodeLabel,
} from './display-policy';

describe('student private profile display policy', () => {
  it('maps backend field and section keys to user-facing labels', () => {
    expect(resolveStudentPrivateProfileFieldLabel('STUDENT_PHONE')).toBe('学生手机号');
    expect(resolveStudentPrivateProfileFieldLabel('studentPhone')).toBe('学生手机号');
    expect(resolveStudentPrivateProfileFieldLabel('politicalStatus')).toBe('政治面貌');
    expect(resolveStudentPrivateProfileFieldLabel('home-address')).toBe('家庭地址');
    expect(normalizeStudentPrivateProfileFieldKey('idCard')).toBe('ID_CARD');
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
    expect(resolveStudentPrivateProfileFamilyRelationshipLabel('3')).toBe('祖父母');
    expect(resolveStudentPrivateProfileFamilyRelationshipLabel('5')).toBe('关系代码 5');
    expect(resolveStudentPrivateProfileRecordChangeTypeLabel('10')).toBe('退学');
    expect(resolveStudentPrivateProfileRecordChangeTypeLabel('99')).toBe('未知类型（99）');
    expect(resolveStudentPrivateProfileWarningCodeLabel('PHOTO_BODY_SKIPPED')).toBe(
      '照片本体未随本次资料刷新返回',
    );
    expect(resolveStudentPrivateProfileWarningCodeLabel('CLASS_PROJECTION_MISMATCH')).toBe(
      '当前班级信息与有效班级关系不一致，已按有效班级刷新',
    );
    expect(formatStudentPrivateProfileBoolean(true)).toBe('是');
    expect(formatStudentPrivateProfileBoolean(null)).toBe('未返回');
  });
});
