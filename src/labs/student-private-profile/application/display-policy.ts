// src/labs/student-private-profile/application/display-policy.ts

import type {
  StudentPrivateProfileBatchRefreshItem,
  StudentPrivateProfileClassOverviewAttentionLevel,
  StudentPrivateProfileCompareField,
  StudentPrivateProfileCompareResult,
  StudentPrivateProfileFamilyMemberPatchField,
  StudentPrivateProfileGovernanceMissingSection,
  StudentPrivateProfileGovernanceReadinessIssueCode,
  StudentPrivateProfileGovernanceReadinessStatus,
  StudentPrivateProfileManualPatchField,
  StudentPrivateProfilePhotoReadResult,
  StudentPrivateProfileSummary,
  StudentPrivateProfileSupplementTemplateCode,
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

const COMPARE_FIELD_KEYS = new Set<string>(
  STUDENT_PRIVATE_PROFILE_COMPARE_FIELD_OPTIONS.map((item) => normalizeDisplayKey(item.value)),
);

const MANUAL_PATCH_FIELD_KEYS = new Set<string>(
  STUDENT_PRIVATE_PROFILE_PATCH_FIELD_OPTIONS.map((item) => normalizeDisplayKey(item.value)),
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
  ['PRESENT', '有记录'],
  ['MISSING', '暂无记录'],
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
  ['UPSTREAM_EMPTY_FIELD', '部分信息有缺失，可在班级概览详情中查看具体缺失项'],
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

const CLASS_OVERVIEW_ATTENTION_LABELS: Record<
  StudentPrivateProfileClassOverviewAttentionLevel,
  string
> = {
  INCOMPLETE: '资料不完整',
  MANUAL_OVERRIDE: '已人工修正',
  MISSING_SNAPSHOT: '未同步',
  READY: '资料正常',
  UPSTREAM_ID_MISSING: '未关联学工系统',
  WARNING: '存在提醒',
};

export const STUDENT_PRIVATE_PROFILE_CLASS_OVERVIEW_ATTENTION_FILTERS = Object.entries(
  CLASS_OVERVIEW_ATTENTION_LABELS,
).map(([value, text]) => ({
  text,
  value,
}));

const GOVERNANCE_READINESS_STATUS_LABELS: Record<
  StudentPrivateProfileGovernanceReadinessStatus,
  string
> = {
  BLOCKED: '阻塞',
  READY: '可治理',
  WARNING: '需关注',
};

const GOVERNANCE_READINESS_ISSUE_LABELS: Record<
  StudentPrivateProfileGovernanceReadinessIssueCode,
  string
> = {
  COURSE_RESULT_SNAPSHOT_MISSING: '缺成绩快照',
  EDUCATION_MISSING: '缺教育经历',
  FAMILY_MISSING: '缺家庭信息',
  MANUAL_OVERRIDE_ACTIVE: '存在人工修正',
  PERSONAL_MISSING: '缺个人基础资料',
  PHOTO_MISSING: '缺照片',
  PRIVATE_PROFILE_SNAPSHOT_MISSING: '缺本地资料快照',
  PRIVATE_PROFILE_WARNING: '资料快照有提醒',
  RECORD_MISSING: '缺学籍异动',
  SENSITIVE_IDENTIFIERS_MISSING: '缺证件与卡号',
  UPSTREAM_CHANGED_SINCE_MANUAL_PATCH: '上游变化待复核',
  UPSTREAM_ID_MISSING: '未关联学工系统',
};

const GOVERNANCE_MISSING_SECTION_LABELS: Record<
  StudentPrivateProfileGovernanceMissingSection,
  string
> = {
  courseResult: '成绩快照',
  education: '教育经历',
  family: '家庭信息',
  personal: '个人基础资料',
  photo: '照片',
  record: '学籍异动',
  sensitiveIdentifiers: '证件与卡号',
};

const SUPPLEMENT_TEMPLATE_LABELS: Record<StudentPrivateProfileSupplementTemplateCode, string> = {
  STUDENT_PRIVATE_PROFILE_EDUCATION_SUPPLEMENT: '教育经历补录',
  STUDENT_PRIVATE_PROFILE_FAMILY_SUPPLEMENT: '家庭成员补录',
};

const SUPPLEMENT_DRY_RUN_STATUS_LABELS = new Map<string, string>([
  ['READY', '校验通过'],
  ['BLOCKED', '存在阻塞'],
]);

const SUPPLEMENT_DRY_RUN_ROW_STATUS_LABELS = new Map<string, string>([
  ['VALID', '有效'],
  ['INVALID', '无效'],
  ['SKIPPED', '已跳过'],
]);

const SUPPLEMENT_DRY_RUN_ISSUE_LABELS = new Map<string, string>([
  ['REQUIRED_CELL_EMPTY', '必填单元格为空'],
  ['ACTION_NOT_SUPPORTED', '动作不支持'],
  ['STUDENT_NOT_FOUND', '学生不存在'],
  ['ACTIVE_MEMBERSHIP_NOT_FOUND', '缺少有效班级关系'],
  ['CLASS_NOT_FOUND', '班级不存在'],
  ['UPSTREAM_ID_MISSING', '未关联学工系统'],
  ['ACCESS_DENIED', '无权处理该学生'],
  ['SNAPSHOT_NOT_FOUND', '缺少本地资料快照'],
  ['SECTION_BASELINE_CONFLICT', 'section baseline 已过期'],
  ['ITEM_KEY_REQUIRED', '缺少行标识'],
  ['ITEM_NOT_FOUND', '补录行不存在'],
  ['ROW_BASELINE_REQUIRED', '缺少行级 baseline'],
  ['ROW_BASELINE_CONFLICT', '行级 baseline 已过期'],
  ['RELATIONSHIP_CODE_UNSUPPORTED', '家庭关系 code 不支持'],
  ['DATE_INVALID', '日期格式非法'],
  ['DATE_RANGE_INVALID', '日期范围非法'],
  ['DUPLICATE_ROW', '重复补录行'],
]);

export const STUDENT_PRIVATE_PROFILE_SUPPLEMENT_TEMPLATE_OPTIONS = Object.entries(
  SUPPLEMENT_TEMPLATE_LABELS,
).map(([value, label]) => ({
  label,
  value,
}));

export const STUDENT_PRIVATE_PROFILE_GOVERNANCE_READINESS_STATUS_FILTERS = Object.entries(
  GOVERNANCE_READINESS_STATUS_LABELS,
).map(([value, text]) => ({
  text,
  value,
}));

export const STUDENT_PRIVATE_PROFILE_GOVERNANCE_READINESS_ISSUE_FILTERS = Object.entries(
  GOVERNANCE_READINESS_ISSUE_LABELS,
).map(([value, text]) => ({
  text,
  value,
}));

export const STUDENT_PRIVATE_PROFILE_GOVERNANCE_MISSING_SECTION_FILTERS = Object.entries(
  GOVERNANCE_MISSING_SECTION_LABELS,
).map(([value, text]) => ({
  text,
  value,
}));

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

export function resolveStudentPrivateProfileCompareField(
  fieldKey: string,
): StudentPrivateProfileCompareField | null {
  const normalizedFieldKey = normalizeDisplayKey(fieldKey);

  return COMPARE_FIELD_KEYS.has(normalizedFieldKey)
    ? (normalizedFieldKey as StudentPrivateProfileCompareField)
    : null;
}

export function resolveStudentPrivateProfileManualPatchField(
  fieldKey: string,
): StudentPrivateProfileManualPatchField | null {
  const normalizedFieldKey = normalizeDisplayKey(fieldKey);

  return MANUAL_PATCH_FIELD_KEYS.has(normalizedFieldKey)
    ? (normalizedFieldKey as StudentPrivateProfileManualPatchField)
    : null;
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

export function resolveStudentPrivateProfileClassOverviewAttentionLabel(
  attentionLevel: StudentPrivateProfileClassOverviewAttentionLevel,
) {
  return CLASS_OVERVIEW_ATTENTION_LABELS[attentionLevel];
}

export function resolveStudentPrivateProfileGovernanceReadinessStatusLabel(
  status: StudentPrivateProfileGovernanceReadinessStatus,
) {
  return GOVERNANCE_READINESS_STATUS_LABELS[status];
}

export function resolveStudentPrivateProfileGovernanceReadinessIssueLabel(
  issueCode: StudentPrivateProfileGovernanceReadinessIssueCode,
) {
  return GOVERNANCE_READINESS_ISSUE_LABELS[issueCode];
}

export function resolveStudentPrivateProfileGovernanceMissingSectionLabel(
  section: StudentPrivateProfileGovernanceMissingSection,
) {
  return GOVERNANCE_MISSING_SECTION_LABELS[section];
}

export function resolveStudentPrivateProfileSupplementTemplateLabel(
  templateCode: StudentPrivateProfileSupplementTemplateCode,
) {
  return SUPPLEMENT_TEMPLATE_LABELS[templateCode];
}

export function resolveStudentPrivateProfileSupplementDryRunStatusLabel(status: string) {
  return SUPPLEMENT_DRY_RUN_STATUS_LABELS.get(normalizeDisplayKey(status)) ?? status;
}

export function resolveStudentPrivateProfileSupplementDryRunRowStatusLabel(status: string) {
  return SUPPLEMENT_DRY_RUN_ROW_STATUS_LABELS.get(normalizeDisplayKey(status)) ?? status;
}

export function resolveStudentPrivateProfileSupplementDryRunIssueLabel(code: string) {
  return SUPPLEMENT_DRY_RUN_ISSUE_LABELS.get(normalizeDisplayKey(code)) ?? code;
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

export function resolveStudentPrivateProfileClassOverviewAttentionColor(
  attentionLevel: StudentPrivateProfileClassOverviewAttentionLevel,
) {
  if (attentionLevel === 'READY') {
    return 'success';
  }

  if (attentionLevel === 'MANUAL_OVERRIDE') {
    return 'processing';
  }

  if (attentionLevel === 'UPSTREAM_ID_MISSING') {
    return 'error';
  }

  return 'warning';
}

export function resolveStudentPrivateProfileGovernanceReadinessStatusColor(
  status: StudentPrivateProfileGovernanceReadinessStatus,
) {
  if (status === 'READY') {
    return 'success';
  }

  if (status === 'BLOCKED') {
    return 'error';
  }

  return 'warning';
}

export function resolveStudentPrivateProfileSupplementDryRunStatusColor(status: string) {
  return normalizeDisplayKey(status) === 'READY' ? 'success' : 'error';
}

export function resolveStudentPrivateProfileSupplementDryRunRowStatusColor(status: string) {
  const normalizedStatus = normalizeDisplayKey(status);

  if (normalizedStatus === 'VALID') {
    return 'success';
  }

  if (normalizedStatus === 'SKIPPED') {
    return 'warning';
  }

  return 'error';
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
