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
  compareStudentPrivateProfileFields,
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
  resolveUpstreamErrorMessage,
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
import { studentPrivateProfileLabMeta } from './meta';

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

const COMPARE_FIELD_OPTIONS: {
  label: string;
  value: StudentPrivateProfileCompareField;
}[] = [
  { label: '身份证号', value: 'ID_CARD' },
  { label: '银行卡号', value: 'BANK_CARD_NUMBER' },
  { label: '校园卡号', value: 'CARD_NUMBER' },
  { label: '学生手机号', value: 'STUDENT_PHONE' },
  { label: '联系人手机号', value: 'CONTACT_PERSON_PHONE' },
];

const PATCH_FIELD_OPTIONS: {
  label: string;
  value: StudentPrivateProfileManualPatchField;
}[] = [
  ...COMPARE_FIELD_OPTIONS,
  { label: '家庭地址', value: 'HOME_ADDRESS' },
  { label: '通讯地址', value: 'MAILING_ADDRESS' },
];

const FAMILY_PATCH_FIELD_OPTIONS: {
  label: string;
  value: StudentPrivateProfileFamilyMemberPatchField;
}[] = [
  { label: '关系 code', value: 'RELATIONSHIP_CODE' },
  { label: '姓名', value: 'NAME' },
  { label: '电话', value: 'PHONE' },
  { label: '工作单位', value: 'WORKPLACE' },
];

const SENSITIVE_IDENTIFIER_PATCH_FIELDS = new Set<StudentPrivateProfileManualPatchField>([
  'ID_CARD',
  'BANK_CARD_NUMBER',
  'CARD_NUMBER',
]);

const CONTACT_AND_ADDRESS_PATCH_FIELDS = new Set<StudentPrivateProfileManualPatchField>([
  'STUDENT_PHONE',
  'CONTACT_PERSON_PHONE',
  'HOME_ADDRESS',
  'MAILING_ADDRESS',
]);

const PROFILE_COMPLETENESS_ITEMS: {
  key: keyof StudentPrivateProfileSummary['profileCompletenessFlags'];
  label: string;
}[] = [
  { key: 'personalObserved', label: '个人信息' },
  { key: 'sensitiveIdentifiersObserved', label: '敏感证件' },
  { key: 'photoObserved', label: '照片' },
  { key: 'familyObserved', label: '家庭情况' },
  { key: 'educationObserved', label: '学籍/教育' },
  { key: 'recordObserved', label: '记录/毕业/获奖' },
];

const FIELD_LABELS = new Map<string, string>(
  PATCH_FIELD_OPTIONS.map((item) => [item.value, item.label]),
);

const FAMILY_FIELD_LABELS = new Map<string, string>(
  FAMILY_PATCH_FIELD_OPTIONS.map((item) => [item.value, item.label]),
);

const FIELD_ORDER = new Map(PATCH_FIELD_OPTIONS.map((item, index) => [item.value, index]));

function formatClassOption(option: StudentPrivateProfileClassOption) {
  return `${option.className} · ${option.studentCount}人`;
}

function formatStudentOption(option: StudentPrivateProfileStudentOption) {
  const studentLabel = option.studentName
    ? `${option.studentName} (${option.studentId})`
    : option.studentId;
  const upstreamStatus = option.upstreamIdPresent ? null : '缺 upstream ID';

  return [studentLabel, option.studentStatus, upstreamStatus].filter(Boolean).join(' · ');
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

function formatObservedStatus(value: boolean) {
  return value ? '已观察' : '未观察';
}

function formatUpstreamPhotoStatus(photo: StudentPrivateProfileSummary['photo']) {
  if (!photo.present) {
    return '上游照片：未观察';
  }

  return `上游照片：已观察，${formatApproxByteSize(photo.byteSize)}`;
}

function resolveFieldLabel(fieldKey: string) {
  return FIELD_LABELS.get(fieldKey) ?? fieldKey;
}

function resolveFamilyFieldLabel(fieldKey: string) {
  return FAMILY_FIELD_LABELS.get(fieldKey) ?? fieldKey;
}

function formatFamilyMemberOption(member: StudentPrivateProfileSummaryFamilyMember) {
  return [
    member.relationshipCode,
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

function resolveCompareResultColor(
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

function resolveSourceColor(source: string) {
  if (source === 'MANUAL') {
    return 'processing';
  }

  if (source === 'UPSTREAM') {
    return 'success';
  }

  return 'default';
}

function resolveStatusColor(status: string) {
  if (status === 'PRESENT' || status === 'OBSERVED') {
    return 'success';
  }

  if (status === 'MISSING') {
    return 'warning';
  }

  return 'default';
}

function resolvePhotoStatusColor(status: StudentPrivateProfilePhotoReadResult['photoStatus']) {
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

function resolveStudentPrivateProfileActionError(error: unknown, fallback: string) {
  const detail = readUpstreamGraphQLErrorDetail(error);

  if (
    detail?.code === 'CONFLICT' ||
    detail?.errorCode === 'STUDENT_PRIVATE_PROFILE_MANUAL_PATCH_BASELINE_CONFLICT'
  ) {
    return '资料基线已变化，请重新读取 summary 后再提交。';
  }

  if (detail?.code === 'INTERNAL_SERVER_ERROR') {
    return '服务端暂时无法处理该资料，请保留 trace 信息并联系排查。';
  }

  return resolveUpstreamErrorMessage(error, fallback);
}

function sortSummaryFields(fields: StudentPrivateProfileSummaryField[]) {
  return [...fields].sort((left, right) => {
    const leftOrder =
      FIELD_ORDER.get(left.fieldKey as StudentPrivateProfileManualPatchField) ?? 999;
    const rightOrder =
      FIELD_ORDER.get(right.fieldKey as StudentPrivateProfileManualPatchField) ?? 999;

    return leftOrder - rightOrder || left.fieldKey.localeCompare(right.fieldKey);
  });
}

function canPatchStudentPrivateProfileField(
  fieldKey: string,
  access: StudentPrivateProfileManualPatchAccess,
) {
  const patchFieldKey = fieldKey as StudentPrivateProfileManualPatchField;

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
  const [photoReadResult, setPhotoReadResult] =
    useState<StudentPrivateProfilePhotoReadResult | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReadingPhoto, setIsReadingPhoto] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isPatching, setIsPatching] = useState(false);
  const [isPatchingFamily, setIsPatchingFamily] = useState(false);
  const [classes, setClasses] = useState<StudentPrivateProfileClassOption[]>([]);
  const [students, setStudents] = useState<StudentPrivateProfileStudentOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
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
    ? '请先读取 summary。'
    : isSummaryStudentIdMismatched
      ? '当前输入学生 ID 已变化，请重新读取 summary。'
      : null;
  const photoDataUrl = useMemo(() => buildPhotoDataUrl(photoReadResult), [photoReadResult]);

  const summaryFields = useMemo(() => sortSummaryFields(summary?.fields ?? []), [summary]);
  const summaryFieldByKey = useMemo(
    () => new Map(summaryFields.map((field) => [field.fieldKey, field])),
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
      PATCH_FIELD_OPTIONS.filter((option) =>
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
      message.error('请先读取 summary。');
      return null;
    }

    if (currentStudentIdText !== summary.studentId) {
      message.error('当前输入学生 ID 已变化，请重新读取 summary。');
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
        studentForm.setFieldValue('studentId', nextSummary.studentId);
      } catch (error) {
        message.error(resolveUpstreamErrorMessage(error, '暂时无法读取学生个人资料摘要。'));
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
      resolveUpstreamErrorMessage(error, 'upstream 登录失败，请检查账号或密码。'),
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
        message.success('已刷新 upstream 并重新读取本地摘要。');
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
          message.success('upstream 会话已续期，资料刷新完成。');
        } catch (refreshError) {
          openLoginModalForExpiredSession({
            loginError: resolveUpstreamErrorMessage(
              refreshError,
              'upstream 会话已失效，请重新登录后继续刷新。',
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
        message.success(
          result.photoStatus === 'PRESENT' ? '照片读取完成。' : '照片读取已返回状态。',
        );
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
          message.success('upstream 会话已续期，照片读取完成。');
        } catch (refreshError) {
          openLoginModalForExpiredSession({
            loginError: resolveUpstreamErrorMessage(
              refreshError,
              'upstream 会话已失效，请重新登录后继续读取照片。',
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
        message.success(
          result.photoStatus === 'PRESENT' ? '照片读取完成。' : '照片读取已返回状态。',
        );
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

    void runPhotoReadWithSession(
      upstreamActionRequest.session,
      upstreamActionRequest.action.studentId,
      upstreamActionRequest.action.forceRefresh,
    );
  }, [runPhotoReadWithSession, runRefreshWithSession, upstreamActionRequest]);

  const handleLoadSummary = useCallback(async () => {
    await loadSummary(currentStudentId);
  }, [currentStudentId, loadSummary]);

  const handleClassChange = useCallback(
    (classId: string | null) => {
      setSelectedClassId(classId);
      setStudents([]);
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
      const summaryField = summaryFieldByKey.get(fieldKey);

      if (!canPatchStudentPrivateProfileField(fieldKey, manualPatchAccess)) {
        message.error('当前账号没有该字段的人工修正入口。');
        return;
      }

      if (action === 'SET' && !summaryField?.upstreamBaselineToken) {
        message.error('当前摘要没有可用于 SET 的 baseline token，请先重新读取 summary。');
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
            '暂时无法保存人工修正，请重新读取 summary 后再试。',
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
        message.error('当前摘要没有该家庭成员行，请重新读取 summary。');
        return;
      }

      if (action === 'SET' && !familyMember.upstreamBaselineToken) {
        message.error('当前家庭成员行没有可用于 SET 的 baseline token，请重新读取 summary。');
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
            '暂时无法保存家庭成员人工修正，请重新读取 summary 后再试。',
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
      render: (value: string) => resolveFieldLabel(value),
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
      render: (value: string) => <Tag color={resolveStatusColor(value)}>{value}</Tag>,
    },
    {
      dataIndex: 'source',
      key: 'source',
      title: '来源',
      render: (value: string) => <Tag color={resolveSourceColor(value)}>{value}</Tag>,
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
            <Tag>可 SET</Tag>
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
      render: (value: string) => displayText(value),
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
            <Tag key={fieldKey}>{resolveFamilyFieldLabel(fieldKey)}</Tag>
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
      render: (value: string | null) => displayText(value),
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
              学生敏感资料 Lab
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {studentPrivateProfileLabMeta.purpose}
            </Typography.Paragraph>
          </div>

          <Alert
            showIcon
            type="info"
            message="本页面只读取脱敏 summary；compare 候选值提交后会从表单清除，不写入页面结果。"
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
              <Input allowClear placeholder="member_student.id" />
            </Form.Item>
            <Form.Item>
              <Space wrap>
                <Button
                  htmlType="submit"
                  icon={<FileSearchOutlined />}
                  loading={isLoadingSummary}
                  type="primary"
                >
                  读取摘要
                </Button>
                <Button icon={<CloudSyncOutlined />} loading={isRefreshing} onClick={handleRefresh}>
                  显式刷新
                </Button>
                <Button icon={<LoginOutlined />} onClick={() => openLoginModal()}>
                  Upstream 登录
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
            <Descriptions.Item label="Upstream 账号锁定">
              {lockedUpstreamLoginUserId ?? '不锁定'}
            </Descriptions.Item>
            <Descriptions.Item label="Upstream session">
              {upstreamSession ? `有效至 ${formatDateTime(upstreamSession.expiresAt)}` : '未建立'}
            </Descriptions.Item>
          </Descriptions>
        </div>
      </Card>

      <Card title="脱敏摘要">
        {summary ? (
          <div className="flex flex-col gap-4">
            <Descriptions bordered column={3} size="small">
              <Descriptions.Item label="学生 ID">{summary.studentId}</Descriptions.Item>
              <Descriptions.Item label="来源观察">
                {formatDateTime(summary.sourceObservedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="本地写入">
                {formatDateTime(summary.lastSyncedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="人工修正">
                {formatDateTime(summary.lastManualUpdatedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="照片状态">
                {formatUpstreamPhotoStatus(summary.photo)}
              </Descriptions.Item>
              <Descriptions.Item label="完整度">
                <Space size="small" wrap>
                  {PROFILE_COMPLETENESS_ITEMS.map((item) => {
                    const isObserved = summary.profileCompletenessFlags[item.key];

                    return (
                      <Tag color={isObserved ? 'success' : 'default'} key={item.key}>
                        {item.label}：{formatObservedStatus(isObserved)}
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
              <Descriptions bordered column={2} size="small" title="Section 状态">
                {summary.sectionStatuses.map((section) => (
                  <Descriptions.Item key={section.section} label={section.section}>
                    <Space direction="vertical" size="small">
                      <Space size="small" wrap>
                        <Tag color={resolveStatusColor(section.sourceStatus)}>
                          {section.sourceStatus}
                        </Tag>
                        <span>{formatDateTime(section.observedAt)}</span>
                      </Space>
                      {section.warningCodes.length > 0 ? (
                        <Space size="small" wrap>
                          {section.warningCodes.map((code) => (
                            <Tag color="warning" key={code}>
                              {code}
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
          <Empty description="先输入本地学生 ID 并读取 summary" />
        )}
      </Card>

      {isSummaryStudentIdMismatched && summaryActionDisabledReason ? (
        <Alert showIcon type="warning" message={summaryActionDisabledReason} />
      ) : null}

      <ResponsiveGrid className="gap-6" columns={{ compact: 1, large: 2 }}>
        <Card title="候选值核验">
          <Form
            form={compareForm}
            initialValues={{ fieldKey: 'STUDENT_PHONE' }}
            layout="vertical"
            onFinish={handleCompare}
          >
            <Form.Item label="字段" name="fieldKey" rules={[{ required: true }]}>
              <Select options={COMPARE_FIELD_OPTIONS} />
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
                <Descriptions.Item key={result.fieldKey} label={resolveFieldLabel(result.fieldKey)}>
                  <Space size="small" wrap>
                    <Tag color={resolveCompareResultColor(result.result)}>{result.result}</Tag>
                    <Tag>{result.valueStatus}</Tag>
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
                  { label: 'SET', value: 'SET' },
                  { label: 'CLEAR', value: 'CLEAR' },
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

        <Card title="照片读取">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space wrap>
              <Button
                disabled={isSummaryStudentIdMismatched}
                icon={<PictureOutlined />}
                loading={isReadingPhoto}
                onClick={() => void handleReadPhoto(false)}
                type="primary"
              >
                读取照片
              </Button>
              <Button
                disabled={isSummaryStudentIdMismatched}
                icon={<ReloadOutlined />}
                loading={isReadingPhoto}
                onClick={() => void handleReadPhoto(true)}
              >
                强制刷新照片
              </Button>
            </Space>

            {photoReadResult ? (
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="状态">
                  <Space size="small" wrap>
                    <Tag color={resolvePhotoStatusColor(photoReadResult.photoStatus)}>
                      {photoReadResult.photoStatus}
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
                <Descriptions.Item label="traceId">{photoReadResult.traceId}</Descriptions.Item>
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
                message="照片读取 warnings"
                description={photoReadResult.warnings
                  .map((warning) => `${warning.code}: ${warning.message}`)
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
                options={FAMILY_PATCH_FIELD_OPTIONS}
              />
            </Form.Item>
            <Form.Item label="动作" name="action" rules={[{ required: true }]}>
              <Radio.Group
                options={[
                  { label: 'SET', value: 'SET' },
                  { label: 'CLEAR', value: 'CLEAR' },
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
        <Card title="最近一次刷新">
          <Descriptions bordered column={3} size="small">
            <Descriptions.Item label="成功">
              <Tag color={refreshResult.success ? 'success' : 'error'}>
                {refreshResult.success ? 'true' : 'false'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="snapshotUpdated">
              {refreshResult.snapshotUpdated ? 'true' : 'false'}
            </Descriptions.Item>
            <Descriptions.Item label="traceId">{refreshResult.traceId}</Descriptions.Item>
            <Descriptions.Item label="变化 section">
              {refreshResult.changedSections.length > 0
                ? refreshResult.changedSections.join(', ')
                : '无'}
            </Descriptions.Item>
            <Descriptions.Item label="照片">
              {refreshResult.photoPresent
                ? `上游照片：本次已返回，${formatApproxByteSize(refreshResult.photoByteSize)}`
                : '上游照片：本次未返回'}
            </Descriptions.Item>
            <Descriptions.Item label="被动 rolling">
              {refreshResult.upstreamSessionToken ? '已返回新 token' : '无'}
            </Descriptions.Item>
          </Descriptions>
          {refreshResult.warnings.length > 0 ? (
            <Alert
              showIcon
              type="warning"
              message="刷新返回 warnings"
              description={refreshResult.warnings
                .map((warning) => `${warning.code}: ${warning.message}`)
                .join('\n')}
              style={{ marginTop: 16, whiteSpace: 'pre-line' }}
            />
          ) : null}
        </Card>
      ) : null}

      <UpstreamLoginModal {...upstreamLoginModalProps} />
    </div>
  );
}
