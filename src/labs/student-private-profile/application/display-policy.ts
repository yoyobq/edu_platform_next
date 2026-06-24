// src/labs/student-private-profile/application/display-policy.ts

import type {
  StudentPrivateProfileBatchRefreshItem,
  StudentPrivateProfileCompareField,
  StudentPrivateProfileCompareResult,
  StudentPrivateProfileFamilyMemberPatchField,
  StudentPrivateProfileManualPatchField,
  StudentPrivateProfilePhotoReadResult,
  StudentPrivateProfileSummary,
} from '../api';

export const STUDENT_PRIVATE_PROFILE_COMPARE_FIELD_OPTIONS: {
  label: string;
  value: StudentPrivateProfileCompareField;
}[] = [
  { label: '身份证号', value: 'ID_CARD' },
  { label: '银行卡号', value: 'BANK_CARD_NUMBER' },
  { label: '校园卡号', value: 'CARD_NUMBER' },
  { label: '学生手机号', value: 'STUDENT_PHONE' },
  { label: '联系人手机号', value: 'CONTACT_PERSON_PHONE' },
];

export const STUDENT_PRIVATE_PROFILE_PATCH_FIELD_OPTIONS: {
  label: string;
  value: StudentPrivateProfileManualPatchField;
}[] = [
  ...STUDENT_PRIVATE_PROFILE_COMPARE_FIELD_OPTIONS,
  { label: '家庭地址', value: 'HOME_ADDRESS' },
  { label: '通讯地址', value: 'MAILING_ADDRESS' },
];

export const STUDENT_PRIVATE_PROFILE_FAMILY_PATCH_FIELD_OPTIONS: {
  label: string;
  value: StudentPrivateProfileFamilyMemberPatchField;
}[] = [
  { label: '家庭关系', value: 'RELATIONSHIP_CODE' },
  { label: '姓名', value: 'NAME' },
  { label: '电话', value: 'PHONE' },
  { label: '工作单位', value: 'WORKPLACE' },
];

export const STUDENT_PRIVATE_PROFILE_COMPLETENESS_ITEMS: {
  key: keyof StudentPrivateProfileSummary['profileCompletenessFlags'];
  label: string;
}[] = [
  { key: 'personalObserved', label: '个人基础资料' },
  { key: 'sensitiveIdentifiersObserved', label: '证件与卡号' },
  { key: 'photoObserved', label: '照片' },
  { key: 'familyObserved', label: '家庭信息' },
  { key: 'educationObserved', label: '教育经历' },
  { key: 'recordObserved', label: '学籍异动' },
];

export const STUDENT_PRIVATE_PROFILE_FIELD_ORDER = new Map(
  STUDENT_PRIVATE_PROFILE_PATCH_FIELD_OPTIONS.map((item, index) => [item.value, index]),
);

const FIELD_LABELS = new Map<string, string>(
  STUDENT_PRIVATE_PROFILE_PATCH_FIELD_OPTIONS.map((item) => [item.value, item.label]),
);

const FAMILY_FIELD_LABELS = new Map<string, string>(
  STUDENT_PRIVATE_PROFILE_FAMILY_PATCH_FIELD_OPTIONS.map((item) => [item.value, item.label]),
);

const SECTION_LABELS = new Map<string, string>([
  ['PERSONAL', '个人基础资料'],
  ['SENSITIVE_IDENTIFIERS', '证件与卡号'],
  ['PHOTO', '照片'],
  ['FAMILY', '家庭信息'],
  ['EDUCATION', '教育经历'],
  ['RECORD', '学籍异动'],
  ['PERSONAL_PROFILE', '个人基础资料'],
  ['PRIVATE_PROFILE', '个人资料'],
]);

const SOURCE_LABELS = new Map<string, string>([
  ['UPSTREAM', '学工系统'],
  ['MANUAL', '人工修正'],
  ['LOCAL', '本地快照'],
  ['CACHE', '本地缓存'],
  ['SYSTEM', '系统生成'],
]);

const STATUS_LABELS = new Map<string, string>([
  ['PRESENT', '本地已有'],
  ['MISSING', '本地暂无'],
  ['OBSERVED', '已同步'],
  ['UNOBSERVED', '待同步'],
  ['CACHE_RETAINED', '使用本地缓存'],
  ['INVALID', '不可用'],
  ['SUCCESS', '成功'],
  ['FAILED', '失败'],
  ['ACTIVE', '在读'],
  ['INACTIVE', '非在读'],
  ['GRADUATED', '已毕业'],
  ['SUSPENDED', '休学'],
]);

const COMPARE_RESULT_LABELS: Record<
  StudentPrivateProfileCompareResult['results'][number]['result'],
  string
> = {
  MATCH: '一致',
  MISMATCH: '不一致',
  MISSING: '本地暂无可核验值',
};

const PHOTO_STATUS_LABELS: Record<StudentPrivateProfilePhotoReadResult['photoStatus'], string> = {
  CACHE_RETAINED: '使用本地缓存',
  INVALID: '照片不可用',
  MISSING: '暂无照片',
  PRESENT: '已读取照片',
};

const BATCH_STATUS_LABELS: Record<StudentPrivateProfileBatchRefreshItem['status'], string> = {
  FAILED: '失败',
  SUCCESS: '成功',
};

function normalizeDisplayKey(value: string) {
  return value.trim().replaceAll('-', '_').toUpperCase();
}

export function resolveStudentPrivateProfileFieldLabel(fieldKey: string) {
  return FIELD_LABELS.get(normalizeDisplayKey(fieldKey)) ?? fieldKey;
}

export function resolveStudentPrivateProfileFamilyFieldLabel(fieldKey: string) {
  return FAMILY_FIELD_LABELS.get(normalizeDisplayKey(fieldKey)) ?? fieldKey;
}

export function resolveStudentPrivateProfileSectionLabel(section: string) {
  return SECTION_LABELS.get(normalizeDisplayKey(section)) ?? section;
}

export function resolveStudentPrivateProfileSourceLabel(source: string) {
  return SOURCE_LABELS.get(normalizeDisplayKey(source)) ?? source;
}

export function resolveStudentPrivateProfileStatusLabel(status: string) {
  return STATUS_LABELS.get(normalizeDisplayKey(status)) ?? status;
}

export function resolveStudentPrivateProfileCompareResultLabel(
  result: StudentPrivateProfileCompareResult['results'][number]['result'],
) {
  return COMPARE_RESULT_LABELS[result];
}

export function resolveStudentPrivateProfilePhotoStatusLabel(
  status: StudentPrivateProfilePhotoReadResult['photoStatus'],
) {
  return PHOTO_STATUS_LABELS[status];
}

export function resolveStudentPrivateProfileBatchStatusLabel(
  status: StudentPrivateProfileBatchRefreshItem['status'],
) {
  return BATCH_STATUS_LABELS[status];
}

export function resolveStudentPrivateProfileCompareResultColor(
  result: StudentPrivateProfileCompareResult['results'][number]['result'],
) {
  if (result === 'MATCH') {
    return 'success';
  }

  if (result === 'MISMATCH') {
    return 'error';
  }

  return 'warning';
}

export function resolveStudentPrivateProfileSourceColor(source: string) {
  if (normalizeDisplayKey(source) === 'MANUAL') {
    return 'processing';
  }

  if (normalizeDisplayKey(source) === 'UPSTREAM') {
    return 'success';
  }

  return 'default';
}

export function resolveStudentPrivateProfileStatusColor(status: string) {
  const normalizedStatus = normalizeDisplayKey(status);

  if (
    normalizedStatus === 'PRESENT' ||
    normalizedStatus === 'OBSERVED' ||
    normalizedStatus === 'SUCCESS'
  ) {
    return 'success';
  }

  if (normalizedStatus === 'MISSING' || normalizedStatus === 'UNOBSERVED') {
    return 'warning';
  }

  if (normalizedStatus === 'FAILED' || normalizedStatus === 'INVALID') {
    return 'error';
  }

  return 'default';
}

export function resolveStudentPrivateProfilePhotoStatusColor(
  status: StudentPrivateProfilePhotoReadResult['photoStatus'],
) {
  if (status === 'PRESENT') {
    return 'success';
  }

  if (status === 'CACHE_RETAINED') {
    return 'processing';
  }

  if (status === 'MISSING') {
    return 'warning';
  }

  return 'error';
}

export function resolveStudentPrivateProfileBatchStatusColor(
  status: StudentPrivateProfileBatchRefreshItem['status'],
) {
  return status === 'SUCCESS' ? 'success' : 'error';
}

export function formatStudentPrivateProfileCompletenessStatus(value: boolean) {
  return value ? '已同步' : '待同步';
}

export function formatStudentPrivateProfileBoolean(value: boolean | null | undefined) {
  if (value === null || value === undefined) {
    return '未返回';
  }

  return value ? '是' : '否';
}
