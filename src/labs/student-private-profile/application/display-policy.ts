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

const SUMMARY_FIELD_LABELS: readonly { label: string; value: string }[] = [
  { label: '性别', value: 'gender' },
  { label: '出生日期', value: 'birthday' },
  { label: '政治面貌', value: 'politicalStatus' },
  { label: '学籍号', value: 'studentRecordNumber' },
  { label: '家庭地址', value: 'homeAddress' },
  { label: '通讯地址', value: 'mailingAddress' },
  { label: '身份证号', value: 'idCard' },
  { label: '银行卡号', value: 'bankCardNumber' },
  { label: '校园卡号', value: 'cardNumber' },
  { label: '学生手机号', value: 'studentPhone' },
  { label: '联系人手机号', value: 'contactPersonPhone' },
];

const SUMMARY_FIELD_ORDER = [
  'gender',
  'birthday',
  'politicalStatus',
  'studentRecordNumber',
  'homeAddress',
  'mailingAddress',
  'idCard',
  'bankCardNumber',
  'cardNumber',
  'studentPhone',
  'contactPersonPhone',
];

const FIELD_ORDER_BY_KEY = new Map(
  SUMMARY_FIELD_ORDER.map((fieldKey, index) => [normalizeDisplayKey(fieldKey), index]),
);

const FIELD_LABELS = new Map<string, string>(
  [
    ...SUMMARY_FIELD_LABELS,
    ...STUDENT_PRIVATE_PROFILE_PATCH_FIELD_OPTIONS,
    ...STUDENT_PRIVATE_PROFILE_COMPARE_FIELD_OPTIONS,
  ].map((item) => [normalizeDisplayKey(item.value), item.label]),
);

const FAMILY_FIELD_LABELS = new Map<string, string>(
  STUDENT_PRIVATE_PROFILE_FAMILY_PATCH_FIELD_OPTIONS.map((item) => [
    normalizeDisplayKey(item.value),
    item.label,
  ]),
);

const SECTION_LABELS = new Map<string, string>([
  ['PERSONAL', '个人基础资料'],
  ['SENSITIVE_IDENTIFIERS', '证件与卡号'],
  ['PHOTO_META', '照片'],
  ['PHOTO', '照片'],
  ['FAMILY', '家庭信息'],
  ['EDUCATION', '教育经历'],
  ['RECORD', '学籍异动'],
  ['EDUCATION_RESUME', '教育经历'],
  ['STATUS_CHANGE', '学籍异动'],
  ['PERSONAL_PROFILE', '个人基础资料'],
  ['PRIVATE_PROFILE', '个人资料'],
]);

const SOURCE_LABELS = new Map<string, string>([
  ['UPSTREAM', '学工系统'],
  ['CALCULATED', '系统推断'],
  ['MANUAL', '人工修正'],
  ['LOCAL', '本地快照'],
  ['CACHE', '本地缓存'],
  ['SYSTEM', '系统生成'],
]);

const STATUS_LABELS = new Map<string, string>([
  ['PRESENT', '本地已有'],
  ['MISSING', '本地暂无'],
  ['OBSERVED', '已同步'],
  ['PARTIAL', '部分同步'],
  ['UNOBSERVED', '待同步'],
  ['CACHE_RETAINED', '使用本地缓存'],
  ['INVALID', '不可用'],
  ['SUCCESS', '成功'],
  ['FAILED', '失败'],
  ['PRE_REGISTERED', '预报到'],
  ['NOT_CHECKED_IN', '确认未报到'],
  ['ENROLLED', '在读'],
  ['OFF_CAMPUS_INTERNSHIP', '下厂/校外实习'],
  ['ACTIVE', '在读'],
  ['ENDED', '已结束'],
  ['GRADUATED', '已毕业'],
  ['SUSPENDED', '暂离（休学/兵役等）'],
  ['DROPPED', '退学'],
]);

const FAMILY_RELATIONSHIP_LABELS = new Map<string, string>([
  ['1', '父亲'],
  ['2', '母亲'],
  ['3', '祖父母'],
  ['4', '兄弟姐妹'],
]);

const RECORD_CHANGE_TYPE_LABELS = new Map<string, string>([
  ['1', '学籍生成'],
  ['2', '学籍变更'],
  ['10', '退学'],
  ['20', '休学'],
  ['30', '留级'],
  ['40', '复学'],
]);

const WARNING_CODE_LABELS = new Map<string, string>([
  ['CLASS_PROJECTION_MISMATCH', '当前班级信息与有效班级关系不一致，已按有效班级刷新'],
  ['IDCARD_DERIVED_CONFLICT', '身份证推导信息与上游字段不一致'],
  ['PHOTO_INVALID_BASE64', '照片数据格式异常'],
  ['PHOTO_BODY_SKIPPED', '照片本体未随本次资料刷新返回'],
  ['PHOTO_MISSING', '学工系统暂无照片'],
  ['PHOTO_PROCESS_FAILED', '照片处理失败'],
  ['PHOTO_STORAGE_LIMIT_EXCEEDED', '照片超过本地存储安全上限'],
  ['PHOTO_TARGET_SIZE_EXCEEDED', '照片超过处理尺寸上限'],
  ['PHOTO_UNSUPPORTED_MIME', '照片格式暂不支持'],
  ['UPSTREAM_INVALID_FIELD', '学工系统字段格式异常'],
  ['UPSTREAM_EMPTY_FIELD', '学工系统字段为空'],
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
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replaceAll('-', '_')
    .toUpperCase();
}

export function resolveStudentPrivateProfileFieldLabel(fieldKey: string) {
  return FIELD_LABELS.get(normalizeDisplayKey(fieldKey)) ?? fieldKey;
}

export function normalizeStudentPrivateProfileFieldKey(fieldKey: string) {
  return normalizeDisplayKey(fieldKey);
}

export function resolveStudentPrivateProfileFieldOrder(fieldKey: string) {
  return FIELD_ORDER_BY_KEY.get(normalizeDisplayKey(fieldKey)) ?? 999;
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

export function resolveStudentPrivateProfileFamilyRelationshipLabel(relationshipCode: string) {
  const trimmedCode = relationshipCode.trim();

  return FAMILY_RELATIONSHIP_LABELS.get(trimmedCode) ?? `关系代码 ${trimmedCode}`;
}

export function resolveStudentPrivateProfileRecordChangeTypeLabel(studentNoTypeCode: string) {
  const trimmedCode = studentNoTypeCode.trim();

  return RECORD_CHANGE_TYPE_LABELS.get(trimmedCode) ?? `未知类型（${trimmedCode}）`;
}

export function resolveStudentPrivateProfileWarningCodeLabel(code: string) {
  return WARNING_CODE_LABELS.get(normalizeDisplayKey(code)) ?? code;
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
    normalizedStatus === 'ENROLLED' ||
    normalizedStatus === 'ACTIVE' ||
    normalizedStatus === 'SUCCESS'
  ) {
    return 'success';
  }

  if (
    normalizedStatus === 'MISSING' ||
    normalizedStatus === 'UNOBSERVED' ||
    normalizedStatus === 'PARTIAL' ||
    normalizedStatus === 'PRE_REGISTERED' ||
    normalizedStatus === 'OFF_CAMPUS_INTERNSHIP'
  ) {
    return 'warning';
  }

  if (
    normalizedStatus === 'FAILED' ||
    normalizedStatus === 'INVALID' ||
    normalizedStatus === 'NOT_CHECKED_IN' ||
    normalizedStatus === 'DROPPED'
  ) {
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
