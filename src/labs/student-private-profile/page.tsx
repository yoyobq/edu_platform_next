// src/labs/student-private-profile/page.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Descriptions,
  Empty,
  Form,
  Image,
  Input,
  Radio,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
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

import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

import {
  formatStudentPrivateProfileBoolean,
  formatStudentPrivateProfileCompletenessStatus,
  normalizeStudentPrivateProfileFieldKey,
  resolveStudentPrivateProfileBatchStatusColor,
  resolveStudentPrivateProfileBatchStatusLabel,
  resolveStudentPrivateProfileCompareResultColor,
  resolveStudentPrivateProfileCompareResultLabel,
  resolveStudentPrivateProfileFamilyFieldLabel,
  resolveStudentPrivateProfileFamilyRelationshipLabel,
  resolveStudentPrivateProfileFieldLabel,
  resolveStudentPrivateProfileFieldOrder,
  resolveStudentPrivateProfilePhotoStatusColor,
  resolveStudentPrivateProfilePhotoStatusLabel,
  resolveStudentPrivateProfileRecordChangeTypeLabel,
  resolveStudentPrivateProfileSectionLabel,
  resolveStudentPrivateProfileSourceColor,
  resolveStudentPrivateProfileSourceLabel,
  resolveStudentPrivateProfileStatusColor,
  resolveStudentPrivateProfileStatusLabel,
  resolveStudentPrivateProfileWarningCodeLabel,
  STUDENT_PRIVATE_PROFILE_COMPARE_FIELD_OPTIONS,
  STUDENT_PRIVATE_PROFILE_COMPLETENESS_ITEMS,
  STUDENT_PRIVATE_PROFILE_FAMILY_PATCH_FIELD_OPTIONS,
  STUDENT_PRIVATE_PROFILE_PATCH_FIELD_OPTIONS,
} from './application/display-policy';
import {
  compareStudentPrivateProfileFields,
  getStudentPrivateProfileSummary,
  isExpiredUpstreamSessionError,
  isStudentPrivateProfileUpstreamSessionRequiredError,
  listStudentPrivateProfileClassOptions,
  listStudentPrivateProfileClassStudentOptions,
  normalizeBatchRefreshStudentIds,
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
  type StudentPrivateProfileCompareField,
  type StudentPrivateProfileCompareResult,
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
      studentIds: string[];
      type: 'batch-refresh';
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
  fieldKey?: StudentPrivateProfileCompareField;
};

type PatchFormValues = {
  action?: StudentPrivateProfileManualPatchAction;
  fieldKey?: StudentPrivateProfileManualPatchField;
  value?: string;
};

type FamilyPatchFormValues = {
  action?: StudentPrivateProfileManualPatchAction;
  fieldKey?: StudentPrivateProfileFamilyMemberPatchField;
  itemKey?: string;
  value?: string;
};

const SENSITIVE_IDENTIFIER_PATCH_FIELDS = new Set(['ID_CARD', 'BANK_CARD_NUMBER', 'CARD_NUMBER']);

const CONTACT_AND_ADDRESS_PATCH_FIELDS = new Set([
  'STUDENT_PHONE',
  'CONTACT_PERSON_PHONE',
  'HOME_ADDRESS',
  'MAILING_ADDRESS',
]);

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

function parseBatchStudentIdText(value: string) {
  return value.split(/[\s,，;；]+/).filter(Boolean);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '未记录';
  }

  return formatUpstreamSessionDateTime(value);
}

function displayText(value: string | null | undefined) {
  return value?.trim() || '未记录';
}

function formatApproxByteSize(byteSize: number | null | undefined) {
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return '约 0 KB';
  }

  return `约 ${Math.round(byteSize / 1024).toLocaleString('zh-CN')} KB`;
}

function formatSnapshotPhotoStatus(photo: StudentPrivateProfileSummary['photo']) {
  if (!photo.present) {
    return '待同步';
  }

  return `已同步，${formatApproxByteSize(photo.byteSize)}`;
}

function formatFamilyMemberOption(member: StudentPrivateProfileSummaryFamilyMember) {
  return [
    resolveStudentPrivateProfileFamilyRelationshipLabel(member.relationshipCode),
    member.maskedName ? `姓名 ${member.maskedName}` : null,
    member.maskedPhone ? `电话 ${member.maskedPhone}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
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

function canPatchStudentPrivateProfileField(
  fieldKey: string,
  access: StudentPrivateProfileManualPatchAccess,
) {
  const patchFieldKey = normalizeStudentPrivateProfileFieldKey(fieldKey);

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
  const [batchRefreshResult, setBatchRefreshResult] =
    useState<StudentPrivateProfileBatchRefreshResult | null>(null);
  const [photoReadResult, setPhotoReadResult] =
    useState<StudentPrivateProfilePhotoReadResult | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBatchRefreshing, setIsBatchRefreshing] = useState(false);
  const [isReadingPhoto, setIsReadingPhoto] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isPatching, setIsPatching] = useState(false);
  const [isPatchingFamily, setIsPatchingFamily] = useState(false);
  const [classes, setClasses] = useState<StudentPrivateProfileClassOption[]>([]);
  const [students, setStudents] = useState<StudentPrivateProfileStudentOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [batchSelectedStudentIds, setBatchSelectedStudentIds] = useState<string[]>([]);
  const [batchManualStudentIds, setBatchManualStudentIds] = useState('');
  const [batchUpdatedStudentIdsNeedingReload, setBatchUpdatedStudentIdsNeedingReload] = useState<
    string[]
  >([]);
  const [classOptionsError, setClassOptionsError] = useState<string | null>(null);
  const [studentOptionsError, setStudentOptionsError] = useState<string | null>(null);
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
  const summaryFieldByKey = useMemo(
    () =>
      new Map(
        summaryFields.map((field) => [
          normalizeStudentPrivateProfileFieldKey(field.fieldKey),
          field,
        ]),
      ),
    [summaryFields],
  );
  const familyMemberByItemKey = useMemo(
    () => new Map((summary?.familyMembers ?? []).map((member) => [member.itemKey, member])),
    [summary?.familyMembers],
  );
  const familyMemberOptions = useMemo(
    () =>
      (summary?.familyMembers ?? []).map((member) => ({
        label: formatFamilyMemberOption(member),
        value: member.itemKey,
      })),
    [summary?.familyMembers],
  );
  const patchFieldOptions = useMemo(
    () =>
      STUDENT_PRIVATE_PROFILE_PATCH_FIELD_OPTIONS.filter((option) =>
        canPatchStudentPrivateProfileField(option.value, manualPatchAccess),
      ),
    [manualPatchAccess],
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
  const batchManualStudentIdCandidates = useMemo(
    () => parseBatchStudentIdText(batchManualStudentIds),
    [batchManualStudentIds],
  );
  const batchStudentIdCandidates = useMemo(
    () => [...batchSelectedStudentIds, ...batchManualStudentIdCandidates],
    [batchManualStudentIdCandidates, batchSelectedStudentIds],
  );
  const batchStudentIdsPreview = useMemo(() => {
    try {
      return {
        error: null,
        studentIds: normalizeBatchRefreshStudentIds(batchStudentIdCandidates),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : '批量刷新学生 ID 输入无效。',
        studentIds: [] as string[],
      };
    }
  }, [batchStudentIdCandidates]);
  const shouldOfferSummaryReload = Boolean(
    summary?.studentId && batchUpdatedStudentIdsNeedingReload.includes(summary.studentId),
  );

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
        setStudentOptionsError('该班级暂未返回 active 学生归属，仍可直接输入本地学生 ID。');
      }
    } catch (error) {
      setStudentOptionsError(
        resolveUpstreamErrorMessage(error, '暂时无法加载班级学生列表，仍可直接输入本地学生 ID。'),
      );
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    if (!currentAccount) {
      return;
    }

    void loadClasses();
  }, [currentAccount, loadClasses]);

  useEffect(() => {
    const currentFieldKey = patchForm.getFieldValue('fieldKey') as
      | StudentPrivateProfileManualPatchField
      | undefined;

    if (currentFieldKey && patchFieldOptions.some((option) => option.value === currentFieldKey)) {
      return;
    }

    patchForm.setFieldValue('fieldKey', patchFieldOptions[0]?.value);
  }, [patchFieldOptions, patchForm]);

  useEffect(() => {
    const currentItemKey = familyPatchForm.getFieldValue('itemKey') as string | undefined;

    if (currentItemKey && familyMemberByItemKey.has(currentItemKey)) {
      return;
    }

    familyPatchForm.setFieldValue('itemKey', familyMemberOptions[0]?.value);
  }, [familyMemberByItemKey, familyMemberOptions, familyPatchForm]);

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

  const applyBatchRefreshResult = useCallback(
    (result: StudentPrivateProfileBatchRefreshResult) => {
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

      if (result.success) {
        message.success(`批量刷新完成，成功 ${result.successCount} 人。`);
        return;
      }

      message.warning(
        `批量刷新完成，成功 ${result.successCount} 人，失败 ${result.failureCount} 人。`,
      );
    },
    [message],
  );

  const runBatchRefreshWithSession = useCallback(
    async (session: StoredUpstreamSession, studentIds: string[]) => {
      setIsBatchRefreshing(true);

      try {
        const result = await refreshStudentPrivateProfilesFromUpstream({
          studentIds,
          upstreamSessionToken: session.upstreamSessionToken,
        });

        persistSessionFromResult(session, result);
        applyBatchRefreshResult(result);
      } catch (error) {
        if (!isExpiredUpstreamSessionError(error)) {
          message.error(resolveUpstreamErrorMessage(error, '暂时无法批量刷新学生个人资料。'));
          return;
        }

        try {
          const refreshedSession = await refreshSession(session);
          const result = await refreshStudentPrivateProfilesFromUpstream({
            studentIds,
            upstreamSessionToken: refreshedSession.upstreamSessionToken,
          });

          persistSessionFromResult(refreshedSession, result);
          applyBatchRefreshResult(result);
        } catch (refreshError) {
          openLoginModalForExpiredSession({
            loginError: resolveUpstreamErrorMessage(
              refreshError,
              '学工系统会话已失效，请重新登录后继续批量刷新。',
            ),
            pendingAction: {
              studentIds,
              type: 'batch-refresh',
            },
            session,
          });
        }
      } finally {
        setIsBatchRefreshing(false);
      }
    },
    [
      applyBatchRefreshResult,
      message,
      openLoginModalForExpiredSession,
      persistSessionFromResult,
      refreshSession,
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
      setBatchSelectedStudentIds([]);
      setStudentOptionsError(null);

      if (!classId) {
        return;
      }

      void loadStudentsForClass(classId);
    },
    [loadStudentsForClass],
  );

  const handleStudentOptionChange = useCallback(
    (studentId: string | null) => {
      studentForm.setFieldValue('studentId', studentId ?? '');
    },
    [studentForm],
  );

  const handleBatchStudentSelectChange = useCallback((studentIds: string[]) => {
    setBatchSelectedStudentIds(studentIds);
  }, []);

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
    let studentIds: string[];

    try {
      studentIds = normalizeBatchRefreshStudentIds(batchStudentIdCandidates);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '批量刷新学生 ID 输入无效。');
      return;
    }

    if (!upstreamSession) {
      openLoginModal({
        pendingAction: {
          studentIds,
          type: 'batch-refresh',
        },
      });
      return;
    }

    await runBatchRefreshWithSession(upstreamSession, studentIds);
  }, [
    batchStudentIdCandidates,
    message,
    openLoginModal,
    runBatchRefreshWithSession,
    upstreamSession,
  ]);

  const handleReloadSummaryAfterBatch = useCallback(async () => {
    if (!summary) {
      return;
    }

    await loadSummary(summary.studentId);
  }, [loadSummary, summary]);

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

  const handleCompare = useCallback(
    async (values: CompareFormValues) => {
      const studentId = resolveSummaryActionStudentId();

      if (!studentId) {
        return;
      }

      setIsComparing(true);

      try {
        const result = await compareStudentPrivateProfileFields({
          fields: [
            {
              candidateValue: values.candidateValue,
              fieldKey: values.fieldKey as StudentPrivateProfileCompareField,
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
    [compareForm, message, resolveSummaryActionStudentId],
  );

  const handlePatch = useCallback(
    async (values: PatchFormValues) => {
      const studentId = resolveSummaryActionStudentId();

      if (!studentId) {
        return;
      }

      const fieldKey = values.fieldKey as StudentPrivateProfileManualPatchField;
      const action = values.action as StudentPrivateProfileManualPatchAction;
      const summaryField = summaryFieldByKey.get(normalizeStudentPrivateProfileFieldKey(fieldKey));

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
    [manualPatchAccess, message, patchForm, resolveSummaryActionStudentId, summaryFieldByKey],
  );

  const handleFamilyPatch = useCallback(
    async (values: FamilyPatchFormValues) => {
      const studentId = resolveSummaryActionStudentId();

      if (!studentId) {
        return;
      }

      const itemKey = values.itemKey ?? '';
      const fieldKey = values.fieldKey as StudentPrivateProfileFamilyMemberPatchField;
      const action = values.action as StudentPrivateProfileManualPatchAction;
      const familyMember = familyMemberByItemKey.get(itemKey);

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
      familyMemberByItemKey,
      familyPatchForm,
      manualPatchAccess,
      message,
      resolveSummaryActionStudentId,
    ],
  );

  const columns: ColumnsType<StudentPrivateProfileSummaryField> = [
    {
      dataIndex: 'fieldKey',
      key: 'fieldKey',
      title: '字段',
      render: (value: string) => resolveStudentPrivateProfileFieldLabel(value),
    },
    {
      dataIndex: 'section',
      key: 'section',
      title: '分区',
      render: (value: string) => resolveStudentPrivateProfileSectionLabel(value),
    },
    {
      dataIndex: 'maskedValue',
      key: 'maskedValue',
      title: '脱敏值',
      render: (value: string | null) => displayText(value),
    },
    {
      dataIndex: 'valueStatus',
      key: 'valueStatus',
      title: '状态',
      render: (value: string) => (
        <Tag color={resolveStudentPrivateProfileStatusColor(value)}>
          {resolveStudentPrivateProfileStatusLabel(value)}
        </Tag>
      ),
    },
    {
      dataIndex: 'source',
      key: 'source',
      title: '来源',
      render: (value: string) => (
        <Tag color={resolveStudentPrivateProfileSourceColor(value)}>
          {resolveStudentPrivateProfileSourceLabel(value)}
        </Tag>
      ),
    },
    {
      key: 'manual',
      title: '复核',
      render: (_, record) => (
        <Space size="small" wrap>
          {record.manualOverrideActive ? <Tag color="processing">人工修正</Tag> : null}
          {record.upstreamChangedSinceManualPatch ? <Tag color="warning">需复核</Tag> : null}
          {record.upstreamBaselineToken &&
          canPatchStudentPrivateProfileField(record.fieldKey, manualPatchAccess) ? (
            <Tag>可修正</Tag>
          ) : null}
        </Space>
      ),
    },
    {
      dataIndex: 'sourceObservedAt',
      key: 'sourceObservedAt',
      title: '观察时间',
      render: (value: string) => formatDateTime(value),
    },
  ];

  const familyColumns: ColumnsType<StudentPrivateProfileSummaryFamilyMember> = [
    {
      dataIndex: 'relationshipCode',
      key: 'relationshipCode',
      title: '关系',
      render: (value: string) => resolveStudentPrivateProfileFamilyRelationshipLabel(value),
    },
    {
      dataIndex: 'maskedName',
      key: 'maskedName',
      title: '姓名',
      render: (value: string | null) => displayText(value),
    },
    {
      dataIndex: 'maskedPhone',
      key: 'maskedPhone',
      title: '电话',
      render: (value: string | null) => displayText(value),
    },
    {
      dataIndex: 'maskedWorkplace',
      key: 'maskedWorkplace',
      title: '工作单位',
      render: (value: string | null) => displayText(value),
    },
    {
      key: 'manual',
      title: '复核',
      render: (_, record) => (
        <Space size="small" wrap>
          {record.manualOverrideActive ? <Tag color="processing">人工修正</Tag> : null}
          {record.upstreamChangedSinceManualPatch ? <Tag color="warning">需复核</Tag> : null}
          {record.manualPatchFieldKeys.map((fieldKey) => (
            <Tag key={fieldKey}>{resolveStudentPrivateProfileFamilyFieldLabel(fieldKey)}</Tag>
          ))}
        </Space>
      ),
    },
    {
      dataIndex: 'sourceObservedAt',
      key: 'sourceObservedAt',
      title: '观察时间',
      render: (value: string) => formatDateTime(value),
    },
  ];

  const educationColumns: ColumnsType<StudentPrivateProfileSummaryEducationResume> = [
    {
      key: 'period',
      title: '起止年月',
      render: (_, record) => `${displayText(record.startMonth)} - ${displayText(record.endMonth)}`,
    },
    {
      dataIndex: 'maskedReference',
      key: 'maskedReference',
      title: '经历',
      render: (value: string | null) => displayText(value),
    },
    {
      dataIndex: 'maskedOrganization',
      key: 'maskedOrganization',
      title: '组织',
      render: (value: string | null) => displayText(value),
    },
    {
      dataIndex: 'sourceUpdatedAt',
      key: 'sourceUpdatedAt',
      title: '上游更新',
      render: (value: string | null) => formatDateTime(value),
    },
    {
      dataIndex: 'sourceObservedAt',
      key: 'sourceObservedAt',
      title: '观察时间',
      render: (value: string) => formatDateTime(value),
    },
  ];

  const recordColumns: ColumnsType<StudentPrivateProfileSummaryRecordChange> = [
    {
      dataIndex: 'changeTime',
      key: 'changeTime',
      title: '变更时间',
      render: (value: string | null) => displayText(value),
    },
    {
      dataIndex: 'studentNoTypeCode',
      key: 'studentNoTypeCode',
      title: '异动类型',
      render: (value: string | null) =>
        value ? resolveStudentPrivateProfileRecordChangeTypeLabel(value) : displayText(value),
    },
    {
      dataIndex: 'maskedStudentNumber',
      key: 'maskedStudentNumber',
      title: '学号',
      render: (value: string | null) => displayText(value),
    },
    {
      dataIndex: 'grade',
      key: 'grade',
      title: '年级',
      render: (value: string | null) => displayText(value),
    },
    {
      key: 'majorClass',
      title: '专业/班级',
      render: (_, record) =>
        [record.maskedMajorName, record.maskedClassName].filter(Boolean).join(' / ') || '未记录',
    },
    {
      dataIndex: 'sourceObservedAt',
      key: 'sourceObservedAt',
      title: '观察时间',
      render: (value: string) => formatDateTime(value),
    },
  ];

  const batchRefreshColumns: ColumnsType<StudentPrivateProfileBatchRefreshItem> = [
    {
      dataIndex: 'studentId',
      key: 'studentId',
      title: '学生 ID',
    },
    {
      key: 'student',
      title: '本地学生',
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
      render: (value: StudentPrivateProfileBatchRefreshItem['status']) => (
        <Tag color={resolveStudentPrivateProfileBatchStatusColor(value)}>
          {resolveStudentPrivateProfileBatchStatusLabel(value)}
        </Tag>
      ),
    },
    {
      dataIndex: 'snapshotUpdated',
      key: 'snapshotUpdated',
      title: '本地快照更新',
      render: (value: boolean | null) => formatStudentPrivateProfileBoolean(value),
    },
    {
      dataIndex: 'changedSections',
      key: 'changedSections',
      title: '更新内容',
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
      title: '提醒码',
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
      key: 'errorCode',
      title: '失败码',
      render: (value: string | null) => displayText(value),
    },
    {
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      title: '失败原因',
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
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              学生资料复核
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              查看本地已同步的脱敏资料，按需从学工系统刷新，并处理需要人工复核的资料项。
            </Typography.Paragraph>
          </div>

          <Alert
            showIcon
            type="info"
            message="本页只展示本地脱敏资料；核验输入提交后会从表单清除，不在页面保留原文。"
          />

          <Form
            form={studentForm}
            initialValues={{ studentId: '' }}
            layout="inline"
            onFinish={handleLoadSummary}
          >
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
                placeholder="选择有 active 学生归属的班级"
                showSearch
                style={{ minWidth: 260 }}
                value={selectedClassId}
              />
            </Form.Item>
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
              rules={[{ required: true, message: '请输入本地学生 ID。', whitespace: true }]}
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
                <Button icon={<CloudSyncOutlined />} loading={isRefreshing} onClick={handleRefresh}>
                  从学工系统刷新
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
          {studentOptionsError ? (
            <Alert showIcon type="warning" message={studentOptionsError} />
          ) : null}

          <Descriptions bordered column={3} size="small">
            <Descriptions.Item label="当前账号">{currentAccount.displayName}</Descriptions.Item>
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
        items={[
          {
            children: (
              <div className="flex flex-col gap-6">
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

                <Card title="本地资料快照（脱敏）">
                  {summary ? (
                    <div className="flex flex-col gap-4">
                      <Descriptions bordered column={3} size="small">
                        <Descriptions.Item label="学生 ID">{summary.studentId}</Descriptions.Item>
                        <Descriptions.Item label="学工系统同步">
                          {formatDateTime(summary.sourceObservedAt)}
                        </Descriptions.Item>
                        <Descriptions.Item label="本地保存">
                          {formatDateTime(summary.lastSyncedAt)}
                        </Descriptions.Item>
                        <Descriptions.Item label="最近人工修正">
                          {formatDateTime(summary.lastManualUpdatedAt)}
                        </Descriptions.Item>
                        <Descriptions.Item label="照片同步">
                          {formatSnapshotPhotoStatus(summary.photo)}
                        </Descriptions.Item>
                        <Descriptions.Item label="资料分区">
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

                      <Table
                        columns={columns}
                        dataSource={summaryFields}
                        pagination={false}
                        rowKey="fieldKey"
                        size="small"
                      />

                      <Table
                        columns={familyColumns}
                        dataSource={summary.familyMembers}
                        locale={{ emptyText: '暂无家庭成员摘要' }}
                        pagination={false}
                        rowKey="itemKey"
                        size="small"
                        title={() => '家庭成员'}
                      />

                      <Table
                        columns={educationColumns}
                        dataSource={summary.educationResumes}
                        locale={{ emptyText: '暂无教育/简历经历摘要' }}
                        pagination={false}
                        rowKey="itemKey"
                        size="small"
                        title={() => '教育/简历经历'}
                      />

                      <Table
                        columns={recordColumns}
                        dataSource={summary.recordChanges}
                        locale={{ emptyText: '暂无学籍异动摘要' }}
                        pagination={false}
                        rowKey="itemKey"
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

                <ResponsiveGrid className="gap-6" columns={{ compact: 1, large: 2 }}>
                  <Card title="输入值核验">
                    <Form
                      form={compareForm}
                      initialValues={{ fieldKey: 'STUDENT_PHONE' }}
                      layout="vertical"
                      onFinish={handleCompare}
                    >
                      <Form.Item label="字段" name="fieldKey" rules={[{ required: true }]}>
                        <Select options={STUDENT_PRIVATE_PROFILE_COMPARE_FIELD_OPTIONS} />
                      </Form.Item>
                      <Form.Item
                        label="候选值"
                        name="candidateValue"
                        rules={[{ required: true, message: '请输入候选值。', whitespace: true }]}
                      >
                        <Input.Password autoComplete="off" placeholder="仅用于本次 compare" />
                      </Form.Item>
                      <Button
                        disabled={isSummaryStudentIdMismatched}
                        htmlType="submit"
                        icon={<CheckCircleOutlined />}
                        loading={isComparing}
                        type="primary"
                      >
                        核验
                      </Button>
                    </Form>

                    {compareResult ? (
                      <Descriptions bordered column={1} size="small" style={{ marginTop: 16 }}>
                        {compareResult.results.map((result) => (
                          <Descriptions.Item
                            key={result.fieldKey}
                            label={resolveStudentPrivateProfileFieldLabel(result.fieldKey)}
                          >
                            <Space size="small" wrap>
                              <Tag
                                color={resolveStudentPrivateProfileCompareResultColor(
                                  result.result,
                                )}
                              >
                                {resolveStudentPrivateProfileCompareResultLabel(result.result)}
                              </Tag>
                              <Tag>
                                {resolveStudentPrivateProfileStatusLabel(result.valueStatus)}
                              </Tag>
                            </Space>
                          </Descriptions.Item>
                        ))}
                      </Descriptions>
                    ) : null}
                  </Card>

                  <Card title="人工修正">
                    <Form
                      form={patchForm}
                      initialValues={{ action: 'SET', fieldKey: 'STUDENT_PHONE' }}
                      layout="vertical"
                      onFinish={handlePatch}
                    >
                      <Form.Item label="字段" name="fieldKey" rules={[{ required: true }]}>
                        <Select
                          disabled={isSummaryStudentIdMismatched || patchFieldOptions.length === 0}
                          options={patchFieldOptions}
                          placeholder="当前账号无可修正字段"
                        />
                      </Form.Item>
                      <Form.Item label="动作" name="action" rules={[{ required: true }]}>
                        <Radio.Group
                          options={[
                            { label: '写入修正', value: 'SET' },
                            { label: '清除修正', value: 'CLEAR' },
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
                      <Button
                        disabled={isSummaryStudentIdMismatched || patchFieldOptions.length === 0}
                        htmlType="submit"
                        icon={<EditOutlined />}
                        loading={isPatching}
                        type="primary"
                      >
                        保存修正
                      </Button>
                    </Form>
                  </Card>

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
                              {photoReadResult.source ? <Tag>{photoReadResult.source}</Tag> : null}
                            </Space>
                          </Descriptions.Item>
                          <Descriptions.Item label="尺寸">
                            {photoReadResult.width && photoReadResult.height
                              ? `${photoReadResult.width} x ${photoReadResult.height}`
                              : '未记录'}
                          </Descriptions.Item>
                          <Descriptions.Item label="大小">
                            {formatApproxByteSize(photoReadResult.byteSize)}
                          </Descriptions.Item>
                          <Descriptions.Item label="物化时间">
                            {formatDateTime(photoReadResult.materializedAt)}
                          </Descriptions.Item>
                          <Descriptions.Item label="追踪 ID">
                            {photoReadResult.traceId}
                          </Descriptions.Item>
                        </Descriptions>
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

                  <Card title="家庭成员修正">
                    <Form
                      form={familyPatchForm}
                      initialValues={{ action: 'SET', fieldKey: 'PHONE' }}
                      layout="vertical"
                      onFinish={handleFamilyPatch}
                    >
                      <Form.Item label="家庭成员" name="itemKey" rules={[{ required: true }]}>
                        <Select
                          disabled={
                            !canPatchStudentPrivateProfileFamily(manualPatchAccess) ||
                            isSummaryStudentIdMismatched ||
                            familyMemberOptions.length === 0
                          }
                          options={familyMemberOptions}
                          placeholder="当前无可修正家庭成员"
                        />
                      </Form.Item>
                      <Form.Item label="字段" name="fieldKey" rules={[{ required: true }]}>
                        <Select
                          disabled={
                            !canPatchStudentPrivateProfileFamily(manualPatchAccess) ||
                            isSummaryStudentIdMismatched
                          }
                          options={STUDENT_PRIVATE_PROFILE_FAMILY_PATCH_FIELD_OPTIONS}
                        />
                      </Form.Item>
                      <Form.Item label="动作" name="action" rules={[{ required: true }]}>
                        <Radio.Group
                          options={[
                            { label: '写入修正', value: 'SET' },
                            { label: '清除修正', value: 'CLEAR' },
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
                      <Button
                        disabled={
                          !canPatchStudentPrivateProfileFamily(manualPatchAccess) ||
                          isSummaryStudentIdMismatched ||
                          familyMemberOptions.length === 0
                        }
                        htmlType="submit"
                        icon={<EditOutlined />}
                        loading={isPatchingFamily}
                        type="primary"
                      >
                        保存家庭成员修正
                      </Button>
                    </Form>
                  </Card>
                </ResponsiveGrid>

                {refreshResult ? (
                  <Card title="最近一次学工系统刷新">
                    <Descriptions bordered column={3} size="small">
                      <Descriptions.Item label="结果">
                        <Tag color={refreshResult.success ? 'success' : 'error'}>
                          {refreshResult.success ? '成功' : '失败'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="本地快照更新">
                        {formatStudentPrivateProfileBoolean(refreshResult.snapshotUpdated)}
                      </Descriptions.Item>
                      <Descriptions.Item label="追踪 ID">{refreshResult.traceId}</Descriptions.Item>
                      <Descriptions.Item label="更新内容">
                        {refreshResult.changedSections.length > 0
                          ? refreshResult.changedSections
                              .map((section) => resolveStudentPrivateProfileSectionLabel(section))
                              .join(', ')
                          : '无'}
                      </Descriptions.Item>
                      <Descriptions.Item label="照片">
                        {refreshResult.photoPresent
                          ? `本次已同步，${formatApproxByteSize(refreshResult.photoByteSize)}`
                          : '本次未同步'}
                      </Descriptions.Item>
                      <Descriptions.Item label="学工系统会话">
                        {refreshResult.upstreamSessionToken ? '已更新' : '未变化'}
                      </Descriptions.Item>
                    </Descriptions>
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
            key: 'single',
            label: '单学生工作台',
          },
          {
            children: (
              <div className="flex flex-col gap-6">
                <Card title="小批量刷新资料">
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Alert
                      showIcon
                      type="info"
                      message="刷新完成后仅展示每名学生的处理结果；需要查看详情请回到单学生工作台重新读取。"
                    />

                    <Form layout="vertical">
                      <Form.Item label="从当前班级多选学生">
                        <Select
                          disabled={!selectedClassId}
                          filterOption={(input, option) =>
                            String(option?.label ?? '')
                              .toLowerCase()
                              .includes(input.toLowerCase())
                          }
                          loading={isLoadingStudents}
                          mode="multiple"
                          onChange={handleBatchStudentSelectChange}
                          options={studentSelectOptions}
                          placeholder={selectedClassId ? '选择 1-20 个学生' : '先选择班级'}
                          showSearch
                          value={batchSelectedStudentIds}
                        />
                      </Form.Item>

                      <Form.Item label="手动输入本地学生 ID">
                        <Input.TextArea
                          autoSize={{ minRows: 3, maxRows: 6 }}
                          onChange={(event) => setBatchManualStudentIds(event.target.value)}
                          placeholder="可粘贴本地学生 ID，支持换行、逗号、空格分隔"
                          value={batchManualStudentIds}
                        />
                      </Form.Item>
                    </Form>

                    {batchStudentIdsPreview.error ? (
                      <Alert showIcon type="warning" message={batchStudentIdsPreview.error} />
                    ) : (
                      <Descriptions bordered column={3} size="small">
                        <Descriptions.Item label="将提交学生数">
                          {batchStudentIdsPreview.studentIds.length}
                        </Descriptions.Item>
                        <Descriptions.Item label="选择来源">
                          {batchSelectedStudentIds.length}
                        </Descriptions.Item>
                        <Descriptions.Item label="粘贴来源">
                          {batchManualStudentIdCandidates.length}
                        </Descriptions.Item>
                        <Descriptions.Item label="本次提交学生" span={3}>
                          <Space size="small" wrap>
                            {batchStudentIdsPreview.studentIds.map((studentId) => (
                              <Tag key={studentId}>{studentId}</Tag>
                            ))}
                          </Space>
                        </Descriptions.Item>
                      </Descriptions>
                    )}

                    <Space wrap>
                      <Button
                        disabled={Boolean(batchStudentIdsPreview.error)}
                        icon={<CloudSyncOutlined />}
                        loading={isBatchRefreshing}
                        onClick={() => void handleBatchRefresh()}
                        type="primary"
                      >
                        执行小批量刷新
                      </Button>
                      <Button icon={<LoginOutlined />} onClick={() => openLoginModal()}>
                        登录学工系统
                      </Button>
                    </Space>
                  </Space>
                </Card>

                {batchRefreshResult ? (
                  <Card title="小批量刷新结果">
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
                        <Descriptions.Item label="追踪 ID" span={2}>
                          {batchRefreshResult.traceId}
                        </Descriptions.Item>
                        <Descriptions.Item label="学工系统会话" span={2}>
                          {batchRefreshResult.upstreamSessionToken ? '已更新' : '未返回'}
                        </Descriptions.Item>
                        <Descriptions.Item label="会话有效期" span={4}>
                          {batchRefreshResult.expiresAt
                            ? formatDateTime(batchRefreshResult.expiresAt)
                            : '本次未变化'}
                        </Descriptions.Item>
                      </Descriptions>

                      <Table
                        columns={batchRefreshColumns}
                        dataSource={batchRefreshResult.results}
                        pagination={false}
                        rowKey="studentId"
                        size="small"
                      />
                    </Space>
                  </Card>
                ) : null}
              </div>
            ),
            key: 'batch',
            label: '小批量刷新资料',
          },
        ]}
      />

      <UpstreamLoginModal {...upstreamLoginModalProps} />
    </div>
  );
}
