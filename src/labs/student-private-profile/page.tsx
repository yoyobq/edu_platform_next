// src/labs/student-private-profile/page.tsx

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircleOutlined,
  ClearOutlined,
  CloudSyncOutlined,
  EditOutlined,
  FileSearchOutlined,
  LoginOutlined,
  PictureOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Collapse,
  Descriptions,
  Empty,
  Form,
  Image,
  Input,
  Modal,
  Progress,
  Radio,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
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
  resolveStudentPrivateProfileManualPatchField,
  resolveStudentPrivateProfilePhotoStatusColor,
  resolveStudentPrivateProfilePhotoStatusLabel,
  resolveStudentPrivateProfileRecordChangeTypeLabel,
  resolveStudentPrivateProfileSectionLabel,
  resolveStudentPrivateProfileSourceColor,
  resolveStudentPrivateProfileSourceLabel,
  resolveStudentPrivateProfileStatusColor,
  resolveStudentPrivateProfileStatusLabel,
  resolveStudentPrivateProfileWarningCodeLabel,
  STUDENT_PRIVATE_PROFILE_CLASS_OVERVIEW_ATTENTION_FILTERS,
  STUDENT_PRIVATE_PROFILE_COMPLETENESS_ITEMS,
  STUDENT_PRIVATE_PROFILE_FAMILY_PATCH_FIELD_OPTIONS,
} from './application/display-policy';
import {
  compareStudentPrivateProfileFields,
  getStudentPrivateProfileClassOverview,
  getStudentPrivateProfileSummary,
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
  type StudentPrivateProfileManualPatchAction,
  type StudentPrivateProfileManualPatchField,
  type StudentPrivateProfilePhotoReadResult,
  type StudentPrivateProfileRefreshResult,
  type StudentPrivateProfileStudentOption,
  type StudentPrivateProfileSummary,
  type StudentPrivateProfileSummaryEducationResume,
  type StudentPrivateProfileSummaryFamilyMember,
  type StudentPrivateProfileSummaryField,
  type StudentPrivateProfileSummaryRecordChange,
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
    };

type StudentPrivateProfileLabTabKey = 'detail' | 'overview' | 'sync';

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
      .join(' · ') || member.itemKey
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
  const { message } = AntApp.useApp();
  const [studentForm] = Form.useForm<{ studentId: string }>();
  const [compareForm] = Form.useForm<CompareFormValues>();
  const [patchForm] = Form.useForm<PatchFormValues>();
  const [familyPatchForm] = Form.useForm<FamilyPatchFormValues>();
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
  const [photoReadResult, setPhotoReadResult] =
    useState<StudentPrivateProfilePhotoReadResult | null>(null);
  const [activeTabKey, setActiveTabKey] = useState<StudentPrivateProfileLabTabKey>('overview');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isLoadingClassOverview, setIsLoadingClassOverview] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBatchRefreshing, setIsBatchRefreshing] = useState(false);
  const [isReadingPhoto, setIsReadingPhoto] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isPatching, setIsPatching] = useState(false);
  const [isPatchingFamily, setIsPatchingFamily] = useState(false);
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
  const [upstreamActionRequest, setUpstreamActionRequest] = useState<{
    action: UpstreamPendingAction;
    session: StoredUpstreamSession;
  } | null>(null);

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
    [message, studentForm],
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
        }
      } finally {
        setIsBatchRefreshing(false);
      }
    },
    [
      commitBatchRefreshResult,
      loadClassOverview,
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

    void runPhotoReadWithSession(
      upstreamActionRequest.session,
      upstreamActionRequest.action.studentId,
      upstreamActionRequest.action.forceRefresh,
    );
  }, [
    runBatchRefreshWithSession,
    runPhotoReadWithSession,
    runRefreshWithSession,
    upstreamActionRequest,
  ]);

  const handleLoadSummary = useCallback(async () => {
    await loadSummary(currentStudentId);
  }, [currentStudentId, loadSummary]);

  const handleClassChange = useCallback(
    (classId: string | null) => {
      setSelectedClassId(classId);
      setStudents([]);
      setBatchRefreshResult(null);
      setClassOverview(null);
      setClassOverviewError(null);
      setStudentOptionsError(null);
      setActiveTabKey('overview');

      if (!classId) {
        return;
      }

      void loadStudentsForClass(classId);
      void loadClassOverview(classId);
    },
    [loadClassOverview, loadStudentsForClass],
  );

  const handleStudentOptionChange = useCallback(
    (studentId: string | null) => {
      studentForm.setFieldValue('studentId', studentId ?? '');
    },
    [studentForm],
  );

  const openStudentDetail = useCallback(
    (studentId: string) => {
      studentForm.setFieldValue('studentId', studentId);
      setActiveTabKey('detail');
      void loadSummary(studentId);
    },
    [loadSummary, studentForm],
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
      width: 90,
      render: (_, record) =>
        canPatchStudentPrivateProfileFamily(manualPatchAccess) && record.upstreamBaselineToken ? (
          <Button
            disabled={isSummaryStudentIdMismatched}
            size="small"
            type="link"
            onClick={() => openFamilyPatchModal(record)}
          >
            修正
          </Button>
        ) : (
          '—'
        ),
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
                    pagination={{ pageSize: 20, showSizeChanger: true }}
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
                        <Input allowClear placeholder="本地学生 ID" />
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

                      <Table
                        columns={familyColumns}
                        dataSource={summary.familyMembers}
                        locale={{ emptyText: '暂无家庭信息摘要' }}
                        pagination={false}
                        rowKey="itemKey"
                        scroll={{ x: 900 }}
                        size="small"
                        title={() => '家庭成员'}
                      />

                      <Table
                        columns={educationColumns}
                        dataSource={summary.educationResumes}
                        locale={{ emptyText: '暂无教育经历摘要' }}
                        pagination={false}
                        rowKey="itemKey"
                        scroll={{ x: 830 }}
                        size="small"
                        title={() => '教育经历'}
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
        onChange={(key) => setActiveTabKey(key as StudentPrivateProfileLabTabKey)}
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

      <UpstreamLoginModal {...upstreamLoginModalProps} />
    </div>
  );
}
