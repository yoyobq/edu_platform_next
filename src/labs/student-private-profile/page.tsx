// src/labs/student-private-profile/page.tsx

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircleOutlined,
  ClearOutlined,
  CloudSyncOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FileSearchOutlined,
  LoginOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Collapse,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Image,
  Input,
  Modal,
  Progress,
  Radio,
  Segmented,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLoaderData } from 'react-router';

import {
  formatUpstreamSessionDateTime,
  type StoredUpstreamSession,
  type UpstreamAccountIdentity,
  UpstreamLoginModal,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';
import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

import {
  formatStudentPrivateProfileBoolean,
  formatStudentPrivateProfileCompletenessStatus,
  resolveStudentPrivateProfileBatchStatusColor,
  resolveStudentPrivateProfileBatchStatusLabel,
  resolveStudentPrivateProfileClassOverviewAttentionColor,
  resolveStudentPrivateProfileClassOverviewAttentionLabel,
  resolveStudentPrivateProfileCompareField,
  resolveStudentPrivateProfileCompareResultColor,
  resolveStudentPrivateProfileCompareResultLabel,
  resolveStudentPrivateProfileFamilyFieldLabel,
  resolveStudentPrivateProfileFamilyRelationshipLabel,
  resolveStudentPrivateProfileFieldLabel,
  resolveStudentPrivateProfileFieldOrder,
  resolveStudentPrivateProfileGovernanceMissingSectionLabel,
  resolveStudentPrivateProfileGovernanceReadinessIssueLabel,
  resolveStudentPrivateProfileGovernanceReadinessStatusColor,
  resolveStudentPrivateProfileGovernanceReadinessStatusLabel,
  resolveStudentPrivateProfileManualPatchField,
  resolveStudentPrivateProfilePhotoStatusColor,
  resolveStudentPrivateProfilePhotoStatusLabel,
  resolveStudentPrivateProfileRecordChangeTypeLabel,
  resolveStudentPrivateProfileSectionLabel,
  resolveStudentPrivateProfileSourceColor,
  resolveStudentPrivateProfileSourceLabel,
  resolveStudentPrivateProfileStatusColor,
  resolveStudentPrivateProfileStatusLabel,
  resolveStudentPrivateProfileSupplementAuditPolicyLabel,
  resolveStudentPrivateProfileSupplementColumnMappingStatusColor,
  resolveStudentPrivateProfileSupplementColumnMappingStatusLabel,
  resolveStudentPrivateProfileSupplementDestinationLabel,
  resolveStudentPrivateProfileSupplementDryRunIssueLabel,
  resolveStudentPrivateProfileSupplementDryRunRowStatusColor,
  resolveStudentPrivateProfileSupplementDryRunRowStatusLabel,
  resolveStudentPrivateProfileSupplementDryRunStatusColor,
  resolveStudentPrivateProfileSupplementDryRunStatusLabel,
  resolveStudentPrivateProfileSupplementModeLabel,
  resolveStudentPrivateProfileSupplementTemplateLabel,
  resolveStudentPrivateProfileWarningCodeLabel,
  STUDENT_PRIVATE_PROFILE_CLASS_OVERVIEW_ATTENTION_FILTERS,
  STUDENT_PRIVATE_PROFILE_COMPLETENESS_ITEMS,
  STUDENT_PRIVATE_PROFILE_FAMILY_PATCH_FIELD_OPTIONS,
  STUDENT_PRIVATE_PROFILE_GOVERNANCE_MISSING_SECTION_FILTERS,
  STUDENT_PRIVATE_PROFILE_GOVERNANCE_READINESS_ISSUE_FILTERS,
  STUDENT_PRIVATE_PROFILE_GOVERNANCE_READINESS_STATUS_FILTERS,
  STUDENT_PRIVATE_PROFILE_SUPPLEMENT_MODE_OPTIONS,
  STUDENT_PRIVATE_PROFILE_SUPPLEMENT_TEMPLATE_OPTIONS,
} from './application/display-policy';
import {
  compareStudentPrivateProfileFields,
  downloadStudentPrivateProfileSupplementTemplateWorkbook,
  dryRunStudentPrivateProfileSupplement,
  getStudentPrivateProfileClassOverview,
  getStudentPrivateProfileGovernanceReadinessPreflight,
  getStudentPrivateProfilePreview,
  getStudentPrivateProfileSummary,
  getStudentPrivateProfileSupplementTemplate,
  isExpiredUpstreamSessionError,
  isStudentPrivateProfileUpstreamSessionRequiredError,
  listStudentPrivateProfileClassOptions,
  listStudentPrivateProfileClassStudentOptions,
  normalizeStudentPrivateProfileStudentId,
  patchStudentPrivateProfileFamilyMembers,
  patchStudentPrivateProfileFields,
  readStudentPrivateProfilePhoto,
  readUpstreamGraphQLErrorDetail,
  refreshStudentPrivateProfileFromUpstream,
  refreshStudentPrivateProfilesFromUpstream,
  resolveUpstreamErrorMessage,
  type StudentPrivateProfileBatchRefreshItem,
  type StudentPrivateProfileBatchRefreshResult,
  type StudentPrivateProfileClassOption,
  type StudentPrivateProfileClassOverview,
  type StudentPrivateProfileClassOverviewSectionStatus,
  type StudentPrivateProfileClassOverviewStudent,
  type StudentPrivateProfileCompareField,
  type StudentPrivateProfileCompareResult,
  type StudentPrivateProfileCompletenessFlags,
  type StudentPrivateProfileFamilyMemberPatchField,
  type StudentPrivateProfileGovernanceReadinessPreflight,
  type StudentPrivateProfileGovernanceReadinessStudent,
  type StudentPrivateProfileManualPatchAction,
  type StudentPrivateProfileManualPatchField,
  type StudentPrivateProfilePhotoReadResult,
  type StudentPrivateProfilePreview,
  type StudentPrivateProfilePreviewEducationResume,
  type StudentPrivateProfilePreviewFamilyMember,
  type StudentPrivateProfilePreviewField,
  type StudentPrivateProfilePreviewRecordChange,
  type StudentPrivateProfileRefreshResult,
  type StudentPrivateProfileStudentOption,
  type StudentPrivateProfileSummary,
  type StudentPrivateProfileSummaryEducationResume,
  type StudentPrivateProfileSummaryFamilyMember,
  type StudentPrivateProfileSummaryField,
  type StudentPrivateProfileSummaryRecordChange,
  type StudentPrivateProfileSupplementDryRunColumnMapping,
  type StudentPrivateProfileSupplementDryRunFileIssue,
  type StudentPrivateProfileSupplementDryRunResult,
  type StudentPrivateProfileSupplementDryRunRow,
  type StudentPrivateProfileSupplementMode,
  type StudentPrivateProfileSupplementTemplate,
  type StudentPrivateProfileSupplementTemplateCode,
  type StudentPrivateProfileSupplementTemplateColumn,
  type StudentPrivateProfileSupplementUploadResult,
  uploadStudentPrivateProfileSupplementFile,
  type WriteStudentPrivateProfileEducationResumeToUpstreamInput,
  writeStudentPrivateProfileEducationToUpstream,
  type WriteStudentPrivateProfileFamilyMemberToUpstreamInput,
  writeStudentPrivateProfileFamilyToUpstream,
  type WriteStudentPrivateProfileSectionToUpstreamResult,
} from './api';

type LoadSummaryOptions = {
  preserveRefreshResult?: boolean;
};

type StudentPrivateProfileLabLoaderData = {
  currentAccount: UpstreamAccountIdentity;
  lockedUpstreamLoginUserId: string | null;
  manualPatchAccess: StudentPrivateProfileManualPatchAccess;
};

type UpstreamPendingAction =
  | {
      studentId: string;
      type: 'refresh';
    }
  | {
      forceRefresh: boolean;
      studentId: string;
      type: 'photo';
    }
  | {
      classId: string | null;
      studentIds: string[];
      type: 'batch-refresh';
    }
  | {
      expectedSectionBaselineToken: string;
      member: WriteStudentPrivateProfileFamilyMemberToUpstreamInput;
      studentId: string;
      type: 'family-write-through';
    }
  | {
      expectedSectionBaselineToken: string;
      resume: WriteStudentPrivateProfileEducationResumeToUpstreamInput;
      studentId: string;
      type: 'education-write-through';
    };

type StudentPrivateProfileLabTabKey = 'detail' | 'overview' | 'readiness' | 'supplement' | 'sync';

type ControlledBatchRefreshResult = StudentPrivateProfileBatchRefreshResult & {
  completedChunks: number;
  totalChunks: number;
  traceIds: string[];
};

type StudentPrivateProfileManualPatchAccess = {
  contactAndAddress: boolean;
  family: boolean;
  sensitiveIdentifiers: boolean;
};

const EMPTY_MANUAL_PATCH_ACCESS: StudentPrivateProfileManualPatchAccess = {
  contactAndAddress: false,
  family: false,
  sensitiveIdentifiers: false,
};

type CompareFormValues = {
  candidateValue?: string;
};

type PatchFormValues = {
  action?: StudentPrivateProfileManualPatchAction;
  value?: string;
};

type FamilyPatchFormValues = {
  action?: StudentPrivateProfileManualPatchAction;
  fieldKey?: StudentPrivateProfileFamilyMemberPatchField;
  value?: string;
};

type FamilyWriteThroughFormValues = {
  name?: string;
  phone?: string;
  relationshipCode?: string;
  workplace?: string;
};

type EducationWriteThroughFormValues = {
  endDate?: string;
  organization?: string;
  reference?: string;
  startDate?: string;
};

type SummaryFieldSectionKey = 'personal' | 'sensitiveIdentifiers';

const SENSITIVE_IDENTIFIER_PATCH_FIELDS = new Set(['ID_CARD', 'BANK_CARD_NUMBER', 'CARD_NUMBER']);

const CONTACT_AND_ADDRESS_PATCH_FIELDS = new Set([
  'STUDENT_PHONE',
  'CONTACT_PERSON_PHONE',
  'HOME_ADDRESS',
  'MAILING_ADDRESS',
]);

const SUMMARY_FIELD_SECTION_ORDER: SummaryFieldSectionKey[] = ['personal', 'sensitiveIdentifiers'];
const CLASS_BATCH_REFRESH_CHUNK_SIZE = 20;
const CLASS_BATCH_REFRESH_INTERVAL_MS = 1000;
const STUDENT_PRIVATE_PROFILE_WRITE_THROUGH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatClassOption(option: StudentPrivateProfileClassOption) {
  return `${option.className} · ${option.studentCount}人`;
}

function formatStudentOption(option: StudentPrivateProfileStudentOption) {
  const studentLabel = option.studentName
    ? `${option.studentName} (${option.studentId})`
    : option.studentId;
  const upstreamStatus = option.upstreamIdPresent ? null : '未关联学工系统';

  return [
    studentLabel,
    resolveStudentPrivateProfileStatusLabel(option.studentStatus),
    upstreamStatus,
  ]
    .filter(Boolean)
    .join(' · ');
}

function normalizeControlledBatchStudentIds(
  studentIdsInput: readonly (string | null | undefined)[],
) {
  const studentIds: string[] = [];
  const observedStudentIds = new Set<string>();

  studentIdsInput.forEach((studentId) => {
    const normalizedStudentId = studentId?.trim() ?? '';

    if (!normalizedStudentId || observedStudentIds.has(normalizedStudentId)) {
      return;
    }

    if (normalizedStudentId.length > 32) {
      throw new Error('本地学生 ID 不能超过 32 个字符。');
    }

    observedStudentIds.add(normalizedStudentId);
    studentIds.push(normalizedStudentId);
  });

  if (studentIds.length === 0) {
    throw new Error('当前班级没有可刷新的学生。');
  }

  return studentIds;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  return formatUpstreamSessionDateTime(value);
}

function displayText(value: string | null | undefined) {
  return value?.trim() || '—';
}

function resolveSummarySectionBaselineToken(
  summary: StudentPrivateProfileSummary | null,
  section: 'education' | 'family',
) {
  return (
    summary?.sectionStatuses.find((sectionStatus) => sectionStatus.section === section)
      ?.sectionBaselineToken ?? null
  );
}

function isValidWriteThroughDate(value: string | null | undefined) {
  const normalizedValue = value?.trim() ?? '';
  const date = new Date(`${normalizedValue}T00:00:00.000Z`);

  return (
    STUDENT_PRIVATE_PROFILE_WRITE_THROUGH_DATE_PATTERN.test(normalizedValue) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === normalizedValue
  );
}

function resolveSupplementSectionBaselineToken(input: {
  educationSectionBaselineToken: string | null;
  familySectionBaselineToken: string | null;
  templateCode: StudentPrivateProfileSupplementTemplateCode;
}) {
  return input.templateCode === 'STUDENT_PRIVATE_PROFILE_FAMILY_SUPPLEMENT'
    ? input.familySectionBaselineToken
    : input.educationSectionBaselineToken;
}

function formatSupplementColumnRequirement(column: StudentPrivateProfileSupplementTemplateColumn) {
  if (column.alwaysRequired) {
    return '始终必填';
  }

  if (column.requiredForActions.length > 0) {
    return column.requiredForActions.join(' / ');
  }

  return '可选';
}

function formatSupplementDryRunIssue(
  issue: StudentPrivateProfileSupplementDryRunRow['issues'][0],
  labelByColumnKey: ReadonlyMap<string, string>,
) {
  const issueLabel = resolveStudentPrivateProfileSupplementDryRunIssueLabel(issue.code);
  const columnLabel = issue.columnKey
    ? (labelByColumnKey.get(issue.columnKey) ?? issue.columnKey)
    : null;

  return columnLabel ? `${issueLabel}（${columnLabel}）` : issueLabel;
}

function formatSupplementDryRunFileIssue(
  issue: StudentPrivateProfileSupplementDryRunFileIssue,
  labelByColumnKey: ReadonlyMap<string, string>,
) {
  const issueLabel = resolveStudentPrivateProfileSupplementDryRunIssueLabel(issue.code);
  const parts = [
    issue.columnIndex ? `第 ${issue.columnIndex} 列` : null,
    issue.header ? `表头：${issue.header}` : null,
    issue.columnKey ? `字段：${labelByColumnKey.get(issue.columnKey) ?? issue.columnKey}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? `${issueLabel}（${parts.join(' / ')}）` : issueLabel;
}

function resolveSupplementMappingFieldLabel(
  mapping: StudentPrivateProfileSupplementDryRunColumnMapping,
  labelByColumnKey: ReadonlyMap<string, string>,
) {
  if (mapping.columnKey) {
    return labelByColumnKey.get(mapping.columnKey) ?? mapping.columnKey;
  }

  return displayText(mapping.fieldKey);
}

function resolveClassOverviewErrorMessage(error: unknown) {
  const detail = readUpstreamGraphQLErrorDetail(error);

  if (detail?.code === 'INTERNAL_SERVER_ERROR') {
    return '本地资料快照读取失败，请稍后重试或联系管理员。';
  }

  return resolveUpstreamErrorMessage(error, '暂时无法读取班级资料概览。');
}

function DiagnosticCollapse({ children }: { children: ReactNode }) {
  return (
    <Collapse
      ghost
      items={[
        {
          children,
          key: 'diagnostics',
          label: '诊断信息',
        },
      ]}
      size="small"
    />
  );
}

function formatApproxByteSize(byteSize: number | null | undefined) {
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return '约 0 KB';
  }

  return `约 ${Math.round(byteSize / 1024).toLocaleString('zh-CN')} KB`;
}

function formatSnapshotPhotoStatus(photo: StudentPrivateProfileSummary['photo']) {
  if (!photo.present) {
    return '上游未观察到照片';
  }

  return `上游有照片，${formatApproxByteSize(photo.byteSize)}`;
}

function formatOverviewPhotoStatus(photo: StudentPrivateProfileClassOverviewStudent['photo']) {
  if (!photo) {
    return '未观察';
  }

  if (!photo.present) {
    return '上游无照片';
  }

  return `上游有照片，${formatApproxByteSize(photo.byteSize)}`;
}

function countObservedCompleteness(flags: StudentPrivateProfileCompletenessFlags) {
  return STUDENT_PRIVATE_PROFILE_COMPLETENESS_ITEMS.filter((item) => flags[item.key]).length;
}

function chunkStudentIds(studentIds: readonly string[]) {
  const chunks: string[][] = [];

  for (let index = 0; index < studentIds.length; index += CLASS_BATCH_REFRESH_CHUNK_SIZE) {
    chunks.push(studentIds.slice(index, index + CLASS_BATCH_REFRESH_CHUNK_SIZE));
  }

  return chunks;
}

function waitForBatchInterval() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, CLASS_BATCH_REFRESH_INTERVAL_MS);
  });
}

function formatFamilyMemberSummary(member: StudentPrivateProfileSummaryFamilyMember) {
  return (
    [
      resolveStudentPrivateProfileFamilyRelationshipLabel(member.relationshipCode),
      member.maskedName ? `姓名 ${member.maskedName}` : null,
      member.maskedPhone ? `电话 ${member.maskedPhone}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || '当前家庭成员'
  );
}

function buildPhotoDataUrl(result: StudentPrivateProfilePhotoReadResult | null) {
  if (!result?.photoBase64 || !result.mimeType) {
    return null;
  }

  return `data:${result.mimeType};base64,${result.photoBase64}`;
}

function resolveStudentPrivateProfileActionError(error: unknown, fallback: string) {
  const detail = readUpstreamGraphQLErrorDetail(error);

  if (
    detail?.code === 'CONFLICT' ||
    detail?.errorCode === 'STUDENT_PRIVATE_PROFILE_MANUAL_PATCH_BASELINE_CONFLICT'
  ) {
    return '资料基线已变化，请重新读取本地资料快照后再提交。';
  }

  if (detail?.code === 'INTERNAL_SERVER_ERROR') {
    return '服务端暂时无法处理该资料，请保留 trace 信息并联系排查。';
  }

  return resolveUpstreamErrorMessage(error, fallback);
}

function resolveStudentPrivateProfilePreviewError(error: unknown) {
  const detail = readUpstreamGraphQLErrorDetail(error);

  if (detail?.code === 'FORBIDDEN') {
    return '无权预览该学生。';
  }

  if (
    detail?.code === 'NOT_FOUND' ||
    detail?.errorCode === 'STUDENT_PRIVATE_PROFILE_SNAPSHOT_NOT_FOUND'
  ) {
    return '该学生暂无可预览 snapshot。';
  }

  if (detail?.code === 'INTERNAL_SERVER_ERROR') {
    return '预览生成失败或审计失败，请稍后重试。';
  }

  return resolveUpstreamErrorMessage(error, '暂时无法生成学生资料临时预览。');
}

function sortSummaryFields(fields: StudentPrivateProfileSummaryField[]) {
  return [...fields].sort((left, right) => {
    const leftOrder = resolveStudentPrivateProfileFieldOrder(left.fieldKey);
    const rightOrder = resolveStudentPrivateProfileFieldOrder(right.fieldKey);

    return leftOrder - rightOrder || left.fieldKey.localeCompare(right.fieldKey);
  });
}

function groupSummaryFieldsBySection(fields: StudentPrivateProfileSummaryField[]) {
  return fields.reduce<Map<string, StudentPrivateProfileSummaryField[]>>((sections, field) => {
    const sectionFields = sections.get(field.section) ?? [];
    sectionFields.push(field);
    sections.set(field.section, sectionFields);
    return sections;
  }, new Map());
}

function sortPreviewFields(fields: StudentPrivateProfilePreviewField[]) {
  return [...fields].sort((left, right) => {
    const leftOrder = resolveStudentPrivateProfileFieldOrder(left.fieldKey);
    const rightOrder = resolveStudentPrivateProfileFieldOrder(right.fieldKey);

    return leftOrder - rightOrder || left.label.localeCompare(right.label, 'zh-CN');
  });
}

function groupPreviewFieldsBySection(fields: StudentPrivateProfilePreviewField[]) {
  return fields.reduce<Map<string, StudentPrivateProfilePreviewField[]>>((sections, field) => {
    const sectionFields = sections.get(field.section) ?? [];
    sectionFields.push(field);
    sections.set(field.section, sectionFields);
    return sections;
  }, new Map());
}

function canPatchStudentPrivateProfileField(
  fieldKey: string,
  access: StudentPrivateProfileManualPatchAccess,
) {
  const patchFieldKey = resolveStudentPrivateProfileManualPatchField(fieldKey);

  if (!patchFieldKey) {
    return false;
  }

  if (SENSITIVE_IDENTIFIER_PATCH_FIELDS.has(patchFieldKey)) {
    return access.sensitiveIdentifiers;
  }

  if (CONTACT_AND_ADDRESS_PATCH_FIELDS.has(patchFieldKey)) {
    return access.contactAndAddress;
  }

  return false;
}

function canPatchStudentPrivateProfileFamily(access: StudentPrivateProfileManualPatchAccess) {
  return access.family;
}

function renderSummaryFieldValue(
  field: StudentPrivateProfileSummaryField,
  manualPatchAccess: StudentPrivateProfileManualPatchAccess,
  actions: {
    disabled: boolean;
    onCompare: (field: StudentPrivateProfileSummaryField) => void;
    onPatch: (field: StudentPrivateProfileSummaryField) => void;
  },
) {
  const canCompare =
    !actions.disabled && Boolean(resolveStudentPrivateProfileCompareField(field.fieldKey));
  const canPatch = Boolean(
    !actions.disabled &&
    field.upstreamBaselineToken &&
    canPatchStudentPrivateProfileField(field.fieldKey, manualPatchAccess),
  );
  const tags = [
    field.valueStatus === 'MISSING' ? (
      <Tag key="missing">{resolveStudentPrivateProfileStatusLabel(field.valueStatus)}</Tag>
    ) : null,
    field.manualOverrideActive ? (
      <Tag color="processing" key="manual">
        人工修正
      </Tag>
    ) : null,
    field.upstreamChangedSinceManualPatch ? (
      <Tag color="warning" key="review">
        需要复核
      </Tag>
    ) : null,
  ].filter(Boolean);

  return (
    <Space direction="vertical" size={4}>
      <span>{displayText(field.maskedValue)}</span>
      {tags.length > 0 || canCompare || canPatch ? (
        <Space size="small" wrap>
          {tags}
          {canCompare ? (
            <Button size="small" type="link" onClick={() => actions.onCompare(field)}>
              核验
            </Button>
          ) : null}
          {canPatch ? (
            <Button size="small" type="link" onClick={() => actions.onPatch(field)}>
              修正
            </Button>
          ) : null}
        </Space>
      ) : null}
    </Space>
  );
}

function renderSummaryFieldSection(
  section: string,
  fields: StudentPrivateProfileSummaryField[],
  manualPatchAccess: StudentPrivateProfileManualPatchAccess,
  actions: {
    disabled: boolean;
    onCompare: (field: StudentPrivateProfileSummaryField) => void;
    onPatch: (field: StudentPrivateProfileSummaryField) => void;
  },
) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <Descriptions
      bordered
      column={1}
      key={section}
      size="small"
      title={resolveStudentPrivateProfileSectionLabel(section)}
    >
      {fields.map((field) => (
        <Descriptions.Item
          key={field.fieldKey}
          label={resolveStudentPrivateProfileFieldLabel(field.fieldKey)}
        >
          {renderSummaryFieldValue(field, manualPatchAccess, actions)}
        </Descriptions.Item>
      ))}
    </Descriptions>
  );
}

export function StudentPrivateProfileLabPage() {
  const loaderData = useLoaderData() as StudentPrivateProfileLabLoaderData | null;
  const currentAccount = loaderData?.currentAccount ?? null;
  const lockedUpstreamLoginUserId = loaderData?.lockedUpstreamLoginUserId ?? null;
  const manualPatchAccess = loaderData?.manualPatchAccess ?? EMPTY_MANUAL_PATCH_ACCESS;
  const { message, modal } = AntApp.useApp();
  const [studentForm] = Form.useForm<{ studentId: string }>();
  const [compareForm] = Form.useForm<CompareFormValues>();
  const [patchForm] = Form.useForm<PatchFormValues>();
  const [familyPatchForm] = Form.useForm<FamilyPatchFormValues>();
  const [familyWriteThroughForm] = Form.useForm<FamilyWriteThroughFormValues>();
  const [educationWriteThroughForm] = Form.useForm<EducationWriteThroughFormValues>();
  const [summary, setSummary] = useState<StudentPrivateProfileSummary | null>(null);
  const [compareResult, setCompareResult] = useState<StudentPrivateProfileCompareResult | null>(
    null,
  );
  const [refreshResult, setRefreshResult] = useState<StudentPrivateProfileRefreshResult | null>(
    null,
  );
  const [batchRefreshResult, setBatchRefreshResult] = useState<ControlledBatchRefreshResult | null>(
    null,
  );
  const [classOverview, setClassOverview] = useState<StudentPrivateProfileClassOverview | null>(
    null,
  );
  const [governanceReadiness, setGovernanceReadiness] =
    useState<StudentPrivateProfileGovernanceReadinessPreflight | null>(null);
  const [photoReadResult, setPhotoReadResult] =
    useState<StudentPrivateProfilePhotoReadResult | null>(null);
  const [profilePreview, setProfilePreview] = useState<StudentPrivateProfilePreview | null>(null);
  const [profilePreviewError, setProfilePreviewError] = useState<string | null>(null);
  const [isProfilePreviewOpen, setIsProfilePreviewOpen] = useState(false);
  const [supplementTemplateCode, setSupplementTemplateCode] =
    useState<StudentPrivateProfileSupplementTemplateCode>(
      'STUDENT_PRIVATE_PROFILE_FAMILY_SUPPLEMENT',
    );
  const [supplementMode, setSupplementMode] =
    useState<StudentPrivateProfileSupplementMode>('STRICT');
  const [supplementTemplate, setSupplementTemplate] =
    useState<StudentPrivateProfileSupplementTemplate | null>(null);
  const [supplementUploadFile, setSupplementUploadFile] = useState<File | null>(null);
  const [supplementUploadResult, setSupplementUploadResult] =
    useState<StudentPrivateProfileSupplementUploadResult | null>(null);
  const [supplementDryRunResult, setSupplementDryRunResult] =
    useState<StudentPrivateProfileSupplementDryRunResult | null>(null);
  const [activeTabKey, setActiveTabKey] = useState<StudentPrivateProfileLabTabKey>('overview');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isLoadingClassOverview, setIsLoadingClassOverview] = useState(false);
  const [isLoadingGovernanceReadiness, setIsLoadingGovernanceReadiness] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBatchRefreshing, setIsBatchRefreshing] = useState(false);
  const [isReadingPhoto, setIsReadingPhoto] = useState(false);
  const [isLoadingProfilePreview, setIsLoadingProfilePreview] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isPatching, setIsPatching] = useState(false);
  const [isPatchingFamily, setIsPatchingFamily] = useState(false);
  const [isWritingThrough, setIsWritingThrough] = useState(false);
  const [isLoadingSupplementTemplate, setIsLoadingSupplementTemplate] = useState(false);
  const [isDownloadingSupplementTemplate, setIsDownloadingSupplementTemplate] = useState(false);
  const [isUploadingSupplementFile, setIsUploadingSupplementFile] = useState(false);
  const [isRunningSupplementDryRun, setIsRunningSupplementDryRun] = useState(false);
  const [isFamilyWriteThroughOpen, setIsFamilyWriteThroughOpen] = useState(false);
  const [isEducationWriteThroughOpen, setIsEducationWriteThroughOpen] = useState(false);
  const [activeCompareField, setActiveCompareField] =
    useState<StudentPrivateProfileCompareField | null>(null);
  const [activePatchField, setActivePatchField] =
    useState<StudentPrivateProfileManualPatchField | null>(null);
  const [activeFamilyPatchMember, setActiveFamilyPatchMember] =
    useState<StudentPrivateProfileSummaryFamilyMember | null>(null);
  const [classes, setClasses] = useState<StudentPrivateProfileClassOption[]>([]);
  const [students, setStudents] = useState<StudentPrivateProfileStudentOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [batchUpdatedStudentIdsNeedingReload, setBatchUpdatedStudentIdsNeedingReload] = useState<
    string[]
  >([]);
  const [classOptionsError, setClassOptionsError] = useState<string | null>(null);
  const [studentOptionsError, setStudentOptionsError] = useState<string | null>(null);
  const [classOverviewError, setClassOverviewError] = useState<string | null>(null);
  const [governanceReadinessError, setGovernanceReadinessError] = useState<string | null>(null);
  const [upstreamActionRequest, setUpstreamActionRequest] = useState<{
    action: UpstreamPendingAction;
    session: StoredUpstreamSession;
  } | null>(null);
  const profilePreviewRequestIdRef = useRef(0);

  const currentStudentId = Form.useWatch('studentId', studentForm);
  const patchAction = Form.useWatch('action', patchForm);
  const familyPatchAction = Form.useWatch('action', familyPatchForm);
  const currentStudentIdText = typeof currentStudentId === 'string' ? currentStudentId.trim() : '';
  const activeSummaryStudentId = summary?.studentId ?? null;
  const isSummaryStudentIdMismatched = Boolean(
    activeSummaryStudentId && currentStudentIdText !== activeSummaryStudentId,
  );
  const summaryActionDisabledReason = !summary
    ? '请先读取本地资料快照。'
    : isSummaryStudentIdMismatched
      ? '当前输入学生 ID 已变化，请重新读取本地资料快照。'
      : null;
  const photoDataUrl = useMemo(() => buildPhotoDataUrl(photoReadResult), [photoReadResult]);

  const summaryFields = useMemo(() => sortSummaryFields(summary?.fields ?? []), [summary]);
  const summaryFieldsBySection = useMemo(
    () => groupSummaryFieldsBySection(summaryFields),
    [summaryFields],
  );
  const previewFields = useMemo(
    () => sortPreviewFields(profilePreview?.fields ?? []),
    [profilePreview],
  );
  const previewFieldsBySection = useMemo(
    () => groupPreviewFieldsBySection(previewFields),
    [previewFields],
  );
  const summaryFieldByKey = useMemo(
    () =>
      new Map(
        summaryFields
          .map((field) => {
            const patchFieldKey = resolveStudentPrivateProfileManualPatchField(field.fieldKey);

            return patchFieldKey ? ([patchFieldKey, field] as const) : null;
          })
          .filter(
            (
              item,
            ): item is readonly [
              StudentPrivateProfileManualPatchField,
              StudentPrivateProfileSummaryField,
            ] => Boolean(item),
          ),
      ),
    [summaryFields],
  );
  const familySectionBaselineToken = useMemo(
    () => resolveSummarySectionBaselineToken(summary, 'family'),
    [summary],
  );
  const educationSectionBaselineToken = useMemo(
    () => resolveSummarySectionBaselineToken(summary, 'education'),
    [summary],
  );
  const supplementSectionBaselineToken = useMemo(
    () =>
      resolveSupplementSectionBaselineToken({
        educationSectionBaselineToken,
        familySectionBaselineToken,
        templateCode: supplementTemplateCode,
      }),
    [educationSectionBaselineToken, familySectionBaselineToken, supplementTemplateCode],
  );
  const supplementColumnLabelByKey = useMemo(
    () => new Map((supplementTemplate?.columns ?? []).map((column) => [column.key, column.label])),
    [supplementTemplate],
  );
  const classSelectOptions = useMemo(
    () =>
      classes.map((option) => ({
        label: formatClassOption(option),
        value: option.id,
      })),
    [classes],
  );
  const studentSelectOptions = useMemo(
    () =>
      students.map((option) => ({
        label: formatStudentOption(option),
        value: option.studentId,
      })),
    [students],
  );
  const studentOptionById = useMemo(
    () => new Map(students.map((student) => [student.studentId, student])),
    [students],
  );
  const currentSummaryStudentName = useMemo(() => {
    if (!summary) {
      return null;
    }

    return (
      studentOptionById.get(summary.studentId)?.studentName ??
      classOverview?.students.find((student) => student.studentId === summary.studentId)
        ?.studentName ??
      null
    );
  }, [classOverview, studentOptionById, summary]);
  const selectedClassOption = useMemo(
    () => classes.find((option) => option.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );
  const classRefreshSourceStudents = useMemo<
    {
      studentId: string;
      upstreamIdPresent: boolean;
    }[]
  >(() => {
    if (classOverview) {
      return classOverview.students.map((student) => ({
        studentId: student.studentId,
        upstreamIdPresent: student.upstreamIdPresent,
      }));
    }

    return students.map((student) => ({
      studentId: student.studentId,
      upstreamIdPresent: student.upstreamIdPresent,
    }));
  }, [classOverview, students]);
  const classRefreshCandidateStudentIds = useMemo(
    () =>
      classRefreshSourceStudents
        .filter((student) => student.upstreamIdPresent)
        .map((student) => student.studentId),
    [classRefreshSourceStudents],
  );
  const classRefreshSkippedCount =
    classRefreshSourceStudents.length - classRefreshCandidateStudentIds.length;
  const classOverviewAttentionCounts = useMemo(() => {
    const counts = new Map<string, number>();

    classOverview?.students.forEach((student) => {
      counts.set(student.attentionLevel, (counts.get(student.attentionLevel) ?? 0) + 1);
    });

    return counts;
  }, [classOverview]);
  const shouldOfferSummaryReload = Boolean(
    summary?.studentId && batchUpdatedStudentIdsNeedingReload.includes(summary.studentId),
  );
  const batchRefreshPercent =
    batchRefreshResult && batchRefreshResult.totalChunks > 0
      ? Math.round((batchRefreshResult.completedChunks / batchRefreshResult.totalChunks) * 100)
      : 0;
  const activeCompareFieldLabel = activeCompareField
    ? resolveStudentPrivateProfileFieldLabel(activeCompareField)
    : '资料项';
  const activePatchFieldLabel = activePatchField
    ? resolveStudentPrivateProfileFieldLabel(activePatchField)
    : '资料项';
  const activeFamilyPatchMemberLabel = activeFamilyPatchMember
    ? formatFamilyMemberSummary(activeFamilyPatchMember)
    : '家庭成员';

  const clearProfilePreview = useCallback(() => {
    profilePreviewRequestIdRef.current += 1;
    setIsProfilePreviewOpen(false);
    setProfilePreview(null);
    setProfilePreviewError(null);
    setIsLoadingProfilePreview(false);
  }, []);

  const clearSupplementRuntimeState = useCallback(() => {
    setSupplementUploadFile(null);
    setSupplementUploadResult(null);
    setSupplementDryRunResult(null);
  }, []);

  const clearRegistrationCardRuntimeState = useCallback(() => {
    setRegistrationCardPreflight(null);
    setRegistrationCardDocument(null);
  }, []);

  const loadClasses = useCallback(async () => {
    setIsLoadingClasses(true);
    setClassOptionsError(null);

    try {
      const nextClasses = await listStudentPrivateProfileClassOptions();

      setClasses(nextClasses);
    } catch (error) {
      const errorMessage = resolveUpstreamErrorMessage(error, '暂时无法加载本地班级列表。');

      setClassOptionsError(errorMessage);
      message.error(errorMessage);
    } finally {
      setIsLoadingClasses(false);
    }
  }, [message]);

  const loadStudentsForClass = useCallback(async (classId: string) => {
    setIsLoadingStudents(true);
    setStudentOptionsError(null);
    setStudents([]);

    try {
      const nextStudents = await listStudentPrivateProfileClassStudentOptions({ classId });

      setStudents(nextStudents);

      if (nextStudents.length === 0) {
        setStudentOptionsError('该班级暂未返回当前有效学生归属，仍可直接输入本地学生 ID。');
      }
    } catch (error) {
      setStudentOptionsError(
        resolveUpstreamErrorMessage(error, '暂时无法加载班级学生列表，仍可直接输入本地学生 ID。'),
      );
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  const loadClassOverview = useCallback(
    async (classId: string) => {
      setIsLoadingClassOverview(true);
      setClassOverviewError(null);

      try {
        const nextOverview = await getStudentPrivateProfileClassOverview({ classId });

        setClassOverview(nextOverview);
      } catch (error) {
        const errorMessage = resolveClassOverviewErrorMessage(error);

        setClassOverviewError(errorMessage);
        message.error(errorMessage);
      } finally {
        setIsLoadingClassOverview(false);
      }
    },
    [message],
  );

  const loadGovernanceReadiness = useCallback(
    async (classId: string) => {
      setIsLoadingGovernanceReadiness(true);
      setGovernanceReadinessError(null);

      try {
        const nextReadiness = await getStudentPrivateProfileGovernanceReadinessPreflight({
          classId,
        });

        setGovernanceReadiness(nextReadiness);
      } catch (error) {
        const errorMessage = resolveUpstreamErrorMessage(error, '暂时无法读取班级治理 readiness。');

        setGovernanceReadinessError(errorMessage);
        message.error(errorMessage);
      } finally {
        setIsLoadingGovernanceReadiness(false);
      }
    },
    [message],
  );

  useEffect(() => {
    if (!currentAccount) {
      return;
    }

    void loadClasses();
  }, [currentAccount, loadClasses]);

  const resolveSummaryActionStudentId = useCallback(() => {
    if (!summary) {
      message.error('请先读取本地资料快照。');
      return null;
    }

    if (currentStudentIdText !== summary.studentId) {
      message.error('当前输入学生 ID 已变化，请重新读取本地资料快照。');
      return null;
    }

    return summary.studentId;
  }, [currentStudentIdText, message, summary]);

  const loadSummary = useCallback(
    async (studentIdValue: string | null | undefined, options: LoadSummaryOptions = {}) => {
      const studentId = normalizeStudentPrivateProfileStudentId(studentIdValue);

      clearProfilePreview();
      clearSupplementRuntimeState();
      setIsLoadingSummary(true);
      setCompareResult(null);
      setActiveCompareField(null);
      setActivePatchField(null);
      setActiveFamilyPatchMember(null);
      if (!options.preserveRefreshResult) {
        setRefreshResult(null);
      }
      setPhotoReadResult(null);

      try {
        const nextSummary = await getStudentPrivateProfileSummary({ studentId });

        setSummary(nextSummary);
        setBatchUpdatedStudentIdsNeedingReload((studentIds) =>
          studentIds.filter((item) => item !== nextSummary.studentId),
        );
        studentForm.setFieldValue('studentId', nextSummary.studentId);
      } catch (error) {
        message.error(resolveUpstreamErrorMessage(error, '暂时无法读取本地资料快照。'));
      } finally {
        setIsLoadingSummary(false);
      }
    },
    [clearProfilePreview, clearSupplementRuntimeState, message, studentForm],
  );

  const {
    clearSession,
    modalProps: upstreamLoginModalProps,
    openLoginModal,
    openLoginModalForExpiredSession,
    persistSessionFromResult,
    refreshSession,
    session: upstreamSession,
  } = useUpstreamLoginModalController<UpstreamPendingAction>({
    account: currentAccount,
    keepAlive: true,
    lockedUserId: lockedUpstreamLoginUserId,
    resolveLoginErrorMessage: (error) =>
      resolveUpstreamErrorMessage(error, '学工系统登录失败，请检查账号或密码。'),
    onLoginSuccess: ({ pendingAction, session }) => {
      if (pendingAction) {
        setUpstreamActionRequest({
          action: pendingAction,
          session,
        });
      }
    },
  });

  const runRefreshWithSession = useCallback(
    async (session: StoredUpstreamSession, studentId: string) => {
      setIsRefreshing(true);

      try {
        const result = await refreshStudentPrivateProfileFromUpstream({
          studentId,
          upstreamSessionToken: session.upstreamSessionToken,
        });

        persistSessionFromResult(session, result);
        await loadSummary(studentId, { preserveRefreshResult: true });
        setRefreshResult(result);
        message.success('已从学工系统刷新，并重新读取本地资料快照。');
      } catch (error) {
        if (!isExpiredUpstreamSessionError(error)) {
          message.error(resolveUpstreamErrorMessage(error, '暂时无法刷新学生个人资料。'));
          return;
        }

        try {
          const refreshedSession = await refreshSession(session);
          const result = await refreshStudentPrivateProfileFromUpstream({
            studentId,
            upstreamSessionToken: refreshedSession.upstreamSessionToken,
          });

          persistSessionFromResult(refreshedSession, result);
          await loadSummary(studentId, { preserveRefreshResult: true });
          setRefreshResult(result);
          message.success('学工系统会话已续期，资料刷新完成。');
        } catch (refreshError) {
          openLoginModalForExpiredSession({
            loginError: resolveUpstreamErrorMessage(
              refreshError,
              '学工系统会话已失效，请重新登录后继续刷新。',
            ),
            pendingAction: {
              studentId,
              type: 'refresh',
            },
            session,
          });
        }
      } finally {
        setIsRefreshing(false);
      }
    },
    [
      loadSummary,
      message,
      openLoginModalForExpiredSession,
      persistSessionFromResult,
      refreshSession,
    ],
  );

  const commitBatchRefreshResult = useCallback(
    (
      result: ControlledBatchRefreshResult,
      options: {
        notify?: boolean;
      } = {},
    ) => {
      setBatchRefreshResult(result);
      setBatchUpdatedStudentIdsNeedingReload((studentIds) => {
        const nextStudentIds = new Set(studentIds);

        result.results.forEach((item) => {
          if (item.status === 'SUCCESS') {
            nextStudentIds.add(item.studentId);
          }
        });

        return Array.from(nextStudentIds);
      });

      if (!options.notify) {
        return;
      }

      if (result.success) {
        message.success(`班级资料同步完成，成功 ${result.successCount} 人。`);
        return;
      }

      message.warning(
        `班级资料同步完成，成功 ${result.successCount} 人，失败 ${result.failureCount} 人。`,
      );
    },
    [message],
  );

  const runBatchRefreshWithSession = useCallback(
    async (
      session: StoredUpstreamSession,
      studentIds: string[],
      options: {
        classId?: string | null;
      } = {},
    ) => {
      const normalizedStudentIds = normalizeControlledBatchStudentIds(studentIds);
      const chunks = chunkStudentIds(normalizedStudentIds);
      let activeSession = session;
      let aggregate: ControlledBatchRefreshResult = {
        completedChunks: 0,
        expiresAt: null,
        failureCount: 0,
        requestedCount: 0,
        results: [],
        success: true,
        successCount: 0,
        totalChunks: chunks.length,
        traceId: '',
        traceIds: [],
        upstreamSessionToken: session.upstreamSessionToken,
      };

      setIsBatchRefreshing(true);
      setBatchRefreshResult(aggregate);

      try {
        for (let index = 0; index < chunks.length; index += 1) {
          const chunk = chunks[index] ?? [];
          let result: StudentPrivateProfileBatchRefreshResult;

          try {
            result = await refreshStudentPrivateProfilesFromUpstream({
              studentIds: chunk,
              upstreamSessionToken: activeSession.upstreamSessionToken,
            });
          } catch (error) {
            if (!isExpiredUpstreamSessionError(error)) {
              commitBatchRefreshResult(aggregate);
              message.error(resolveUpstreamErrorMessage(error, '暂时无法同步班级学生资料。'));
              return;
            }

            try {
              const refreshedSession = await refreshSession(activeSession);

              result = await refreshStudentPrivateProfilesFromUpstream({
                studentIds: chunk,
                upstreamSessionToken: refreshedSession.upstreamSessionToken,
              });
              activeSession = refreshedSession;
            } catch (refreshError) {
              commitBatchRefreshResult(aggregate);
              openLoginModalForExpiredSession({
                loginError: resolveUpstreamErrorMessage(
                  refreshError,
                  '学工系统会话已失效，请重新登录后继续同步。',
                ),
                pendingAction: {
                  classId: options.classId ?? null,
                  studentIds: normalizedStudentIds.slice(index * CLASS_BATCH_REFRESH_CHUNK_SIZE),
                  type: 'batch-refresh',
                },
                session: activeSession,
              });
              return;
            }
          }

          activeSession = persistSessionFromResult(activeSession, result);
          aggregate = {
            completedChunks: index + 1,
            expiresAt: result.expiresAt ?? aggregate.expiresAt,
            failureCount: aggregate.failureCount + result.failureCount,
            requestedCount: aggregate.requestedCount + result.requestedCount,
            results: [...aggregate.results, ...result.results],
            success: aggregate.success && result.success,
            successCount: aggregate.successCount + result.successCount,
            totalChunks: chunks.length,
            traceId: result.traceId,
            traceIds: [...aggregate.traceIds, result.traceId],
            upstreamSessionToken: result.upstreamSessionToken,
          };
          commitBatchRefreshResult(aggregate);

          if (index < chunks.length - 1) {
            await waitForBatchInterval();
          }
        }

        commitBatchRefreshResult(aggregate, { notify: true });

        if (options.classId && options.classId === selectedClassId) {
          await loadClassOverview(options.classId);
          await loadGovernanceReadiness(options.classId);
        }
      } finally {
        setIsBatchRefreshing(false);
      }
    },
    [
      commitBatchRefreshResult,
      loadClassOverview,
      loadGovernanceReadiness,
      message,
      openLoginModalForExpiredSession,
      persistSessionFromResult,
      refreshSession,
      selectedClassId,
    ],
  );

  const runPhotoReadWithSession = useCallback(
    async (session: StoredUpstreamSession, studentId: string, forceRefresh: boolean) => {
      setIsReadingPhoto(true);

      try {
        const result = await readStudentPrivateProfilePhoto({
          forceRefresh,
          studentId,
          upstreamSessionToken: session.upstreamSessionToken,
        });

        persistSessionFromResult(session, result);
        setPhotoReadResult(result);
        message.success(result.photoStatus === 'PRESENT' ? '照片读取完成。' : '照片状态已返回。');
      } catch (error) {
        if (!isExpiredUpstreamSessionError(error)) {
          message.error(resolveStudentPrivateProfileActionError(error, '暂时无法读取学生照片。'));
          return;
        }

        try {
          const refreshedSession = await refreshSession(session);
          const result = await readStudentPrivateProfilePhoto({
            forceRefresh,
            studentId,
            upstreamSessionToken: refreshedSession.upstreamSessionToken,
          });

          persistSessionFromResult(refreshedSession, result);
          setPhotoReadResult(result);
          message.success('学工系统会话已续期，照片读取完成。');
        } catch (refreshError) {
          openLoginModalForExpiredSession({
            loginError: resolveUpstreamErrorMessage(
              refreshError,
              '学工系统会话已失效，请重新登录后继续读取照片。',
            ),
            pendingAction: {
              forceRefresh,
              studentId,
              type: 'photo',
            },
            session,
          });
        }
      } finally {
        setIsReadingPhoto(false);
      }
    },
    [message, openLoginModalForExpiredSession, persistSessionFromResult, refreshSession],
  );

  const runPhotoReadCacheFirst = useCallback(
    async (studentId: string) => {
      setIsReadingPhoto(true);

      try {
        const result = await readStudentPrivateProfilePhoto({
          forceRefresh: false,
          studentId,
        });

        setPhotoReadResult(result);
        message.success(result.photoStatus === 'PRESENT' ? '照片读取完成。' : '照片状态已返回。');
      } catch (error) {
        if (!isStudentPrivateProfileUpstreamSessionRequiredError(error)) {
          message.error(resolveStudentPrivateProfileActionError(error, '暂时无法读取学生照片。'));
          return;
        }

        if (upstreamSession) {
          await runPhotoReadWithSession(upstreamSession, studentId, false);
          return;
        }

        openLoginModal({
          pendingAction: {
            forceRefresh: false,
            studentId,
            type: 'photo',
          },
        });
      } finally {
        setIsReadingPhoto(false);
      }
    },
    [message, openLoginModal, runPhotoReadWithSession, upstreamSession],
  );

  const applyWriteThroughResult = useCallback(
    async (result: WriteStudentPrivateProfileSectionToUpstreamResult) => {
      setIsFamilyWriteThroughOpen(false);
      setIsEducationWriteThroughOpen(false);
      familyWriteThroughForm.resetFields();
      educationWriteThroughForm.resetFields();
      clearProfilePreview();

      if (result.summary) {
        setSummary(result.summary);
        studentForm.setFieldValue('studentId', result.summary.studentId);
      } else if (result.summaryRefreshFailed) {
        await loadSummary(result.studentId);
      }

      if (selectedClassId) {
        void loadClassOverview(selectedClassId);
        void loadGovernanceReadiness(selectedClassId);
      }

      if (result.summaryRefreshFailed && !result.summary) {
        message.warning('写回已完成，本地摘要已重新读取。');
        return;
      }

      if (result.warningCodes.length > 0) {
        message.warning('写回已完成，请留意返回提醒。');
        return;
      }

      message.success('已写回学工系统并刷新本地资料。');
    },
    [
      clearProfilePreview,
      educationWriteThroughForm,
      familyWriteThroughForm,
      loadClassOverview,
      loadGovernanceReadiness,
      loadSummary,
      message,
      selectedClassId,
      studentForm,
    ],
  );

  const runWriteThroughWithSession = useCallback(
    async (
      session: StoredUpstreamSession,
      action: Extract<
        UpstreamPendingAction,
        {
          type: 'education-write-through' | 'family-write-through';
        }
      >,
    ) => {
      setIsWritingThrough(true);

      try {
        let activeSession = session;

        const executeWriteThrough = async (nextSession: StoredUpstreamSession) => {
          if (action.type === 'family-write-through') {
            return await writeStudentPrivateProfileFamilyToUpstream({
              expectedSectionBaselineToken: action.expectedSectionBaselineToken,
              members: [action.member],
              studentId: action.studentId,
              upstreamSessionToken: nextSession.upstreamSessionToken,
            });
          }

          return await writeStudentPrivateProfileEducationToUpstream({
            expectedSectionBaselineToken: action.expectedSectionBaselineToken,
            resumes: [action.resume],
            studentId: action.studentId,
            upstreamSessionToken: nextSession.upstreamSessionToken,
          });
        };

        try {
          const result = await executeWriteThrough(activeSession);

          activeSession = persistSessionFromResult(activeSession, result);
          await applyWriteThroughResult(result);
        } catch (error) {
          if (!isExpiredUpstreamSessionError(error)) {
            message.error(
              resolveStudentPrivateProfileActionError(error, '暂时无法写回学工系统资料。'),
            );
            return;
          }

          try {
            const refreshedSession = await refreshSession(activeSession);
            const result = await executeWriteThrough(refreshedSession);

            persistSessionFromResult(refreshedSession, result);
            await applyWriteThroughResult(result);
          } catch (refreshError) {
            openLoginModalForExpiredSession({
              loginError: resolveUpstreamErrorMessage(
                refreshError,
                '学工系统会话已失效，请重新登录后继续写回。',
              ),
              pendingAction: action,
              session: activeSession,
            });
          }
        }
      } finally {
        setIsWritingThrough(false);
      }
    },
    [
      applyWriteThroughResult,
      message,
      openLoginModalForExpiredSession,
      persistSessionFromResult,
      refreshSession,
    ],
  );

  useEffect(() => {
    if (!upstreamActionRequest) {
      return;
    }

    setUpstreamActionRequest(null);
    if (upstreamActionRequest.action.type === 'refresh') {
      void runRefreshWithSession(
        upstreamActionRequest.session,
        upstreamActionRequest.action.studentId,
      );
      return;
    }

    if (upstreamActionRequest.action.type === 'batch-refresh') {
      void runBatchRefreshWithSession(
        upstreamActionRequest.session,
        upstreamActionRequest.action.studentIds,
        {
          classId: upstreamActionRequest.action.classId,
        },
      );
      return;
    }

    if (
      upstreamActionRequest.action.type === 'family-write-through' ||
      upstreamActionRequest.action.type === 'education-write-through'
    ) {
      void runWriteThroughWithSession(upstreamActionRequest.session, upstreamActionRequest.action);
      return;
    }

    void runPhotoReadWithSession(
      upstreamActionRequest.session,
      upstreamActionRequest.action.studentId,
      upstreamActionRequest.action.forceRefresh,
    );
  }, [
    runBatchRefreshWithSession,
    runPhotoReadWithSession,
    runRefreshWithSession,
    runWriteThroughWithSession,
    upstreamActionRequest,
  ]);

  const handleLoadSummary = useCallback(async () => {
    await loadSummary(currentStudentId);
  }, [currentStudentId, loadSummary]);

  const handleClassChange = useCallback(
    (classId: string | null) => {
      clearProfilePreview();
      clearSupplementRuntimeState();
      setSelectedClassId(classId);
      setStudents([]);
      setBatchRefreshResult(null);
      setClassOverview(null);
      setGovernanceReadiness(null);
      setClassOverviewError(null);
      setGovernanceReadinessError(null);
      setStudentOptionsError(null);
      setActiveTabKey('overview');

      if (!classId) {
        return;
      }

      void loadStudentsForClass(classId);
      void loadClassOverview(classId);
      void loadGovernanceReadiness(classId);
    },
    [
      clearProfilePreview,
      clearSupplementRuntimeState,
      loadClassOverview,
      loadGovernanceReadiness,
      loadStudentsForClass,
    ],
  );

  const handleStudentOptionChange = useCallback(
    (studentId: string | null) => {
      clearProfilePreview();
      clearSupplementRuntimeState();
      studentForm.setFieldValue('studentId', studentId ?? '');
    },
    [clearProfilePreview, clearSupplementRuntimeState, studentForm],
  );

  const openStudentDetail = useCallback(
    (studentId: string) => {
      clearProfilePreview();
      clearSupplementRuntimeState();
      studentForm.setFieldValue('studentId', studentId);
      setActiveTabKey('detail');
      void loadSummary(studentId);
    },
    [clearProfilePreview, clearSupplementRuntimeState, loadSummary, studentForm],
  );

  const handleRefresh = useCallback(async () => {
    const studentId = normalizeStudentPrivateProfileStudentId(currentStudentId);

    if (!upstreamSession) {
      openLoginModal({
        pendingAction: {
          studentId,
          type: 'refresh',
        },
      });
      return;
    }

    await runRefreshWithSession(upstreamSession, studentId);
  }, [currentStudentId, openLoginModal, runRefreshWithSession, upstreamSession]);

  const handleBatchRefresh = useCallback(async () => {
    if (!selectedClassId) {
      message.error('请先选择班级。');
      return;
    }

    let studentIds: string[];

    try {
      studentIds = normalizeControlledBatchStudentIds(classRefreshCandidateStudentIds);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '当前班级没有可同步的学生。');
      return;
    }

    if (!upstreamSession) {
      openLoginModal({
        pendingAction: {
          classId: selectedClassId,
          studentIds,
          type: 'batch-refresh',
        },
      });
      return;
    }

    await runBatchRefreshWithSession(upstreamSession, studentIds, { classId: selectedClassId });
  }, [
    classRefreshCandidateStudentIds,
    message,
    openLoginModal,
    runBatchRefreshWithSession,
    selectedClassId,
    upstreamSession,
  ]);

  const handleReloadSummaryAfterBatch = useCallback(async () => {
    if (!summary) {
      return;
    }

    await loadSummary(summary.studentId);
  }, [loadSummary, summary]);

  const handleReloadClassOverview = useCallback(async () => {
    if (!selectedClassId) {
      message.error('请先选择班级。');
      return;
    }

    await loadClassOverview(selectedClassId);
  }, [loadClassOverview, message, selectedClassId]);

  const handleReloadGovernanceReadiness = useCallback(async () => {
    if (!selectedClassId) {
      message.error('请先选择班级。');
      return;
    }

    await loadGovernanceReadiness(selectedClassId);
  }, [loadGovernanceReadiness, message, selectedClassId]);

  const handleOpenProfilePreview = useCallback(async () => {
    let studentId: string;

    try {
      studentId = normalizeStudentPrivateProfileStudentId(currentStudentId);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '请输入本地学生 ID。');
      return;
    }

    const previewRequestId = profilePreviewRequestIdRef.current + 1;

    profilePreviewRequestIdRef.current = previewRequestId;
    setIsProfilePreviewOpen(true);
    setProfilePreview(null);
    setProfilePreviewError(null);
    setIsLoadingProfilePreview(true);

    try {
      const nextPreview = await getStudentPrivateProfilePreview({ studentId });

      if (
        profilePreviewRequestIdRef.current !== previewRequestId ||
        studentForm.getFieldValue('studentId')?.trim() !== nextPreview.studentId
      ) {
        return;
      }

      setProfilePreview(nextPreview);
    } catch (error) {
      if (profilePreviewRequestIdRef.current !== previewRequestId) {
        return;
      }

      const errorMessage = resolveStudentPrivateProfilePreviewError(error);

      setProfilePreviewError(errorMessage);
      message.error(errorMessage);
    } finally {
      if (profilePreviewRequestIdRef.current === previewRequestId) {
        setIsLoadingProfilePreview(false);
      }
    }
  }, [currentStudentId, message, studentForm]);

  const handleReadPhoto = useCallback(
    async (forceRefresh: boolean) => {
      const studentId = resolveSummaryActionStudentId();

      if (!studentId) {
        return;
      }

      if (!forceRefresh) {
        await runPhotoReadCacheFirst(studentId);
        return;
      }

      if (!upstreamSession) {
        openLoginModal({
          pendingAction: {
            forceRefresh,
            studentId,
            type: 'photo',
          },
        });
        return;
      }

      await runPhotoReadWithSession(upstreamSession, studentId, forceRefresh);
    },
    [
      openLoginModal,
      resolveSummaryActionStudentId,
      runPhotoReadCacheFirst,
      runPhotoReadWithSession,
      upstreamSession,
    ],
  );

  const runOrQueueWriteThroughAction = useCallback(
    async (
      action: Extract<
        UpstreamPendingAction,
        { type: 'education-write-through' | 'family-write-through' }
      >,
    ) => {
      if (!upstreamSession) {
        openLoginModal({ pendingAction: action });
        return;
      }

      await runWriteThroughWithSession(upstreamSession, action);
    },
    [openLoginModal, runWriteThroughWithSession, upstreamSession],
  );

  const handleSupplementTemplateCodeChange = useCallback(
    (templateCode: StudentPrivateProfileSupplementTemplateCode) => {
      setSupplementTemplateCode(templateCode);
      setSupplementTemplate(null);
      clearSupplementRuntimeState();
    },
    [clearSupplementRuntimeState],
  );

  const handleSupplementModeChange = useCallback(
    (mode: StudentPrivateProfileSupplementMode) => {
      setSupplementMode(mode);
      setSupplementTemplate(null);
      clearSupplementRuntimeState();
    },
    [clearSupplementRuntimeState],
  );

  const loadSupplementTemplate = useCallback(async () => {
    setIsLoadingSupplementTemplate(true);

    try {
      const template = await getStudentPrivateProfileSupplementTemplate({
        mode: supplementMode,
        templateCode: supplementTemplateCode,
      });

      setSupplementTemplate(template);
      return template;
    } catch (error) {
      message.error(resolveUpstreamErrorMessage(error, '暂时无法读取补录模板。'));
      return null;
    } finally {
      setIsLoadingSupplementTemplate(false);
    }
  }, [message, supplementMode, supplementTemplateCode]);

  const handleDownloadSupplementTemplate = useCallback(async () => {
    const studentId = resolveSummaryActionStudentId();

    if (!studentId) {
      return;
    }

    if (!supplementSectionBaselineToken) {
      message.error('当前补录分区缺少 section baseline，请先刷新该学生资料。');
      return;
    }

    setIsDownloadingSupplementTemplate(true);

    try {
      const template =
        supplementTemplate?.mode === supplementMode &&
        supplementTemplate.templateCode === supplementTemplateCode
          ? supplementTemplate
          : await loadSupplementTemplate();

      if (!template) {
        return;
      }

      await downloadStudentPrivateProfileSupplementTemplateWorkbook({
        studentName: currentSummaryStudentName,
        summary,
        template,
      });
      message.success('已生成补录 Excel。');
    } catch (error) {
      message.error(resolveUpstreamErrorMessage(error, '暂时无法生成补录 Excel。'));
    } finally {
      setIsDownloadingSupplementTemplate(false);
    }
  }, [
    loadSupplementTemplate,
    message,
    currentSummaryStudentName,
    resolveSummaryActionStudentId,
    supplementSectionBaselineToken,
    supplementTemplate,
    supplementTemplateCode,
    supplementMode,
    summary,
  ]);

  const handleSupplementFileBeforeUpload: UploadProps['beforeUpload'] = useCallback((file) => {
    setSupplementUploadFile(file);
    setSupplementUploadResult(null);
    setSupplementDryRunResult(null);
    return false;
  }, []);

  const handleSupplementFileRemove = useCallback(() => {
    clearSupplementRuntimeState();
    return true;
  }, [clearSupplementRuntimeState]);

  const handleUploadSupplementFile = useCallback(async () => {
    if (!supplementTemplate) {
      message.error('请先读取补录模板。');
      return;
    }

    if (!supplementUploadFile) {
      message.error('请选择要上传的 .xlsx 文件。');
      return;
    }

    setIsUploadingSupplementFile(true);
    setSupplementUploadResult(null);
    setSupplementDryRunResult(null);

    try {
      const result = await uploadStudentPrivateProfileSupplementFile({
        file: supplementUploadFile,
      });

      setSupplementUploadResult(result);
      message.success('补录文件已上传。');
    } catch (error) {
      message.error(resolveUpstreamErrorMessage(error, '暂时无法上传补录文件。'));
    } finally {
      setIsUploadingSupplementFile(false);
    }
  }, [message, supplementTemplate, supplementUploadFile]);

  const handleRunSupplementDryRun = useCallback(async () => {
    if (!supplementTemplate) {
      message.error('请先读取补录模板。');
      return;
    }

    if (!supplementUploadResult) {
      message.error('请先上传补录文件。');
      return;
    }

    setIsRunningSupplementDryRun(true);
    setSupplementDryRunResult(null);

    try {
      const result = await dryRunStudentPrivateProfileSupplement({
        fileToken: supplementUploadResult.fileToken,
        mode: supplementTemplate.mode,
        templateCode: supplementTemplate.templateCode,
        templateVersion: supplementTemplate.templateVersion,
      });

      setSupplementDryRunResult(result);

      if (result.status === 'READY') {
        message.success('补录文件 dry-run 校验通过。');
      } else {
        message.warning('补录文件 dry-run 存在阻塞行。');
      }
    } catch (error) {
      message.error(resolveUpstreamErrorMessage(error, '暂时无法执行补录 dry-run。'));
    } finally {
      setIsRunningSupplementDryRun(false);
    }
  }, [message, supplementTemplate, supplementUploadResult]);

  const openFamilyWriteThroughModal = useCallback(() => {
    const studentId = resolveSummaryActionStudentId();

    if (!studentId) {
      return;
    }

    if (!familySectionBaselineToken) {
      message.error('家庭信息缺少 section baseline，请先刷新该学生资料。');
      return;
    }

    familyWriteThroughForm.setFieldsValue({
      name: undefined,
      phone: undefined,
      relationshipCode: '1',
      workplace: undefined,
    });
    setIsFamilyWriteThroughOpen(true);
  }, [familySectionBaselineToken, familyWriteThroughForm, message, resolveSummaryActionStudentId]);

  const closeFamilyWriteThroughModal = useCallback(() => {
    setIsFamilyWriteThroughOpen(false);
    familyWriteThroughForm.resetFields();
  }, [familyWriteThroughForm]);

  const handleFamilyWriteThroughCreate = useCallback(
    async (values: FamilyWriteThroughFormValues) => {
      const studentId = resolveSummaryActionStudentId();

      if (!studentId) {
        return;
      }

      if (!familySectionBaselineToken) {
        message.error('家庭信息缺少 section baseline，请先刷新该学生资料。');
        return;
      }

      await runOrQueueWriteThroughAction({
        expectedSectionBaselineToken: familySectionBaselineToken,
        member: {
          action: 'CREATE',
          name: values.name,
          phone: values.phone,
          relationshipCode: values.relationshipCode,
          workplace: values.workplace,
        },
        studentId,
        type: 'family-write-through',
      });
    },
    [
      familySectionBaselineToken,
      message,
      resolveSummaryActionStudentId,
      runOrQueueWriteThroughAction,
    ],
  );

  const confirmFamilyWriteThroughDelete = useCallback(
    (member: StudentPrivateProfileSummaryFamilyMember) => {
      const studentId = resolveSummaryActionStudentId();

      if (!studentId) {
        return;
      }

      if (!familySectionBaselineToken) {
        message.error('家庭信息缺少 section baseline，请先刷新该学生资料。');
        return;
      }

      modal.confirm({
        cancelText: '取消',
        content: `将从学工系统删除家庭成员「${formatFamilyMemberSummary(member)}」。本操作不会乐观更新页面。`,
        okButtonProps: {
          danger: true,
        },
        okText: '删除并写回',
        title: '确认删除家庭成员',
        onOk: async () => {
          await runOrQueueWriteThroughAction({
            expectedSectionBaselineToken: familySectionBaselineToken,
            member: {
              action: 'DELETE',
              itemKey: member.itemKey,
              upstreamBaselineToken: member.upstreamBaselineToken,
            },
            studentId,
            type: 'family-write-through',
          });
        },
      });
    },
    [
      familySectionBaselineToken,
      message,
      modal,
      resolveSummaryActionStudentId,
      runOrQueueWriteThroughAction,
    ],
  );

  const openEducationWriteThroughModal = useCallback(() => {
    const studentId = resolveSummaryActionStudentId();

    if (!studentId) {
      return;
    }

    if (!educationSectionBaselineToken) {
      message.error('教育经历缺少 section baseline，请先刷新该学生资料。');
      return;
    }

    educationWriteThroughForm.resetFields();
    setIsEducationWriteThroughOpen(true);
  }, [
    educationSectionBaselineToken,
    educationWriteThroughForm,
    message,
    resolveSummaryActionStudentId,
  ]);

  const closeEducationWriteThroughModal = useCallback(() => {
    setIsEducationWriteThroughOpen(false);
    educationWriteThroughForm.resetFields();
  }, [educationWriteThroughForm]);

  const handleEducationWriteThroughCreate = useCallback(
    async (values: EducationWriteThroughFormValues) => {
      const studentId = resolveSummaryActionStudentId();

      if (!studentId) {
        return;
      }

      if (!educationSectionBaselineToken) {
        message.error('教育经历缺少 section baseline，请先刷新该学生资料。');
        return;
      }

      if (!isValidWriteThroughDate(values.startDate) || !isValidWriteThroughDate(values.endDate)) {
        message.error('开始日期和结束日期必须是合法日期，格式为 YYYY-MM-DD。');
        return;
      }

      if ((values.startDate ?? '') > (values.endDate ?? '')) {
        message.error('开始日期不能晚于结束日期。');
        return;
      }

      await runOrQueueWriteThroughAction({
        expectedSectionBaselineToken: educationSectionBaselineToken,
        resume: {
          action: 'CREATE',
          endDate: values.endDate,
          organization: values.organization,
          reference: values.reference,
          startDate: values.startDate,
        },
        studentId,
        type: 'education-write-through',
      });
    },
    [
      educationSectionBaselineToken,
      message,
      resolveSummaryActionStudentId,
      runOrQueueWriteThroughAction,
    ],
  );

  const confirmEducationWriteThroughDelete = useCallback(
    (resume: StudentPrivateProfileSummaryEducationResume) => {
      const studentId = resolveSummaryActionStudentId();

      if (!studentId) {
        return;
      }

      if (!educationSectionBaselineToken) {
        message.error('教育经历缺少 section baseline，请先刷新该学生资料。');
        return;
      }

      modal.confirm({
        cancelText: '取消',
        content: `将从学工系统删除教育经历「${
          [resume.startMonth, resume.endMonth, resume.maskedOrganization]
            .filter(Boolean)
            .join(' · ') || '当前教育经历'
        }」。本操作不会乐观更新页面。`,
        okButtonProps: {
          danger: true,
        },
        okText: '删除并写回',
        title: '确认删除教育经历',
        onOk: async () => {
          await runOrQueueWriteThroughAction({
            expectedSectionBaselineToken: educationSectionBaselineToken,
            resume: {
              action: 'DELETE',
              itemKey: resume.itemKey,
              upstreamBaselineToken: resume.upstreamBaselineToken,
            },
            studentId,
            type: 'education-write-through',
          });
        },
      });
    },
    [
      educationSectionBaselineToken,
      message,
      modal,
      resolveSummaryActionStudentId,
      runOrQueueWriteThroughAction,
    ],
  );

  const openCompareModal = useCallback(
    (field: StudentPrivateProfileSummaryField) => {
      const compareFieldKey = resolveStudentPrivateProfileCompareField(field.fieldKey);

      if (!compareFieldKey) {
        return;
      }

      setCompareResult(null);
      compareForm.resetFields();
      setActiveCompareField(compareFieldKey);
    },
    [compareForm],
  );

  const closeCompareModal = useCallback(() => {
    setActiveCompareField(null);
    setCompareResult(null);
    compareForm.resetFields();
  }, [compareForm]);

  const openPatchModal = useCallback(
    (field: StudentPrivateProfileSummaryField) => {
      const patchFieldKey = resolveStudentPrivateProfileManualPatchField(field.fieldKey);

      if (!patchFieldKey) {
        return;
      }

      patchForm.setFieldsValue({ action: 'SET', value: undefined });
      setActivePatchField(patchFieldKey);
    },
    [patchForm],
  );

  const closePatchModal = useCallback(() => {
    setActivePatchField(null);
    patchForm.resetFields(['value']);
  }, [patchForm]);

  const openFamilyPatchModal = useCallback(
    (member: StudentPrivateProfileSummaryFamilyMember) => {
      familyPatchForm.setFieldsValue({ action: 'SET', fieldKey: 'PHONE', value: undefined });
      setActiveFamilyPatchMember(member);
    },
    [familyPatchForm],
  );

  const closeFamilyPatchModal = useCallback(() => {
    setActiveFamilyPatchMember(null);
    familyPatchForm.resetFields(['value']);
  }, [familyPatchForm]);

  const handleCompare = useCallback(
    async (values: CompareFormValues) => {
      const studentId = resolveSummaryActionStudentId();

      if (!studentId) {
        return;
      }

      if (!activeCompareField) {
        message.error('请选择需要核验的资料项。');
        return;
      }

      setIsComparing(true);

      try {
        const result = await compareStudentPrivateProfileFields({
          fields: [
            {
              candidateValue: values.candidateValue,
              fieldKey: activeCompareField,
            },
          ],
          studentId,
        });

        setCompareResult(result);
        compareForm.resetFields(['candidateValue']);
        message.success('核验完成，候选值已从表单清除。');
      } catch (error) {
        message.error(resolveUpstreamErrorMessage(error, '暂时无法核验候选值。'));
      } finally {
        setIsComparing(false);
      }
    },
    [activeCompareField, compareForm, message, resolveSummaryActionStudentId],
  );

  const handlePatch = useCallback(
    async (values: PatchFormValues) => {
      const studentId = resolveSummaryActionStudentId();

      if (!studentId) {
        return;
      }

      if (!activePatchField) {
        message.error('请选择需要修正的资料项。');
        return;
      }

      const fieldKey = activePatchField;
      const action = values.action as StudentPrivateProfileManualPatchAction;
      const summaryField = summaryFieldByKey.get(fieldKey);

      if (!canPatchStudentPrivateProfileField(fieldKey, manualPatchAccess)) {
        message.error('当前账号没有该字段的人工修正入口。');
        return;
      }

      if (action === 'SET' && !summaryField?.upstreamBaselineToken) {
        message.error('当前资料没有可用于写入修正的基线，请先重新读取本地资料快照。');
        return;
      }

      setIsPatching(true);

      try {
        const nextSummary = await patchStudentPrivateProfileFields({
          fields: [
            {
              action,
              fieldKey,
              upstreamBaselineToken:
                action === 'SET' ? (summaryField?.upstreamBaselineToken ?? null) : undefined,
              value: action === 'SET' ? values.value : undefined,
            },
          ],
          studentId,
        });

        setSummary(nextSummary);
        setCompareResult(null);
        setActivePatchField(null);
        patchForm.resetFields(['value']);
        message.success(action === 'SET' ? '人工修正已写入。' : '人工修正已清除。');
      } catch (error) {
        message.error(
          resolveStudentPrivateProfileActionError(
            error,
            '暂时无法保存人工修正，请重新读取本地资料快照后再试。',
          ),
        );
      } finally {
        setIsPatching(false);
      }
    },
    [
      activePatchField,
      manualPatchAccess,
      message,
      patchForm,
      resolveSummaryActionStudentId,
      summaryFieldByKey,
    ],
  );

  const handleFamilyPatch = useCallback(
    async (values: FamilyPatchFormValues) => {
      const studentId = resolveSummaryActionStudentId();

      if (!studentId) {
        return;
      }

      if (!activeFamilyPatchMember) {
        message.error('请选择需要修正的家庭成员。');
        return;
      }

      const itemKey = activeFamilyPatchMember.itemKey;
      const fieldKey = values.fieldKey as StudentPrivateProfileFamilyMemberPatchField;
      const action = values.action as StudentPrivateProfileManualPatchAction;
      const familyMember = activeFamilyPatchMember;

      if (!canPatchStudentPrivateProfileFamily(manualPatchAccess)) {
        message.error('当前账号没有家庭成员资料的人工修正入口。');
        return;
      }

      if (!familyMember) {
        message.error('当前资料没有该家庭成员行，请重新读取本地资料快照。');
        return;
      }

      if (action === 'SET' && !familyMember.upstreamBaselineToken) {
        message.error('当前家庭成员没有可用于写入修正的基线，请重新读取本地资料快照。');
        return;
      }

      setIsPatchingFamily(true);

      try {
        const nextSummary = await patchStudentPrivateProfileFamilyMembers({
          members: [
            {
              fields: [
                {
                  action,
                  fieldKey,
                  value: action === 'SET' ? values.value : undefined,
                },
              ],
              itemKey,
              upstreamBaselineToken:
                action === 'SET' ? familyMember.upstreamBaselineToken : undefined,
            },
          ],
          studentId,
        });

        setSummary(nextSummary);
        setActiveFamilyPatchMember(null);
        familyPatchForm.resetFields(['value']);
        message.success(action === 'SET' ? '家庭成员人工修正已写入。' : '家庭成员人工修正已清除。');
      } catch (error) {
        message.error(
          resolveStudentPrivateProfileActionError(
            error,
            '暂时无法保存家庭成员人工修正，请重新读取本地资料快照后再试。',
          ),
        );
      } finally {
        setIsPatchingFamily(false);
      }
    },
    [
      activeFamilyPatchMember,
      familyPatchForm,
      manualPatchAccess,
      message,
      resolveSummaryActionStudentId,
    ],
  );

  const handleTabChange = useCallback(
    (key: string) => {
      if (key !== 'detail') {
        clearProfilePreview();
      }

      setActiveTabKey(key as StudentPrivateProfileLabTabKey);
    },
    [clearProfilePreview],
  );

  const classOverviewColumns: ColumnsType<StudentPrivateProfileClassOverviewStudent> = [
    {
      fixed: 'left',
      key: 'student',
      title: '学生',
      width: 190,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Button size="small" type="link" onClick={() => openStudentDetail(record.studentId)}>
            {record.studentName || '未记录姓名'}
          </Button>
          <span>{record.studentId}</span>
        </Space>
      ),
      sorter: (left, right) => left.studentId.localeCompare(right.studentId),
    },
    {
      dataIndex: 'attentionLevel',
      filters: STUDENT_PRIVATE_PROFILE_CLASS_OVERVIEW_ATTENTION_FILTERS,
      key: 'attentionLevel',
      onFilter: (value, record) => record.attentionLevel === value,
      title: '资料状态',
      width: 130,
      render: (value: StudentPrivateProfileClassOverviewStudent['attentionLevel']) => (
        <Tag color={resolveStudentPrivateProfileClassOverviewAttentionColor(value)}>
          {resolveStudentPrivateProfileClassOverviewAttentionLabel(value)}
        </Tag>
      ),
    },
    {
      key: 'snapshot',
      title: '本地资料',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <span>{record.snapshotPresent ? '已同步' : '未同步'}</span>
          <span>{formatDateTime(record.lastSyncedAt)}</span>
        </Space>
      ),
      sorter: (left, right) => (left.lastSyncedAt ?? '').localeCompare(right.lastSyncedAt ?? ''),
    },
    {
      key: 'manual',
      title: '人工复核',
      width: 150,
      render: (_, record) => (
        <Space size="small" wrap>
          {record.manualOverrideActive ? <Tag color="processing">人工修正</Tag> : null}
          {record.upstreamChangedSinceManualPatch ? <Tag color="warning">上游已变化</Tag> : null}
          {!record.manualOverrideActive && !record.upstreamChangedSinceManualPatch ? '无' : null}
        </Space>
      ),
      filters: [
        { text: '已人工修正', value: 'manual' },
        { text: '上游已变化', value: 'changed' },
      ],
      onFilter: (value, record) =>
        value === 'manual' ? record.manualOverrideActive : record.upstreamChangedSinceManualPatch,
    },
    {
      key: 'photo',
      title: '照片',
      width: 130,
      render: (_, record) => formatOverviewPhotoStatus(record.photo),
    },
    {
      key: 'completeness',
      title: '同步范围',
      width: 260,
      render: (_, record) => {
        const observedCount = countObservedCompleteness(record.profileCompletenessFlags);

        return (
          <Space direction="vertical" size={4}>
            <span>
              {observedCount}/{STUDENT_PRIVATE_PROFILE_COMPLETENESS_ITEMS.length} 已同步
            </span>
            <Space size="small" wrap>
              {STUDENT_PRIVATE_PROFILE_COMPLETENESS_ITEMS.map((item) => (
                <Tag
                  color={record.profileCompletenessFlags[item.key] ? 'success' : 'default'}
                  key={item.key}
                >
                  {item.label}
                </Tag>
              ))}
            </Space>
          </Space>
        );
      },
    },
    {
      key: 'sections',
      title: '分区状态',
      width: 280,
      render: (_, record) =>
        record.sectionStatuses.length > 0 ? (
          <Space size="small" wrap>
            {record.sectionStatuses.map(
              (section: StudentPrivateProfileClassOverviewSectionStatus) => (
                <Tag
                  color={resolveStudentPrivateProfileStatusColor(section.sourceStatus)}
                  key={section.section}
                >
                  {resolveStudentPrivateProfileSectionLabel(section.section)}
                  {section.sourceTotal === null ? '' : ` ${section.sourceTotal}`}
                </Tag>
              ),
            )}
          </Space>
        ) : (
          '暂无'
        ),
    },
    {
      dataIndex: 'warningCodes',
      key: 'warningCodes',
      title: '提醒',
      width: 220,
      render: (value: string[]) =>
        value.length > 0 ? (
          <Space size="small" wrap>
            {value.map((code) => (
              <Tag color="warning" key={code}>
                {resolveStudentPrivateProfileWarningCodeLabel(code)}
              </Tag>
            ))}
          </Space>
        ) : (
          '无'
        ),
    },
    {
      fixed: 'right',
      key: 'action',
      title: '操作',
      width: 110,
      render: (_, record) => (
        <Button size="small" onClick={() => openStudentDetail(record.studentId)}>
          查看详情
        </Button>
      ),
    },
  ];

  const governanceReadinessColumns: ColumnsType<StudentPrivateProfileGovernanceReadinessStudent> = [
    {
      fixed: 'left',
      key: 'student',
      title: '学生',
      width: 190,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Button size="small" type="link" onClick={() => openStudentDetail(record.studentId)}>
            {record.studentName || '未记录姓名'}
          </Button>
          <span>{record.studentId}</span>
        </Space>
      ),
      sorter: (left, right) => left.studentId.localeCompare(right.studentId),
    },
    {
      dataIndex: 'status',
      filters: STUDENT_PRIVATE_PROFILE_GOVERNANCE_READINESS_STATUS_FILTERS,
      key: 'status',
      onFilter: (value, record) => record.status === value,
      title: '治理状态',
      width: 110,
      render: (value: StudentPrivateProfileGovernanceReadinessStudent['status']) => (
        <Tag color={resolveStudentPrivateProfileGovernanceReadinessStatusColor(value)}>
          {resolveStudentPrivateProfileGovernanceReadinessStatusLabel(value)}
        </Tag>
      ),
    },
    {
      key: 'snapshots',
      title: '本地依赖',
      width: 260,
      render: (_, record) => (
        <Space size="small" wrap>
          <Tag color={record.upstreamIdPresent ? 'success' : 'error'}>学工关联</Tag>
          <Tag color={record.privateProfileSnapshotPresent ? 'success' : 'error'}>资料快照</Tag>
          <Tag color={record.courseResultSnapshotPresent ? 'success' : 'warning'}>成绩快照</Tag>
        </Space>
      ),
    },
    {
      dataIndex: 'issueCodes',
      filters: STUDENT_PRIVATE_PROFILE_GOVERNANCE_READINESS_ISSUE_FILTERS,
      key: 'issueCodes',
      onFilter: (value, record) =>
        record.issueCodes.includes(
          value as StudentPrivateProfileGovernanceReadinessStudent['issueCodes'][number],
        ),
      title: '问题',
      width: 320,
      render: (value: StudentPrivateProfileGovernanceReadinessStudent['issueCodes']) =>
        value.length > 0 ? (
          <Space size="small" wrap>
            {value.map((code) => (
              <Tag key={code}>
                {resolveStudentPrivateProfileGovernanceReadinessIssueLabel(code)}
              </Tag>
            ))}
          </Space>
        ) : (
          '无'
        ),
    },
    {
      dataIndex: 'missingSections',
      filters: STUDENT_PRIVATE_PROFILE_GOVERNANCE_MISSING_SECTION_FILTERS,
      key: 'missingSections',
      onFilter: (value, record) =>
        record.missingSections.includes(
          value as StudentPrivateProfileGovernanceReadinessStudent['missingSections'][number],
        ),
      title: '缺失分区',
      width: 240,
      render: (value: StudentPrivateProfileGovernanceReadinessStudent['missingSections']) =>
        value.length > 0 ? (
          <Space size="small" wrap>
            {value.map((section) => (
              <Tag color="warning" key={section}>
                {resolveStudentPrivateProfileGovernanceMissingSectionLabel(section)}
              </Tag>
            ))}
          </Space>
        ) : (
          '无'
        ),
    },
    {
      key: 'manual',
      title: '人工复核',
      width: 150,
      render: (_, record) => (
        <Space size="small" wrap>
          {record.manualOverrideActive ? <Tag color="processing">人工修正</Tag> : null}
          {record.upstreamChangedSinceManualPatch ? <Tag color="warning">上游已变化</Tag> : null}
          {!record.manualOverrideActive && !record.upstreamChangedSinceManualPatch ? '无' : null}
        </Space>
      ),
      filters: [
        { text: '已人工修正', value: 'manual' },
        { text: '上游已变化', value: 'changed' },
      ],
      onFilter: (value, record) =>
        value === 'manual' ? record.manualOverrideActive : record.upstreamChangedSinceManualPatch,
    },
    {
      dataIndex: 'warningCodes',
      key: 'warningCodes',
      title: '资料提醒',
      width: 220,
      render: (value: string[]) =>
        value.length > 0 ? (
          <Space size="small" wrap>
            {value.map((code) => (
              <Tag color="warning" key={code}>
                {resolveStudentPrivateProfileWarningCodeLabel(code)}
              </Tag>
            ))}
          </Space>
        ) : (
          '无'
        ),
    },
    {
      fixed: 'right',
      key: 'action',
      title: '操作',
      width: 110,
      render: (_, record) => (
        <Button size="small" onClick={() => openStudentDetail(record.studentId)}>
          查看详情
        </Button>
      ),
    },
  ];

  const previewFieldColumns: ColumnsType<StudentPrivateProfilePreviewField> = [
    {
      dataIndex: 'label',
      key: 'label',
      title: '字段',
      width: 140,
      render: (value: string, record) =>
        value || resolveStudentPrivateProfileFieldLabel(record.fieldKey),
    },
    {
      dataIndex: 'value',
      ellipsis: true,
      key: 'value',
      title: '真实值',
      width: 220,
      render: (value: string | null, record) => (
        <Space direction="vertical" size={2}>
          <span>{displayText(value)}</span>
          {record.valueStatus === 'MISSING' ? (
            <Tag>{resolveStudentPrivateProfileStatusLabel(record.valueStatus)}</Tag>
          ) : null}
        </Space>
      ),
    },
    {
      key: 'source',
      title: '来源',
      width: 150,
      render: (_, record) => (
        <Space size="small" wrap>
          <Tag color={resolveStudentPrivateProfileSourceColor(record.source)}>
            {resolveStudentPrivateProfileSourceLabel(record.source)}
          </Tag>
          <Tag>{record.confidence}</Tag>
        </Space>
      ),
    },
    {
      key: 'manual',
      title: '复核状态',
      width: 160,
      render: (_, record) => (
        <Space size="small" wrap>
          {record.manualOverrideActive ? <Tag color="processing">人工修正</Tag> : null}
          {record.upstreamChangedSinceManualPatch ? <Tag color="warning">上游已变化</Tag> : null}
          {!record.manualOverrideActive && !record.upstreamChangedSinceManualPatch ? '无' : null}
        </Space>
      ),
    },
    {
      dataIndex: 'sourceObservedAt',
      key: 'sourceObservedAt',
      title: '观察时间',
      width: 160,
      render: (value: string) => formatDateTime(value),
    },
  ];

  const familyColumns: ColumnsType<StudentPrivateProfileSummaryFamilyMember> = [
    {
      dataIndex: 'relationshipCode',
      key: 'relationshipCode',
      title: '关系',
      width: 96,
      render: (value: string) => resolveStudentPrivateProfileFamilyRelationshipLabel(value),
    },
    {
      dataIndex: 'maskedName',
      key: 'maskedName',
      title: '姓名',
      width: 120,
      render: (value: string | null) => displayText(value),
    },
    {
      dataIndex: 'maskedPhone',
      key: 'maskedPhone',
      title: '电话',
      width: 140,
      render: (value: string | null) => displayText(value),
    },
    {
      dataIndex: 'maskedWorkplace',
      ellipsis: true,
      key: 'maskedWorkplace',
      title: '工作单位',
      width: 180,
      render: (value: string | null) => displayText(value),
    },
    {
      key: 'manual',
      title: '复核',
      width: 180,
      render: (_, record) => (
        <Space size="small" wrap>
          {record.manualOverrideActive ? <Tag color="processing">人工修正</Tag> : null}
          {record.upstreamChangedSinceManualPatch ? <Tag color="warning">需要复核</Tag> : null}
          {record.manualPatchFieldKeys.map((fieldKey) => (
            <Tag key={fieldKey}>{resolveStudentPrivateProfileFamilyFieldLabel(fieldKey)}</Tag>
          ))}
        </Space>
      ),
    },
    {
      dataIndex: 'sourceObservedAt',
      key: 'sourceObservedAt',
      title: '同步时间',
      width: 160,
      render: (value: string) => formatDateTime(value),
    },
    {
      fixed: 'right',
      key: 'action',
      title: '操作',
      width: 180,
      render: (_, record) => {
        const canPatch =
          canPatchStudentPrivateProfileFamily(manualPatchAccess) && record.upstreamBaselineToken;
        const canDeleteThrough = Boolean(
          familySectionBaselineToken && record.itemKey && record.upstreamBaselineToken,
        );

        return canPatch || canDeleteThrough ? (
          <Space size="small" wrap>
            {canPatch ? (
              <Button
                disabled={isSummaryStudentIdMismatched}
                size="small"
                type="link"
                onClick={() => openFamilyPatchModal(record)}
              >
                修正
              </Button>
            ) : null}
            {canDeleteThrough ? (
              <Button
                danger
                disabled={isSummaryStudentIdMismatched || isWritingThrough}
                icon={<DeleteOutlined />}
                size="small"
                type="link"
                onClick={() => confirmFamilyWriteThroughDelete(record)}
              >
                删除并写回
              </Button>
            ) : null}
          </Space>
        ) : (
          '—'
        );
      },
    },
  ];

  const educationColumns: ColumnsType<StudentPrivateProfileSummaryEducationResume> = [
    {
      key: 'period',
      title: '起止年月',
      width: 150,
      render: (_, record) => `${displayText(record.startMonth)} - ${displayText(record.endMonth)}`,
    },
    {
      dataIndex: 'maskedReference',
      ellipsis: true,
      key: 'maskedReference',
      title: '经历',
      width: 180,
      render: (value: string | null) => displayText(value),
    },
    {
      dataIndex: 'maskedOrganization',
      ellipsis: true,
      key: 'maskedOrganization',
      title: '组织',
      width: 180,
      render: (value: string | null) => displayText(value),
    },
    {
      dataIndex: 'sourceUpdatedAt',
      key: 'sourceUpdatedAt',
      title: '更新时间',
      width: 160,
      render: (value: string | null) => formatDateTime(value),
    },
    {
      dataIndex: 'sourceObservedAt',
      key: 'sourceObservedAt',
      title: '同步时间',
      width: 160,
      render: (value: string) => formatDateTime(value),
    },
    {
      fixed: 'right',
      key: 'action',
      title: '操作',
      width: 120,
      render: (_, record) =>
        educationSectionBaselineToken && record.itemKey && record.upstreamBaselineToken ? (
          <Button
            danger
            disabled={isSummaryStudentIdMismatched || isWritingThrough}
            icon={<DeleteOutlined />}
            size="small"
            type="link"
            onClick={() => confirmEducationWriteThroughDelete(record)}
          >
            删除并写回
          </Button>
        ) : (
          '—'
        ),
    },
  ];

  const recordColumns: ColumnsType<StudentPrivateProfileSummaryRecordChange> = [
    {
      dataIndex: 'changeTime',
      key: 'changeTime',
      title: '变更时间',
      width: 160,
      render: (value: string | null) => formatDateTime(value),
    },
    {
      dataIndex: 'studentNoTypeCode',
      key: 'studentNoTypeCode',
      title: '异动类型',
      width: 120,
      render: (value: string | null) =>
        value ? resolveStudentPrivateProfileRecordChangeTypeLabel(value) : displayText(value),
    },
    {
      dataIndex: 'maskedStudentNumber',
      key: 'maskedStudentNumber',
      title: '学号',
      width: 120,
      render: (value: string | null) => displayText(value),
    },
    {
      dataIndex: 'grade',
      key: 'grade',
      title: '年级',
      width: 80,
      render: (value: string | null) => displayText(value),
    },
    {
      ellipsis: true,
      key: 'majorClass',
      title: '专业/班级',
      width: 220,
      render: (_, record) =>
        [record.maskedMajorName, record.maskedClassName].filter(Boolean).join(' / ') || '—',
    },
    {
      dataIndex: 'sourceObservedAt',
      key: 'sourceObservedAt',
      title: '同步时间',
      width: 160,
      render: (value: string) => formatDateTime(value),
    },
  ];

  const supplementTemplateColumns: ColumnsType<StudentPrivateProfileSupplementTemplateColumn> = [
    {
      dataIndex: 'key',
      key: 'key',
      title: '列 key',
      width: 180,
    },
    {
      dataIndex: 'label',
      key: 'label',
      title: '列名',
      width: 180,
    },
    {
      key: 'aliases',
      title: '别名',
      width: 220,
      render: (_, record) =>
        record.aliases.length > 0 ? (
          <Space size="small" wrap>
            {record.aliases.map((alias) => (
              <Tag key={alias}>{alias}</Tag>
            ))}
          </Space>
        ) : (
          '—'
        ),
    },
    {
      key: 'required',
      title: '必填',
      width: 120,
      render: (_, record) => formatSupplementColumnRequirement(record),
    },
    {
      dataIndex: 'valueType',
      key: 'valueType',
      title: '类型',
      width: 100,
    },
    {
      key: 'enumValues',
      title: '枚举值',
      width: 180,
      render: (_, record) =>
        record.enumValues.length > 0 ? (
          <Space size="small" wrap>
            {record.enumValues.map((value) => (
              <Tag key={value}>{value}</Tag>
            ))}
          </Space>
        ) : (
          '—'
        ),
    },
    {
      dataIndex: 'destination',
      key: 'destination',
      title: '归属',
      width: 150,
      render: (value: string | null) =>
        resolveStudentPrivateProfileSupplementDestinationLabel(value),
    },
    {
      dataIndex: 'auditPolicy',
      key: 'auditPolicy',
      title: '审计策略',
      width: 140,
      render: (value: string) => resolveStudentPrivateProfileSupplementAuditPolicyLabel(value),
    },
    {
      dataIndex: 'sensitive',
      key: 'sensitive',
      title: '敏感',
      width: 80,
      render: (value: boolean) => formatStudentPrivateProfileBoolean(value),
    },
  ];

  const supplementDryRunFileIssueColumns: ColumnsType<StudentPrivateProfileSupplementDryRunFileIssue> =
    [
      {
        dataIndex: 'columnIndex',
        key: 'columnIndex',
        title: '列号',
        width: 80,
        render: (value: number | null) => value ?? '—',
      },
      {
        dataIndex: 'header',
        key: 'header',
        title: '上传表头',
        width: 180,
        render: (value: string | null) => displayText(value),
      },
      {
        dataIndex: 'columnKey',
        key: 'columnKey',
        title: '识别字段',
        width: 180,
        render: (value: string | null) =>
          value ? (supplementColumnLabelByKey.get(value) ?? value) : '—',
      },
      {
        key: 'code',
        title: '问题',
        width: 320,
        render: (_, record) => formatSupplementDryRunFileIssue(record, supplementColumnLabelByKey),
      },
    ];

  const supplementColumnMappingColumns: ColumnsType<StudentPrivateProfileSupplementDryRunColumnMapping> =
    [
      {
        dataIndex: 'columnIndex',
        key: 'columnIndex',
        title: '列号',
        width: 80,
      },
      {
        dataIndex: 'header',
        key: 'header',
        title: '上传表头',
        width: 180,
      },
      {
        key: 'mappedField',
        title: '识别字段',
        width: 180,
        render: (_, record) =>
          resolveSupplementMappingFieldLabel(record, supplementColumnLabelByKey),
      },
      {
        dataIndex: 'sectionKey',
        key: 'sectionKey',
        title: '分区',
        width: 140,
        render: (value: string | null) =>
          value ? resolveStudentPrivateProfileSectionLabel(value) : '—',
      },
      {
        dataIndex: 'destination',
        key: 'destination',
        title: '归属',
        width: 150,
        render: (value: string | null) =>
          resolveStudentPrivateProfileSupplementDestinationLabel(value),
      },
      {
        dataIndex: 'status',
        key: 'status',
        title: '状态',
        width: 110,
        render: (value: string) => (
          <Tag color={resolveStudentPrivateProfileSupplementColumnMappingStatusColor(value)}>
            {resolveStudentPrivateProfileSupplementColumnMappingStatusLabel(value)}
          </Tag>
        ),
      },
      {
        dataIndex: 'issueCode',
        key: 'issueCode',
        title: '映射问题',
        width: 180,
        render: (value: string | null) =>
          value ? resolveStudentPrivateProfileSupplementDryRunIssueLabel(value) : '—',
      },
    ];

  const supplementDryRunColumns: ColumnsType<StudentPrivateProfileSupplementDryRunRow> = [
    {
      dataIndex: 'rowNumber',
      key: 'rowNumber',
      title: '行号',
      width: 80,
    },
    {
      dataIndex: 'studentId',
      key: 'studentId',
      title: '学生 ID',
      width: 140,
      render: (value: string | null) => displayText(value),
    },
    {
      dataIndex: 'action',
      key: 'action',
      title: '动作',
      width: 100,
      render: (value: string | null) => displayText(value),
    },
    {
      dataIndex: 'status',
      key: 'status',
      title: '状态',
      width: 100,
      render: (value: string) => (
        <Tag color={resolveStudentPrivateProfileSupplementDryRunRowStatusColor(value)}>
          {resolveStudentPrivateProfileSupplementDryRunRowStatusLabel(value)}
        </Tag>
      ),
    },
    {
      key: 'issues',
      title: '问题',
      width: 360,
      render: (_, record) =>
        record.issues.length > 0 ? (
          <Space size="small" wrap>
            {record.issues.map((issue) => (
              <Tag color="error" key={`${record.rowNumber}-${issue.code}-${issue.columnKey}`}>
                {formatSupplementDryRunIssue(issue, supplementColumnLabelByKey)}
              </Tag>
            ))}
          </Space>
        ) : (
          '无'
        ),
    },
    {
      key: 'warnings',
      title: '提醒',
      width: 260,
      render: (_, record) =>
        record.warningCodes.length > 0 ? (
          <Space size="small" wrap>
            {record.warningCodes.map((code) => (
              <Tag color="warning" key={code}>
                {resolveStudentPrivateProfileSupplementDryRunIssueLabel(code)}
              </Tag>
            ))}
          </Space>
        ) : (
          '无'
        ),
    },
  ];

  const batchRefreshColumns: ColumnsType<StudentPrivateProfileBatchRefreshItem> = [
    {
      dataIndex: 'studentId',
      key: 'studentId',
      title: '学生 ID',
      width: 120,
    },
    {
      key: 'student',
      title: '本地学生',
      width: 220,
      render: (_, record) => {
        const student = studentOptionById.get(record.studentId);

        if (!student) {
          return '未在当前班级列表';
        }

        return [
          student.studentName ?? '未记录姓名',
          student.activeMembershipClassName ?? student.currentClassCode,
        ]
          .filter(Boolean)
          .join(' · ');
      },
    },
    {
      dataIndex: 'status',
      key: 'status',
      title: '状态',
      width: 90,
      render: (value: StudentPrivateProfileBatchRefreshItem['status']) => (
        <Tag color={resolveStudentPrivateProfileBatchStatusColor(value)}>
          {resolveStudentPrivateProfileBatchStatusLabel(value)}
        </Tag>
      ),
    },
    {
      dataIndex: 'snapshotUpdated',
      key: 'snapshotUpdated',
      title: '本地资料更新',
      width: 120,
      render: (value: boolean | null) => formatStudentPrivateProfileBoolean(value),
    },
    {
      dataIndex: 'changedSections',
      key: 'changedSections',
      title: '更新内容',
      width: 180,
      render: (value: string[]) =>
        value.length > 0 ? (
          <Space size="small" wrap>
            {value.map((section) => (
              <Tag key={section}>{resolveStudentPrivateProfileSectionLabel(section)}</Tag>
            ))}
          </Space>
        ) : (
          '无'
        ),
    },
    {
      dataIndex: 'warningCodes',
      key: 'warningCodes',
      title: '提醒',
      width: 220,
      render: (value: string[]) =>
        value.length > 0 ? (
          <Space size="small" wrap>
            {value.map((code) => (
              <Tag color="warning" key={code}>
                {resolveStudentPrivateProfileWarningCodeLabel(code)}
              </Tag>
            ))}
          </Space>
        ) : (
          '无'
        ),
    },
    {
      dataIndex: 'errorCode',
      ellipsis: true,
      key: 'errorCode',
      title: '失败代码',
      width: 200,
      render: (value: string | null) => displayText(value),
    },
    {
      dataIndex: 'errorMessage',
      ellipsis: true,
      key: 'errorMessage',
      title: '失败原因',
      width: 240,
      render: (value: string | null) => displayText(value),
    },
  ];

  if (!currentAccount) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
        <Alert showIcon type="warning" title="当前登录会话尚未恢复，请稍后重试。" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <DecoratedPageHeader
        description="查看本地已同步的脱敏摘要，按需从学工系统刷新，并处理需要人工复核的资料项。"
        icon={<FileSearchOutlined />}
        title="学生资料复核"
      />

      <Card title="班级与会话">
        <div className="flex flex-col gap-4">
          <Alert
            showIcon
            type="info"
            message="先按班级查看本地资料概览；需要处理个案时，再进入学生详情核验或修正。"
          />

          <Form layout="inline">
            <Form.Item label="班级">
              <Select
                allowClear
                filterOption={(input, option) =>
                  String(option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                loading={isLoadingClasses}
                notFoundContent={isLoadingClasses ? '正在加载班级' : '没有匹配班级'}
                onChange={handleClassChange}
                options={classSelectOptions}
                placeholder="选择有当前有效学生归属的班级"
                showSearch
                style={{ minWidth: 260 }}
                value={selectedClassId}
              />
            </Form.Item>
            <Form.Item>
              <Space wrap>
                <Button
                  icon={<FileSearchOutlined />}
                  loading={isLoadingClassOverview}
                  onClick={() => void handleReloadClassOverview()}
                  type="primary"
                >
                  读取班级概览
                </Button>
                <Button icon={<LoginOutlined />} onClick={() => openLoginModal()}>
                  登录学工系统
                </Button>
                <Button icon={<ClearOutlined />} onClick={clearSession}>
                  清除会话
                </Button>
              </Space>
            </Form.Item>
          </Form>

          {classOptionsError ? <Alert showIcon type="warning" message={classOptionsError} /> : null}
          {classOverviewError ? <Alert showIcon type="error" message={classOverviewError} /> : null}
          {governanceReadinessError ? (
            <Alert showIcon type="error" message={governanceReadinessError} />
          ) : null}

          <Descriptions bordered column={3} size="small">
            <Descriptions.Item label="当前账号">{currentAccount.displayName}</Descriptions.Item>
            <Descriptions.Item label="当前班级">
              {classOverview
                ? `${classOverview.className} · ${classOverview.studentCount}人`
                : selectedClassOption
                  ? formatClassOption(selectedClassOption)
                  : '未选择'}
            </Descriptions.Item>
            <Descriptions.Item label="学工系统账号范围">
              {lockedUpstreamLoginUserId
                ? `仅本人账号：${lockedUpstreamLoginUserId}`
                : '可选择账号'}
            </Descriptions.Item>
            <Descriptions.Item label="学工系统登录">
              {upstreamSession ? `有效至 ${formatDateTime(upstreamSession.expiresAt)}` : '未建立'}
            </Descriptions.Item>
          </Descriptions>
        </div>
      </Card>

      <Tabs
        activeKey={activeTabKey}
        items={[
          {
            children: (
              <Card title={classOverview ? `${classOverview.className}资料概览` : '班级资料概览'}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {selectedClassId ? (
                    <Space size="small" wrap>
                      <Button
                        icon={<ReloadOutlined />}
                        loading={isLoadingClassOverview}
                        onClick={() => void handleReloadClassOverview()}
                      >
                        重新读取概览
                      </Button>
                      <Button icon={<CloudSyncOutlined />} onClick={() => setActiveTabKey('sync')}>
                        同步当前班级
                      </Button>
                      <Button
                        icon={<FileSearchOutlined />}
                        onClick={() => setActiveTabKey('readiness')}
                      >
                        查看治理 readiness
                      </Button>
                    </Space>
                  ) : (
                    <Empty description="先选择班级查看本地资料概览" />
                  )}

                  {classOverview ? (
                    <Descriptions bordered column={4} size="small">
                      <Descriptions.Item label="班级">{classOverview.className}</Descriptions.Item>
                      <Descriptions.Item label="班级代码">
                        {classOverview.classCode}
                      </Descriptions.Item>
                      <Descriptions.Item label="学生数">
                        {classOverview.studentCount}
                      </Descriptions.Item>
                      <Descriptions.Item label="需关注">
                        {
                          classOverview.students.filter(
                            (student) => student.attentionLevel !== 'READY',
                          ).length
                        }
                      </Descriptions.Item>
                      <Descriptions.Item label="状态分布" span={4}>
                        <Space size="small" wrap>
                          {STUDENT_PRIVATE_PROFILE_CLASS_OVERVIEW_ATTENTION_FILTERS.map((item) => (
                            <Tag key={String(item.value)}>
                              {item.text}：
                              {classOverviewAttentionCounts.get(String(item.value)) ?? 0}
                            </Tag>
                          ))}
                        </Space>
                      </Descriptions.Item>
                    </Descriptions>
                  ) : null}

                  <Table
                    columns={classOverviewColumns}
                    dataSource={classOverview?.students ?? []}
                    loading={isLoadingClassOverview}
                    locale={{
                      emptyText: selectedClassId ? '暂无班级资料概览' : '先选择班级',
                    }}
                    pagination={{
                      defaultPageSize: 30,
                      pageSizeOptions: [30, 60],
                      showSizeChanger: true,
                    }}
                    rowKey="studentId"
                    scroll={{ x: 1540 }}
                    size="small"
                  />
                </Space>
              </Card>
            ),
            key: 'overview',
            label: '班级资料概览',
          },
          {
            children: (
              <Card
                title={
                  governanceReadiness
                    ? `${governanceReadiness.className}治理 readiness`
                    : '治理 readiness'
                }
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {selectedClassId ? (
                    <Space size="small" wrap>
                      <Button
                        icon={<ReloadOutlined />}
                        loading={isLoadingGovernanceReadiness}
                        onClick={() => void handleReloadGovernanceReadiness()}
                      >
                        重新读取 readiness
                      </Button>
                      <Button icon={<CloudSyncOutlined />} onClick={() => setActiveTabKey('sync')}>
                        同步当前班级
                      </Button>
                    </Space>
                  ) : (
                    <Empty description="先选择班级查看治理 readiness" />
                  )}

                  {governanceReadiness ? (
                    <Descriptions bordered column={4} size="small">
                      <Descriptions.Item label="班级">
                        {governanceReadiness.className}
                      </Descriptions.Item>
                      <Descriptions.Item label="班级代码">
                        {governanceReadiness.classCode}
                      </Descriptions.Item>
                      <Descriptions.Item label="学生数">
                        {governanceReadiness.studentCount}
                      </Descriptions.Item>
                      <Descriptions.Item label="阻塞">
                        {governanceReadiness.blockedCount}
                      </Descriptions.Item>
                      <Descriptions.Item label="状态分布" span={4}>
                        <Space size="small" wrap>
                          <Tag color="success">可治理：{governanceReadiness.readyCount}</Tag>
                          <Tag color="warning">需关注：{governanceReadiness.warningCount}</Tag>
                          <Tag color="error">阻塞：{governanceReadiness.blockedCount}</Tag>
                        </Space>
                      </Descriptions.Item>
                    </Descriptions>
                  ) : null}

                  <Table
                    columns={governanceReadinessColumns}
                    dataSource={governanceReadiness?.students ?? []}
                    loading={isLoadingGovernanceReadiness}
                    locale={{
                      emptyText: selectedClassId ? '暂无治理 readiness' : '先选择班级',
                    }}
                    pagination={{
                      defaultPageSize: 30,
                      pageSizeOptions: [30, 60],
                      showSizeChanger: true,
                    }}
                    rowKey="studentId"
                    scroll={{ x: 1600 }}
                    size="small"
                  />
                </Space>
              </Card>
            ),
            key: 'readiness',
            label: '治理 readiness',
          },
          {
            children: (
              <div className="flex flex-col gap-6">
                <Card title="学生资料详情">
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Form
                      form={studentForm}
                      initialValues={{ studentId: '' }}
                      layout="inline"
                      onFinish={handleLoadSummary}
                    >
                      <Form.Item label="学生">
                        <Select
                          allowClear
                          disabled={!selectedClassId}
                          filterOption={(input, option) =>
                            String(option?.label ?? '')
                              .toLowerCase()
                              .includes(input.toLowerCase())
                          }
                          loading={isLoadingStudents}
                          notFoundContent={isLoadingStudents ? '正在加载学生' : '没有匹配学生'}
                          onChange={handleStudentOptionChange}
                          options={studentSelectOptions}
                          placeholder={selectedClassId ? '选择学生' : '先选择班级'}
                          showSearch
                          style={{ minWidth: 240 }}
                        />
                      </Form.Item>
                      <Form.Item
                        label="本地学生 ID"
                        name="studentId"
                        rules={[
                          { required: true, message: '请输入本地学生 ID。', whitespace: true },
                        ]}
                      >
                        <Input
                          allowClear
                          placeholder="本地学生 ID"
                          onChange={clearProfilePreview}
                        />
                      </Form.Item>
                      <Form.Item>
                        <Space wrap>
                          <Button
                            htmlType="submit"
                            icon={<FileSearchOutlined />}
                            loading={isLoadingSummary}
                            type="primary"
                          >
                            读取本地资料
                          </Button>
                          <Button
                            icon={<CloudSyncOutlined />}
                            loading={isRefreshing}
                            onClick={handleRefresh}
                          >
                            从学工系统刷新
                          </Button>
                          <Button
                            icon={<EyeOutlined />}
                            loading={isLoadingProfilePreview}
                            onClick={() => void handleOpenProfilePreview()}
                          >
                            临时预览真实字段
                          </Button>
                        </Space>
                      </Form.Item>
                    </Form>

                    {studentOptionsError ? (
                      <Alert showIcon type="warning" message={studentOptionsError} />
                    ) : null}
                  </Space>
                </Card>

                {shouldOfferSummaryReload ? (
                  <Alert
                    showIcon
                    type="info"
                    message="当前本地资料可能已更新"
                    description="最近一次小批量刷新已成功处理当前学生，请按需重新读取本地资料。"
                    action={
                      <Button
                        icon={<ReloadOutlined />}
                        loading={isLoadingSummary}
                        onClick={() => void handleReloadSummaryAfterBatch()}
                      >
                        重新读取本地资料
                      </Button>
                    }
                  />
                ) : null}

                <Card title="本地资料摘要">
                  {summary ? (
                    <div className="flex flex-col gap-4">
                      <Descriptions bordered column={3} size="small">
                        <Descriptions.Item label="学生 ID">{summary.studentId}</Descriptions.Item>
                        <Descriptions.Item label="上游资料时间">
                          {formatDateTime(summary.sourceObservedAt)}
                        </Descriptions.Item>
                        <Descriptions.Item label="本地保存时间">
                          {formatDateTime(summary.lastSyncedAt)}
                        </Descriptions.Item>
                        <Descriptions.Item label="最近人工修正">
                          {formatDateTime(summary.lastManualUpdatedAt)}
                        </Descriptions.Item>
                        <Descriptions.Item label="照片状态">
                          {formatSnapshotPhotoStatus(summary.photo)}
                        </Descriptions.Item>
                        <Descriptions.Item label="同步范围">
                          <Space size="small" wrap>
                            {STUDENT_PRIVATE_PROFILE_COMPLETENESS_ITEMS.map((item) => {
                              const isObserved = summary.profileCompletenessFlags[item.key];

                              return (
                                <Tag color={isObserved ? 'success' : 'default'} key={item.key}>
                                  {item.label}：
                                  {formatStudentPrivateProfileCompletenessStatus(isObserved)}
                                </Tag>
                              );
                            })}
                          </Space>
                        </Descriptions.Item>
                      </Descriptions>

                      <ResponsiveGrid className="gap-4" columns={{ compact: 1, large: 2 }}>
                        {SUMMARY_FIELD_SECTION_ORDER.map((section) =>
                          renderSummaryFieldSection(
                            section,
                            summaryFieldsBySection.get(section) ?? [],
                            manualPatchAccess,
                            {
                              disabled: isSummaryStudentIdMismatched,
                              onCompare: openCompareModal,
                              onPatch: openPatchModal,
                            },
                          ),
                        )}
                      </ResponsiveGrid>

                      {!familySectionBaselineToken ? (
                        <Alert
                          showIcon
                          type="warning"
                          message="家庭信息缺少 section baseline，请先刷新该学生资料后再写回学工系统。"
                        />
                      ) : null}
                      <Table
                        columns={familyColumns}
                        dataSource={summary.familyMembers}
                        locale={{ emptyText: '暂无家庭信息摘要' }}
                        pagination={false}
                        rowKey="itemKey"
                        scroll={{ x: 1000 }}
                        size="small"
                        title={() => (
                          <Space
                            align="center"
                            style={{ justifyContent: 'space-between', width: '100%' }}
                          >
                            <span>家庭成员</span>
                            {familySectionBaselineToken ? (
                              <Button
                                disabled={isSummaryStudentIdMismatched || isWritingThrough}
                                icon={<PlusOutlined />}
                                size="small"
                                onClick={openFamilyWriteThroughModal}
                              >
                                新增并写回学工系统
                              </Button>
                            ) : null}
                          </Space>
                        )}
                      />

                      {!educationSectionBaselineToken ? (
                        <Alert
                          showIcon
                          type="warning"
                          message="教育经历缺少 section baseline，请先刷新该学生资料后再写回学工系统。"
                        />
                      ) : null}
                      <Table
                        columns={educationColumns}
                        dataSource={summary.educationResumes}
                        locale={{ emptyText: '暂无教育经历摘要' }}
                        pagination={false}
                        rowKey="itemKey"
                        scroll={{ x: 950 }}
                        size="small"
                        title={() => (
                          <Space
                            align="center"
                            style={{ justifyContent: 'space-between', width: '100%' }}
                          >
                            <span>教育经历</span>
                            {educationSectionBaselineToken ? (
                              <Button
                                disabled={isSummaryStudentIdMismatched || isWritingThrough}
                                icon={<PlusOutlined />}
                                size="small"
                                onClick={openEducationWriteThroughModal}
                              >
                                新增并写回学工系统
                              </Button>
                            ) : null}
                          </Space>
                        )}
                      />

                      <Table
                        columns={recordColumns}
                        dataSource={summary.recordChanges}
                        locale={{ emptyText: '暂无学籍异动摘要' }}
                        pagination={false}
                        rowKey="itemKey"
                        scroll={{ x: 1020 }}
                        size="small"
                        title={() => '学籍异动'}
                      />

                      {summary.sectionStatuses.length > 0 ? (
                        <Descriptions bordered column={2} size="small" title="资料分区同步状态">
                          {summary.sectionStatuses.map((section) => (
                            <Descriptions.Item
                              key={section.section}
                              label={resolveStudentPrivateProfileSectionLabel(section.section)}
                            >
                              <Space direction="vertical" size="small">
                                <Space size="small" wrap>
                                  <Tag
                                    color={resolveStudentPrivateProfileStatusColor(
                                      section.sourceStatus,
                                    )}
                                  >
                                    {resolveStudentPrivateProfileStatusLabel(section.sourceStatus)}
                                  </Tag>
                                  <span>{formatDateTime(section.observedAt)}</span>
                                </Space>
                                {section.warningCodes.length > 0 ? (
                                  <Space size="small" wrap>
                                    {section.warningCodes.map((code) => (
                                      <Tag color="warning" key={code}>
                                        {resolveStudentPrivateProfileWarningCodeLabel(code)}
                                      </Tag>
                                    ))}
                                  </Space>
                                ) : null}
                              </Space>
                            </Descriptions.Item>
                          ))}
                        </Descriptions>
                      ) : null}
                    </div>
                  ) : (
                    <Empty description="先选择或输入本地学生 ID，并读取本地资料" />
                  )}
                </Card>

                {isSummaryStudentIdMismatched && summaryActionDisabledReason ? (
                  <Alert showIcon type="warning" message={summaryActionDisabledReason} />
                ) : null}

                <Card title="照片">
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Space wrap>
                      <Button
                        disabled={isSummaryStudentIdMismatched}
                        icon={<PictureOutlined />}
                        loading={isReadingPhoto}
                        onClick={() => void handleReadPhoto(false)}
                        type="primary"
                      >
                        查看照片
                      </Button>
                      <Button
                        disabled={isSummaryStudentIdMismatched}
                        icon={<ReloadOutlined />}
                        loading={isReadingPhoto}
                        onClick={() => void handleReadPhoto(true)}
                      >
                        从学工系统重读照片
                      </Button>
                    </Space>

                    {photoReadResult ? (
                      <Descriptions bordered column={1} size="small">
                        <Descriptions.Item label="状态">
                          <Space size="small" wrap>
                            <Tag
                              color={resolveStudentPrivateProfilePhotoStatusColor(
                                photoReadResult.photoStatus,
                              )}
                            >
                              {resolveStudentPrivateProfilePhotoStatusLabel(
                                photoReadResult.photoStatus,
                              )}
                            </Tag>
                            {photoReadResult.source ? (
                              <Tag
                                color={resolveStudentPrivateProfileSourceColor(
                                  photoReadResult.source,
                                )}
                              >
                                {resolveStudentPrivateProfileSourceLabel(photoReadResult.source)}
                              </Tag>
                            ) : null}
                          </Space>
                        </Descriptions.Item>
                        <Descriptions.Item label="尺寸">
                          {photoReadResult.width && photoReadResult.height
                            ? `${photoReadResult.width} x ${photoReadResult.height}`
                            : '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="大小">
                          {formatApproxByteSize(photoReadResult.byteSize)}
                        </Descriptions.Item>
                        <Descriptions.Item label="物化时间">
                          {formatDateTime(photoReadResult.materializedAt)}
                        </Descriptions.Item>
                      </Descriptions>
                    ) : null}

                    {photoReadResult ? (
                      <DiagnosticCollapse>
                        <Descriptions bordered column={1} size="small">
                          <Descriptions.Item label="追踪 ID">
                            {photoReadResult.traceId}
                          </Descriptions.Item>
                        </Descriptions>
                      </DiagnosticCollapse>
                    ) : null}

                    {photoDataUrl ? (
                      <Image
                        alt="学生照片"
                        src={photoDataUrl}
                        style={{ maxHeight: 220, objectFit: 'contain' }}
                      />
                    ) : null}

                    {photoReadResult?.warnings.length ? (
                      <Alert
                        showIcon
                        type="warning"
                        message="照片读取提醒"
                        description={photoReadResult.warnings
                          .map(
                            (warning) =>
                              `${resolveStudentPrivateProfileWarningCodeLabel(warning.code)}：${
                                warning.message
                              }`,
                          )
                          .join('\n')}
                        style={{ whiteSpace: 'pre-line' }}
                      />
                    ) : null}
                  </Space>
                </Card>

                {refreshResult ? (
                  <Card title="最近一次学工系统刷新">
                    <Descriptions bordered column={3} size="small">
                      <Descriptions.Item label="结果">
                        <Tag color={refreshResult.success ? 'success' : 'error'}>
                          {refreshResult.success ? '成功' : '失败'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="本地资料更新">
                        {formatStudentPrivateProfileBoolean(refreshResult.snapshotUpdated)}
                      </Descriptions.Item>
                      <Descriptions.Item label="更新内容">
                        {refreshResult.changedSections.length > 0
                          ? refreshResult.changedSections
                              .map((section) => resolveStudentPrivateProfileSectionLabel(section))
                              .join(', ')
                          : '无'}
                      </Descriptions.Item>
                      <Descriptions.Item label="照片">
                        {refreshResult.photoPresent
                          ? `本次观察到照片，${formatApproxByteSize(refreshResult.photoByteSize)}`
                          : '本次未观察到照片'}
                      </Descriptions.Item>
                    </Descriptions>
                    <DiagnosticCollapse>
                      <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="追踪 ID">
                          {refreshResult.traceId}
                        </Descriptions.Item>
                        <Descriptions.Item label="学工系统会话">
                          {refreshResult.upstreamSessionToken ? '已更新' : '未变化'}
                        </Descriptions.Item>
                      </Descriptions>
                    </DiagnosticCollapse>
                    {refreshResult.warnings.length > 0 ? (
                      <Alert
                        showIcon
                        type="warning"
                        message="刷新提醒"
                        description={refreshResult.warnings
                          .map(
                            (warning) =>
                              `${resolveStudentPrivateProfileWarningCodeLabel(warning.code)}：${
                                warning.message
                              }`,
                          )
                          .join('\n')}
                        style={{ marginTop: 16, whiteSpace: 'pre-line' }}
                      />
                    ) : null}
                  </Card>
                ) : null}
              </div>
            ),
            key: 'detail',
            label: '学生资料详情',
          },
          {
            children: (
              <div className="flex flex-col gap-6">
                <Card title="Excel 补录 dry-run">
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Space wrap>
                      <Select
                        options={STUDENT_PRIVATE_PROFILE_SUPPLEMENT_TEMPLATE_OPTIONS}
                        value={supplementTemplateCode}
                        style={{ minWidth: 220 }}
                        onChange={handleSupplementTemplateCodeChange}
                      />
                      <Segmented
                        options={STUDENT_PRIVATE_PROFILE_SUPPLEMENT_MODE_OPTIONS}
                        value={supplementMode}
                        onChange={(value) =>
                          handleSupplementModeChange(value as StudentPrivateProfileSupplementMode)
                        }
                      />
                      <Button
                        icon={<FileSearchOutlined />}
                        loading={isLoadingSupplementTemplate}
                        onClick={() => void loadSupplementTemplate()}
                      >
                        读取 schema
                      </Button>
                      <Button
                        disabled={
                          !summary ||
                          isSummaryStudentIdMismatched ||
                          !supplementSectionBaselineToken
                        }
                        icon={<DownloadOutlined />}
                        loading={isDownloadingSupplementTemplate}
                        onClick={() => void handleDownloadSupplementTemplate()}
                      >
                        生成当前学生 Excel
                      </Button>
                    </Space>

                    {!summary ? (
                      <Alert showIcon type="info" message="请先在学生资料详情中读取本地资料。" />
                    ) : null}
                    {summary && !supplementSectionBaselineToken ? (
                      <Alert
                        showIcon
                        type="warning"
                        message="当前补录分区缺少 section baseline，请先刷新该学生资料。"
                      />
                    ) : null}

                    {supplementTemplate ? (
                      <Descriptions bordered column={4} size="small">
                        <Descriptions.Item label="模板">
                          {resolveStudentPrivateProfileSupplementTemplateLabel(
                            supplementTemplate.templateCode,
                          )}
                        </Descriptions.Item>
                        <Descriptions.Item label="版本">
                          v{supplementTemplate.templateVersion}
                        </Descriptions.Item>
                        <Descriptions.Item label="模式">
                          {resolveStudentPrivateProfileSupplementModeLabel(supplementTemplate.mode)}
                        </Descriptions.Item>
                        <Descriptions.Item label="分区">
                          {resolveStudentPrivateProfileSectionLabel(supplementTemplate.sectionKey)}
                        </Descriptions.Item>
                        <Descriptions.Item label="动作" span={4}>
                          {supplementTemplate.actions.join(' / ')}
                        </Descriptions.Item>
                      </Descriptions>
                    ) : null}

                    <Table
                      columns={supplementTemplateColumns}
                      dataSource={supplementTemplate?.columns ?? []}
                      locale={{ emptyText: '暂无补录模板 schema' }}
                      pagination={false}
                      rowKey="key"
                      scroll={{ x: 1290 }}
                      size="small"
                    />
                  </Space>
                </Card>

                <Card title="上传与校验">
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {supplementMode === 'FLEXIBLE' ? (
                      <Alert
                        showIcon
                        type="info"
                        message="活表格模式仅执行 dry-run；未知列不会进入业务数据，也不会保存单元格明文。"
                      />
                    ) : null}

                    <Space wrap>
                      <Upload
                        accept=".xlsx"
                        beforeUpload={handleSupplementFileBeforeUpload}
                        fileList={
                          supplementUploadFile
                            ? [
                                {
                                  name: supplementUploadFile.name,
                                  size: supplementUploadFile.size,
                                  status: 'done' as const,
                                  uid: 'supplement-file',
                                },
                              ]
                            : []
                        }
                        maxCount={1}
                        onRemove={handleSupplementFileRemove}
                      >
                        <Button icon={<UploadOutlined />}>选择 Excel</Button>
                      </Upload>
                      <Button
                        disabled={!supplementTemplate || !supplementUploadFile}
                        icon={<UploadOutlined />}
                        loading={isUploadingSupplementFile}
                        onClick={() => void handleUploadSupplementFile()}
                      >
                        上传文件
                      </Button>
                      <Button
                        disabled={!supplementTemplate || !supplementUploadResult}
                        icon={<FileExcelOutlined />}
                        loading={isRunningSupplementDryRun}
                        type="primary"
                        onClick={() => void handleRunSupplementDryRun()}
                      >
                        dry-run 校验
                      </Button>
                    </Space>

                    {supplementUploadResult ? (
                      <Descriptions bordered column={3} size="small">
                        <Descriptions.Item label="文件">
                          {supplementUploadResult.originalFilename}
                        </Descriptions.Item>
                        <Descriptions.Item label="大小">
                          {formatApproxByteSize(supplementUploadResult.byteSize)}
                        </Descriptions.Item>
                        <Descriptions.Item label="有效期">
                          {formatDateTime(supplementUploadResult.expiresAt)}
                        </Descriptions.Item>
                      </Descriptions>
                    ) : null}

                    {supplementDryRunResult ? (
                      <Descriptions bordered column={5} size="small">
                        <Descriptions.Item label="结果">
                          <Tag
                            color={resolveStudentPrivateProfileSupplementDryRunStatusColor(
                              supplementDryRunResult.status,
                            )}
                          >
                            {resolveStudentPrivateProfileSupplementDryRunStatusLabel(
                              supplementDryRunResult.status,
                            )}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="模式">
                          {resolveStudentPrivateProfileSupplementModeLabel(
                            supplementDryRunResult.mode,
                          )}
                        </Descriptions.Item>
                        <Descriptions.Item label="总行数">
                          {supplementDryRunResult.totalRows}
                        </Descriptions.Item>
                        <Descriptions.Item label="有效行">
                          {supplementDryRunResult.validRows}
                        </Descriptions.Item>
                        <Descriptions.Item label="无效行">
                          {supplementDryRunResult.invalidRows}
                        </Descriptions.Item>
                        <Descriptions.Item label="影响学生">
                          {supplementDryRunResult.affectedStudents}
                        </Descriptions.Item>
                        <Descriptions.Item label="表头问题">
                          {supplementDryRunResult.fileIssues.length}
                        </Descriptions.Item>
                      </Descriptions>
                    ) : null}

                    {supplementDryRunResult ? (
                      <Table
                        columns={supplementDryRunFileIssueColumns}
                        dataSource={supplementDryRunResult.fileIssues}
                        locale={{ emptyText: '暂无文件级问题' }}
                        pagination={false}
                        rowKey={(record) =>
                          `${record.columnIndex ?? 'file'}-${record.header ?? ''}-${record.code}-${
                            record.columnKey ?? ''
                          }`
                        }
                        scroll={{ x: 760 }}
                        size="small"
                        title={() => '文件级问题'}
                      />
                    ) : null}

                    {supplementDryRunResult ? (
                      <Table
                        columns={supplementColumnMappingColumns}
                        dataSource={supplementDryRunResult.columnMappings}
                        locale={{ emptyText: '暂无列映射结果' }}
                        pagination={false}
                        rowKey={(record) => `${record.columnIndex}-${record.header}`}
                        scroll={{ x: 1020 }}
                        size="small"
                        title={() => '列映射结果'}
                      />
                    ) : null}

                    <Table
                      columns={supplementDryRunColumns}
                      dataSource={supplementDryRunResult?.rowResults ?? []}
                      locale={{ emptyText: '暂无 dry-run 行结果' }}
                      pagination={{
                        defaultPageSize: 20,
                        pageSizeOptions: [20, 50],
                        showSizeChanger: true,
                      }}
                      rowKey="rowNumber"
                      scroll={{ x: 1040 }}
                      size="small"
                    />
                  </Space>
                </Card>
              </div>
            ),
            key: 'supplement',
            label: 'Excel 补录 dry-run',
          },
          {
            children: (
              <div className="flex flex-col gap-6">
                <Card title="班级资料同步">
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Alert
                      showIcon
                      type="info"
                      message="同步当前班级中已关联学工系统的学生；未关联学生会保留在概览中提示。"
                    />

                    <Descriptions bordered column={4} size="small">
                      <Descriptions.Item label="当前班级">
                        {classOverview?.className ?? selectedClassOption?.className ?? '未选择'}
                      </Descriptions.Item>
                      <Descriptions.Item label="班级学生">
                        {classRefreshSourceStudents.length}
                      </Descriptions.Item>
                      <Descriptions.Item label="将同步">
                        {classRefreshCandidateStudentIds.length}
                      </Descriptions.Item>
                      <Descriptions.Item label="未关联学工系统">
                        {classRefreshSkippedCount}
                      </Descriptions.Item>
                      <Descriptions.Item label="分片策略" span={4}>
                        每批最多 {CLASS_BATCH_REFRESH_CHUNK_SIZE} 人，串行同步，批次间隔{' '}
                        {CLASS_BATCH_REFRESH_INTERVAL_MS / 1000} 秒。
                      </Descriptions.Item>
                    </Descriptions>

                    {classRefreshSkippedCount > 0 ? (
                      <Alert
                        showIcon
                        type="warning"
                        message={`${classRefreshSkippedCount} 名学生未关联学工系统，本次不会提交刷新。`}
                      />
                    ) : null}

                    {batchRefreshResult ? (
                      <Progress
                        percent={batchRefreshPercent}
                        status={isBatchRefreshing ? 'active' : 'normal'}
                      />
                    ) : null}

                    <Space wrap>
                      <Button
                        disabled={!selectedClassId || classRefreshCandidateStudentIds.length === 0}
                        icon={<CloudSyncOutlined />}
                        loading={isBatchRefreshing}
                        onClick={() => void handleBatchRefresh()}
                        type="primary"
                      >
                        同步当前班级资料
                      </Button>
                      <Button icon={<LoginOutlined />} onClick={() => openLoginModal()}>
                        登录学工系统
                      </Button>
                    </Space>
                  </Space>
                </Card>

                {batchRefreshResult ? (
                  <Card title="班级同步结果">
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      <Descriptions bordered column={4} size="small">
                        <Descriptions.Item label="总体结果">
                          <Tag color={batchRefreshResult.success ? 'success' : 'warning'}>
                            {batchRefreshResult.success ? '全部成功' : '部分失败'}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="请求人数">
                          {batchRefreshResult.requestedCount}
                        </Descriptions.Item>
                        <Descriptions.Item label="成功人数">
                          {batchRefreshResult.successCount}
                        </Descriptions.Item>
                        <Descriptions.Item label="失败人数">
                          {batchRefreshResult.failureCount}
                        </Descriptions.Item>
                        <Descriptions.Item label="完成批次">
                          {batchRefreshResult.completedChunks}/{batchRefreshResult.totalChunks}
                        </Descriptions.Item>
                      </Descriptions>

                      <DiagnosticCollapse>
                        <Descriptions bordered column={3} size="small">
                          <Descriptions.Item label="最近追踪 ID">
                            {batchRefreshResult.traceId}
                          </Descriptions.Item>
                          <Descriptions.Item label="追踪 ID 数">
                            {batchRefreshResult.traceIds.length}
                          </Descriptions.Item>
                          <Descriptions.Item label="学工系统会话">
                            {batchRefreshResult.upstreamSessionToken ? '已更新' : '未返回'}
                          </Descriptions.Item>
                          <Descriptions.Item label="会话有效期">
                            {batchRefreshResult.expiresAt
                              ? formatDateTime(batchRefreshResult.expiresAt)
                              : '本次未变化'}
                          </Descriptions.Item>
                        </Descriptions>
                      </DiagnosticCollapse>

                      <Table
                        columns={batchRefreshColumns}
                        dataSource={batchRefreshResult.results}
                        pagination={false}
                        rowKey="studentId"
                        scroll={{ x: 1390 }}
                        size="small"
                      />
                    </Space>
                  </Card>
                ) : null}
              </div>
            ),
            key: 'sync',
            label: '班级资料同步',
          },
        ]}
        onChange={handleTabChange}
      />

      <Modal
        footer={null}
        open={Boolean(activeCompareField)}
        title={`核验 ${activeCompareFieldLabel}`}
        onCancel={closeCompareModal}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert showIcon type="info" message="候选值仅用于本次核验，提交后不会保留原文。" />
          <Form form={compareForm} layout="vertical" onFinish={handleCompare}>
            <Form.Item
              label="候选值"
              name="candidateValue"
              rules={[{ required: true, message: '请输入候选值。', whitespace: true }]}
            >
              <Input.Password autoComplete="off" placeholder="输入需要核验的候选值" />
            </Form.Item>
            <Space wrap>
              <Button onClick={closeCompareModal}>取消</Button>
              <Button
                htmlType="submit"
                icon={<CheckCircleOutlined />}
                loading={isComparing}
                type="primary"
              >
                开始核验
              </Button>
            </Space>
          </Form>

          {compareResult ? (
            <Descriptions bordered column={1} size="small">
              {compareResult.results.map((result) => (
                <Descriptions.Item
                  key={result.fieldKey}
                  label={resolveStudentPrivateProfileFieldLabel(result.fieldKey)}
                >
                  <Space size="small" wrap>
                    <Tag color={resolveStudentPrivateProfileCompareResultColor(result.result)}>
                      {resolveStudentPrivateProfileCompareResultLabel(result.result)}
                    </Tag>
                    <Tag>{resolveStudentPrivateProfileStatusLabel(result.valueStatus)}</Tag>
                  </Space>
                </Descriptions.Item>
              ))}
            </Descriptions>
          ) : null}
        </Space>
      </Modal>

      <Modal
        footer={null}
        open={Boolean(activePatchField)}
        title={`修正 ${activePatchFieldLabel}`}
        onCancel={closePatchModal}
      >
        <Form form={patchForm} layout="vertical" onFinish={handlePatch}>
          <Form.Item label="动作" name="action" rules={[{ required: true }]}>
            <Radio.Group
              options={[
                { label: '写入修正', value: 'SET' },
                { label: '清除人工修正', value: 'CLEAR' },
              ]}
              optionType="button"
            />
          </Form.Item>
          {patchAction === 'SET' ? (
            <Form.Item
              label="修正值"
              name="value"
              rules={[{ required: true, message: '请输入修正值。', whitespace: true }]}
            >
              <Input.Password autoComplete="off" placeholder="提交后不在页面保存原文" />
            </Form.Item>
          ) : null}
          <Space wrap>
            <Button onClick={closePatchModal}>取消</Button>
            <Button htmlType="submit" icon={<EditOutlined />} loading={isPatching} type="primary">
              保存修正
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        footer={null}
        open={Boolean(activeFamilyPatchMember)}
        title={`修正 ${activeFamilyPatchMemberLabel}`}
        onCancel={closeFamilyPatchModal}
      >
        <Form form={familyPatchForm} layout="vertical" onFinish={handleFamilyPatch}>
          <Form.Item label="字段" name="fieldKey" rules={[{ required: true }]}>
            <Select options={STUDENT_PRIVATE_PROFILE_FAMILY_PATCH_FIELD_OPTIONS} />
          </Form.Item>
          <Form.Item label="动作" name="action" rules={[{ required: true }]}>
            <Radio.Group
              options={[
                { label: '写入修正', value: 'SET' },
                { label: '清除人工修正', value: 'CLEAR' },
              ]}
              optionType="button"
            />
          </Form.Item>
          {familyPatchAction === 'SET' ? (
            <Form.Item
              label="修正值"
              name="value"
              rules={[{ required: true, message: '请输入修正值。', whitespace: true }]}
            >
              <Input.Password autoComplete="off" placeholder="提交后不在页面保存原文" />
            </Form.Item>
          ) : null}
          <Space wrap>
            <Button onClick={closeFamilyPatchModal}>取消</Button>
            <Button
              htmlType="submit"
              icon={<EditOutlined />}
              loading={isPatchingFamily}
              type="primary"
            >
              保存修正
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        destroyOnHidden
        footer={null}
        open={isFamilyWriteThroughOpen}
        title="新增家庭成员并写回学工系统"
        onCancel={closeFamilyWriteThroughModal}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            showIcon
            type="warning"
            message="该操作会写回学工系统，并在成功后刷新本地家庭信息 section。"
          />
          <Form
            form={familyWriteThroughForm}
            layout="vertical"
            onFinish={handleFamilyWriteThroughCreate}
          >
            <Form.Item
              label="家庭关系"
              name="relationshipCode"
              rules={[{ required: true, message: '请选择家庭关系。' }]}
            >
              <Select
                options={[
                  { label: '父亲', value: '1' },
                  { label: '母亲', value: '2' },
                  { label: '祖父母', value: '3' },
                  { label: '兄弟姐妹', value: '4' },
                ]}
              />
            </Form.Item>
            <Form.Item
              label="姓名"
              name="name"
              rules={[{ required: true, message: '请输入家庭成员姓名。', whitespace: true }]}
            >
              <Input autoComplete="off" />
            </Form.Item>
            <Form.Item label="电话" name="phone">
              <Input autoComplete="off" />
            </Form.Item>
            <Form.Item label="工作单位" name="workplace">
              <Input autoComplete="off" />
            </Form.Item>
            <Space wrap>
              <Button onClick={closeFamilyWriteThroughModal}>取消</Button>
              <Button
                htmlType="submit"
                icon={<CloudSyncOutlined />}
                loading={isWritingThrough}
                type="primary"
              >
                写回学工系统
              </Button>
            </Space>
          </Form>
        </Space>
      </Modal>

      <Modal
        destroyOnHidden
        footer={null}
        open={isEducationWriteThroughOpen}
        title="新增教育经历并写回学工系统"
        onCancel={closeEducationWriteThroughModal}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            showIcon
            type="warning"
            message="该操作会写回学工系统，并在成功后刷新本地教育经历 section。"
          />
          <Form
            form={educationWriteThroughForm}
            layout="vertical"
            onFinish={handleEducationWriteThroughCreate}
          >
            <Form.Item
              label="开始日期"
              name="startDate"
              rules={[
                { required: true, message: '请输入开始日期。', whitespace: true },
                {
                  message: '开始日期必须是合法日期，格式为 YYYY-MM-DD。',
                  validator: (_, value: string | undefined) =>
                    isValidWriteThroughDate(value) ? Promise.resolve() : Promise.reject(),
                },
              ]}
            >
              <Input autoComplete="off" placeholder="2020-09-01" />
            </Form.Item>
            <Form.Item
              label="结束日期"
              name="endDate"
              rules={[
                { required: true, message: '请输入结束日期。', whitespace: true },
                {
                  message: '结束日期必须是合法日期，格式为 YYYY-MM-DD。',
                  validator: (_, value: string | undefined) =>
                    isValidWriteThroughDate(value) ? Promise.resolve() : Promise.reject(),
                },
              ]}
            >
              <Input autoComplete="off" placeholder="2023-06-30" />
            </Form.Item>
            <Form.Item
              label="证明人"
              name="reference"
              rules={[{ required: true, message: '请输入证明人。', whitespace: true }]}
            >
              <Input autoComplete="off" />
            </Form.Item>
            <Form.Item
              label="学校"
              name="organization"
              rules={[{ required: true, message: '请输入学校。', whitespace: true }]}
            >
              <Input autoComplete="off" />
            </Form.Item>
            <Space wrap>
              <Button onClick={closeEducationWriteThroughModal}>取消</Button>
              <Button
                htmlType="submit"
                icon={<CloudSyncOutlined />}
                loading={isWritingThrough}
                type="primary"
              >
                写回学工系统
              </Button>
            </Space>
          </Form>
        </Space>
      </Modal>

      <Drawer
        destroyOnHidden
        open={isProfilePreviewOpen}
        title="临时预览真实字段"
        width={960}
        onClose={clearProfilePreview}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            showIcon
            type="warning"
            message="临时预览只显示当前学生模板白名单内真实字段；关闭或切换上下文后会清空。"
          />

          {profilePreviewError ? (
            <Alert showIcon type="error" message={profilePreviewError} />
          ) : null}

          {profilePreview ? (
            <>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="学生 ID">{profilePreview.studentId}</Descriptions.Item>
                <Descriptions.Item label="模板">
                  {profilePreview.templateCode} v{profilePreview.templateVersion}
                </Descriptions.Item>
                <Descriptions.Item label="上游资料时间">
                  {formatDateTime(profilePreview.sourceObservedAt)}
                </Descriptions.Item>
                <Descriptions.Item label="本地保存时间">
                  {formatDateTime(profilePreview.lastSyncedAt)}
                </Descriptions.Item>
                <Descriptions.Item label="最近人工修正">
                  {formatDateTime(profilePreview.lastManualUpdatedAt)}
                </Descriptions.Item>
                <Descriptions.Item label="照片 metadata">
                  {profilePreview.photo
                    ? `${profilePreview.photo.present ? '有照片' : '无照片'}，${formatApproxByteSize(
                        profilePreview.photo.byteSize,
                      )}，${formatDateTime(profilePreview.photo.sourceObservedAt)}`
                    : '模板未返回'}
                </Descriptions.Item>
              </Descriptions>

              {Array.from(previewFieldsBySection.entries()).map(([section, fields]) => (
                <Table
                  columns={previewFieldColumns}
                  dataSource={fields}
                  key={section}
                  pagination={false}
                  rowKey="fieldKey"
                  scroll={{ x: 830 }}
                  size="small"
                  title={() => resolveStudentPrivateProfileSectionLabel(section)}
                />
              ))}

              <Collapse
                items={profilePreview.familyMembers.map(
                  (member: StudentPrivateProfilePreviewFamilyMember, index) => ({
                    children: (
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Descriptions bordered column={3} size="small">
                          <Descriptions.Item label="观察时间">
                            {formatDateTime(member.sourceObservedAt)}
                          </Descriptions.Item>
                          <Descriptions.Item label="更新时间">
                            {formatDateTime(member.sourceUpdatedAt)}
                          </Descriptions.Item>
                          <Descriptions.Item label="复核">
                            <Space size="small" wrap>
                              {member.manualOverrideActive ? (
                                <Tag color="processing">人工修正</Tag>
                              ) : null}
                              {member.upstreamChangedSinceManualPatch ? (
                                <Tag color="warning">上游已变化</Tag>
                              ) : null}
                              {member.manualPatchFieldKeys.map((fieldKey) => (
                                <Tag key={fieldKey}>
                                  {resolveStudentPrivateProfileFamilyFieldLabel(fieldKey)}
                                </Tag>
                              ))}
                              {!member.manualOverrideActive &&
                              !member.upstreamChangedSinceManualPatch &&
                              member.manualPatchFieldKeys.length === 0
                                ? '无'
                                : null}
                            </Space>
                          </Descriptions.Item>
                        </Descriptions>
                        <Table
                          columns={previewFieldColumns}
                          dataSource={sortPreviewFields(member.fields)}
                          pagination={false}
                          rowKey="fieldKey"
                          scroll={{ x: 830 }}
                          size="small"
                        />
                      </Space>
                    ),
                    key: member.itemKey,
                    label: `家庭成员 ${index + 1}`,
                  }),
                )}
                size="small"
              />

              <Collapse
                items={profilePreview.educationResumes.map(
                  (resume: StudentPrivateProfilePreviewEducationResume, index) => ({
                    children: (
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Descriptions bordered column={2} size="small">
                          <Descriptions.Item label="观察时间">
                            {formatDateTime(resume.sourceObservedAt)}
                          </Descriptions.Item>
                          <Descriptions.Item label="更新时间">
                            {formatDateTime(resume.sourceUpdatedAt)}
                          </Descriptions.Item>
                        </Descriptions>
                        <Table
                          columns={previewFieldColumns}
                          dataSource={sortPreviewFields(resume.fields)}
                          pagination={false}
                          rowKey="fieldKey"
                          scroll={{ x: 830 }}
                          size="small"
                        />
                      </Space>
                    ),
                    key: resume.itemKey,
                    label: `教育经历 ${index + 1}`,
                  }),
                )}
                size="small"
              />

              <Collapse
                items={profilePreview.recordChanges.map(
                  (record: StudentPrivateProfilePreviewRecordChange, index) => ({
                    children: (
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Descriptions bordered column={1} size="small">
                          <Descriptions.Item label="观察时间">
                            {formatDateTime(record.sourceObservedAt)}
                          </Descriptions.Item>
                        </Descriptions>
                        <Table
                          columns={previewFieldColumns}
                          dataSource={sortPreviewFields(record.fields)}
                          pagination={false}
                          rowKey="fieldKey"
                          scroll={{ x: 830 }}
                          size="small"
                        />
                      </Space>
                    ),
                    key: record.itemKey,
                    label: `学籍异动 ${index + 1}`,
                  }),
                )}
                size="small"
              />
            </>
          ) : isLoadingProfilePreview ? (
            <Table
              columns={previewFieldColumns}
              dataSource={[]}
              loading
              pagination={false}
              rowKey="fieldKey"
              size="small"
            />
          ) : null}
        </Space>
      </Drawer>

      <UpstreamLoginModal {...upstreamLoginModalProps} />
    </div>
  );
}
