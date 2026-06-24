// src/labs/student-private-profile/application/display-policy.spec.ts

import { describe, expect, it } from 'vitest';

import {
  formatStudentPrivateProfileBoolean,
  formatStudentPrivateProfileCompletenessStatus,
  resolveStudentPrivateProfileBatchStatusLabel,
  resolveStudentPrivateProfileCompareResultLabel,
  resolveStudentPrivateProfileFamilyFieldLabel,
  resolveStudentPrivateProfileFieldLabel,
  resolveStudentPrivateProfilePhotoStatusLabel,
  resolveStudentPrivateProfileSectionLabel,
  resolveStudentPrivateProfileSourceLabel,
  resolveStudentPrivateProfileStatusLabel,
} from './display-policy';

describe('student private profile display policy', () => {
  it('maps backend field and section keys to user-facing labels', () => {
    expect(resolveStudentPrivateProfileFieldLabel('STUDENT_PHONE')).toBe('学生手机号');
    expect(resolveStudentPrivateProfileFieldLabel('home-address')).toBe('家庭地址');
    expect(resolveStudentPrivateProfileFamilyFieldLabel('RELATIONSHIP_CODE')).toBe('家庭关系');
    expect(resolveStudentPrivateProfileSectionLabel('sensitive_identifiers')).toBe('证件与卡号');
    expect(resolveStudentPrivateProfileSectionLabel('unknown_section')).toBe('unknown_section');
  });

  it('maps backend source and status enums to stable-facing labels', () => {
    expect(resolveStudentPrivateProfileSourceLabel('UPSTREAM')).toBe('学工系统');
    expect(resolveStudentPrivateProfileSourceLabel('MANUAL')).toBe('人工修正');
    expect(resolveStudentPrivateProfileStatusLabel('OBSERVED')).toBe('已同步');
    expect(resolveStudentPrivateProfileStatusLabel('MISSING')).toBe('本地暂无');
    expect(resolveStudentPrivateProfileStatusLabel('ACTIVE')).toBe('在读');
    expect(formatStudentPrivateProfileCompletenessStatus(true)).toBe('已同步');
    expect(formatStudentPrivateProfileCompletenessStatus(false)).toBe('待同步');
  });

  it('maps action result enums without leaking raw contract terms', () => {
    expect(resolveStudentPrivateProfileCompareResultLabel('MATCH')).toBe('一致');
    expect(resolveStudentPrivateProfileCompareResultLabel('MISSING')).toBe('本地暂无可核验值');
    expect(resolveStudentPrivateProfilePhotoStatusLabel('CACHE_RETAINED')).toBe('使用本地缓存');
    expect(resolveStudentPrivateProfileBatchStatusLabel('FAILED')).toBe('失败');
    expect(formatStudentPrivateProfileBoolean(true)).toBe('是');
    expect(formatStudentPrivateProfileBoolean(null)).toBe('未返回');
  });
});
