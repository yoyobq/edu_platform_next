import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';

import { upstreamSessionDemoLabAccess } from './access';
import {
  type CurrentUpstreamDemoAccount,
  type CurriculumPlanListResult,
  type DepartmentCurriculumPlanReviewStatus,
  fetchCurrentUpstreamDemoAccount,
  fetchCurriculumPlanList,
  fetchDepartmentCurriculumPlanList,
  fetchTeacherDirectory,
  fetchVerifiedStaffIdentity,
  isExpiredUpstreamSessionError,
  loginUpstreamSession,
  resolveUpstreamErrorMessage,
  type TeacherDirectoryResult,
  type VerifiedStaffIdentityResult,
} from './api';
import { upstreamSessionDemoLabMeta } from './meta';
import {
  clearStoredUpstreamSession,
  readStoredUpstreamSession,
  type StoredUpstreamSession,
  writeStoredUpstreamSession,
} from './storage';

type UpstreamLoginFormValues = {
  password: string;
  userId: string;
};

type PersonalCurriculumPlanFormValues = {
  className?: string;
  departmentId: string;
  courseName?: string;
  schoolYear: string;
  semester: string;
};

type DepartmentCurriculumPlanFormValues = {
  className?: string;
  courseName?: string;
  departmentId: string;
  reviewStatus?: DepartmentCurriculumPlanReviewStatus;
  schoolYear: string;
  semester: string;
  teacherId?: string;
};

type CurriculumPlanScope = 'personal' | 'department';
type CurriculumPlanPanelKey = 'personal-curriculum-plan' | 'department-curriculum-plan';

type PendingUpstreamAction =
  | { type: 'teacher-directory' }
  | { type: 'verified-staff-identity' }
  | {
      scope: CurriculumPlanScope;
      type: 'curriculum-plan';
      values: PersonalCurriculumPlanFormValues | DepartmentCurriculumPlanFormValues;
    };

type UpstreamPanelKey = PendingUpstreamAction['type'] | CurriculumPlanPanelKey | 'introduction';

type UpstreamActionError = {
  message: string;
  panel: UpstreamPanelKey;
};

const TEACHER_PREVIEW_LIMIT = 5;
const CURRICULUM_PLAN_PREVIEW_LIMIT = 3;
const CURRICULUM_PLAN_PANEL_BY_SCOPE: Record<CurriculumPlanScope, CurriculumPlanPanelKey> = {
  personal: 'personal-curriculum-plan',
  department: 'department-curriculum-plan',
};
const CURRICULUM_PLAN_SCOPE_LABEL: Record<CurriculumPlanScope, string> = {
  personal: '个人教学计划',
  department: '系部教学计划',
};
const DEPARTMENT_CURRICULUM_PLAN_REVIEW_STATUS_OPTIONS: Array<{
  label: string;
  value: DepartmentCurriculumPlanReviewStatus;
}> = [
  {
    label: '未录入',
    value: 'UNRECORDED',
  },
  {
    label: '待提交',
    value: 'PENDING_SUBMIT',
  },
  {
    label: '审核中',
    value: 'UNDER_REVIEW',
  },
  {
    label: '审核通过',
    value: 'APPROVED',
  },
  {
    label: '审核不通过',
    value: 'REJECTED',
  },
];

type CurriculumPlanRecord = {
  className: string;
  courseName: string;
  planId: string;
  raw: Record<string, unknown>;
  teacherName: string | null;
  weeklyHours: string | null;
};

const UPSTREAM_PANELS: Array<{
  key: UpstreamPanelKey;
  label: string;
}> = [
  {
    key: 'introduction',
    label: '使用说明',
  },
  {
    key: 'teacher-directory',
    label: '教师字典',
  },
  {
    key: 'verified-staff-identity',
    label: '教职工身份',
  },
  {
    key: 'personal-curriculum-plan',
    label: '个人教学计划',
  },
  {
    key: 'department-curriculum-plan',
    label: '系部教学计划',
  },
];

function getDefaultPersonalCurriculumPlanValues(): PersonalCurriculumPlanFormValues {
  return {
    className: undefined,
    departmentId: 'ORG0302',
    courseName: undefined,
    schoolYear: '2025',
    semester: '2',
  };
}

function getDefaultDepartmentCurriculumPlanValues(): DepartmentCurriculumPlanFormValues {
  return {
    className: undefined,
    courseName: undefined,
    departmentId: 'ORG0302',
    reviewStatus: undefined,
    schoolYear: '2025',
    semester: '2',
    teacherId: undefined,
  };
}

function renderUpstreamInterfaceTag(name: string) {
  return (
    <div className="flex flex-wrap gap-2">
      <Tag variant="filled" color="geekblue">
        接口：{name}
      </Tag>
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '未返回';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function buildTeacherDirectoryPreview(result: TeacherDirectoryResult) {
  return {
    expiresAt: result.expiresAt,
    teacherCount: result.teachers.length,
    teachers: result.teachers.slice(0, TEACHER_PREVIEW_LIMIT),
    upstreamSessionToken: result.upstreamSessionToken,
  };
}

function readCurriculumPlanString(
  record: Record<string, unknown>,
  candidates: string[],
): string | null {
  for (const candidate of candidates) {
    const value = record[candidate];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function normalizeCurriculumPlanRecord(entry: unknown): CurriculumPlanRecord | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const planId = readCurriculumPlanString(record, [
    'LECTURE_PLAN_ID',
    'lecturePlanId',
    'PLAN_ID',
    'planId',
    'SELECTEDKEY',
  ]);
  const className = readCurriculumPlanString(record, ['CLASS_NAME', 'className', 'classname']);
  const courseName = readCurriculumPlanString(record, ['COURSE_NAME', 'courseName', 'coursename']);

  if (!planId || !className || !courseName) {
    return null;
  }

  return {
    className,
    courseName,
    planId,
    raw: record,
    teacherName: readCurriculumPlanString(record, ['TEACHER_NAME', 'teacherName']),
    weeklyHours: readCurriculumPlanString(record, ['WEEKLY_HOURS', 'weeklyHours']),
  };
}

function getCurriculumPlanRecords(result: CurriculumPlanListResult | null): CurriculumPlanRecord[] {
  if (!result || !Array.isArray(result.plans)) {
    return [];
  }

  return result.plans.reduce<CurriculumPlanRecord[]>((records, entry) => {
    const normalized = normalizeCurriculumPlanRecord(entry);

    if (normalized) {
      records.push(normalized);
    }

    return records;
  }, []);
}

function getUniqueValues(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function findMatchingCurriculumPlans(
  records: CurriculumPlanRecord[],
  input: {
    className?: string;
    courseName?: string;
  },
) {
  return records.filter(
    (record) => record.className === input.className && record.courseName === input.courseName,
  );
}

export function UpstreamSessionDemoLabPage() {
  const [form] = Form.useForm<UpstreamLoginFormValues>();
  const [personalCurriculumPlanForm] = Form.useForm<PersonalCurriculumPlanFormValues>();
  const [departmentCurriculumPlanForm] = Form.useForm<DepartmentCurriculumPlanFormValues>();
  const selectedPersonalClassName = Form.useWatch('className', personalCurriculumPlanForm);
  const selectedPersonalCourseName = Form.useWatch('courseName', personalCurriculumPlanForm);
  const selectedDepartmentClassName = Form.useWatch('className', departmentCurriculumPlanForm);
  const selectedDepartmentCourseName = Form.useWatch('courseName', departmentCurriculumPlanForm);
  const [activePanelKey, setActivePanelKey] = useState<UpstreamPanelKey>('introduction');
  const [currentAccount, setCurrentAccount] = useState<CurrentUpstreamDemoAccount | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLoadingCurrentAccount, setIsLoadingCurrentAccount] = useState(true);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [isLoadingCurriculumPlans, setIsLoadingCurriculumPlans] = useState<
    Record<CurriculumPlanScope, boolean>
  >({
    personal: false,
    department: false,
  });
  const [isLoadingIdentity, setIsLoadingIdentity] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<UpstreamActionError | null>(null);
  const [curriculumPlanResult, setCurriculumPlanResult] = useState<
    Record<CurriculumPlanScope, CurriculumPlanListResult | null>
  >({
    personal: null,
    department: null,
  });
  const [directoryResult, setDirectoryResult] = useState<TeacherDirectoryResult | null>(null);
  const [verifiedIdentityResult, setVerifiedIdentityResult] =
    useState<VerifiedStaffIdentityResult | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingUpstreamAction | null>(null);
  const [storedSession, setStoredSession] = useState<StoredUpstreamSession | null>(null);
  const personalCurriculumPlanRecords = getCurriculumPlanRecords(curriculumPlanResult.personal);
  const personalClassNameOptions = getUniqueValues(
    personalCurriculumPlanRecords.map((record) => record.className),
  );
  const personalCourseNameOptions = getUniqueValues(
    personalCurriculumPlanRecords
      .filter(
        (record) => !selectedPersonalClassName || record.className === selectedPersonalClassName,
      )
      .map((record) => record.courseName),
  );
  const personalMatchingCurriculumPlans = findMatchingCurriculumPlans(
    personalCurriculumPlanRecords,
    {
      className: selectedPersonalClassName,
      courseName: selectedPersonalCourseName,
    },
  );
  const departmentCurriculumPlanRecords = getCurriculumPlanRecords(curriculumPlanResult.department);
  const departmentClassNameOptions = getUniqueValues(
    departmentCurriculumPlanRecords.map((record) => record.className),
  );
  const departmentCourseNameOptions = getUniqueValues(
    departmentCurriculumPlanRecords
      .filter(
        (record) =>
          !selectedDepartmentClassName || record.className === selectedDepartmentClassName,
      )
      .map((record) => record.courseName),
  );
  const departmentMatchingCurriculumPlans = findMatchingCurriculumPlans(
    departmentCurriculumPlanRecords,
    {
      className: selectedDepartmentClassName,
      courseName: selectedDepartmentCourseName,
    },
  );

  const persistStoredSession = useCallback(
    (
      session: StoredUpstreamSession,
      input: {
        expiresAt?: string | null;
        upstreamLoginId?: string | null;
        upstreamSessionToken: string;
      },
    ) => {
      writeStoredUpstreamSession({
        accountId: session.accountId,
        expiresAt: input.expiresAt ?? session.expiresAt,
        upstreamLoginId: input.upstreamLoginId ?? session.upstreamLoginId,
        upstreamSessionToken: input.upstreamSessionToken,
      });

      setStoredSession(
        readStoredUpstreamSession(session.accountId) ?? {
          ...session,
          expiresAt: input.expiresAt ?? session.expiresAt,
          upstreamLoginId: input.upstreamLoginId ?? session.upstreamLoginId,
          upstreamSessionToken: input.upstreamSessionToken,
        },
      );
    },
    [],
  );

  const clearCurrentSession = useCallback((error?: UpstreamActionError) => {
    clearStoredUpstreamSession();
    setStoredSession(null);
    setCurriculumPlanResult({
      personal: null,
      department: null,
    });
    setDirectoryResult(null);
    setVerifiedIdentityResult(null);
    setActionError(error ?? null);
  }, []);

  const performAction = useCallback(
    async (session: StoredUpstreamSession, action: PendingUpstreamAction) => {
      try {
        switch (action.type) {
          case 'teacher-directory': {
            setIsLoadingDirectory(true);
            const result = await fetchTeacherDirectory({
              sessionToken: session.upstreamSessionToken,
            });

            persistStoredSession(session, {
              expiresAt: result.expiresAt,
              upstreamSessionToken: result.upstreamSessionToken,
            });
            setDirectoryResult(result);
            return;
          }
          case 'verified-staff-identity': {
            setIsLoadingIdentity(true);
            const result = await fetchVerifiedStaffIdentity({
              sessionToken: session.upstreamSessionToken,
            });

            persistStoredSession(session, {
              expiresAt: result.expiresAt,
              upstreamLoginId: result.upstreamLoginId,
              upstreamSessionToken: result.upstreamSessionToken,
            });
            setVerifiedIdentityResult(result);
            return;
          }
          case 'curriculum-plan': {
            setIsLoadingCurriculumPlans((current) => ({
              ...current,
              [action.scope]: true,
            }));
            const result =
              action.scope === 'personal'
                ? await fetchCurriculumPlanList({
                    ...(action.values as PersonalCurriculumPlanFormValues),
                    sessionToken: session.upstreamSessionToken,
                  })
                : await fetchDepartmentCurriculumPlanList({
                    ...(action.values as DepartmentCurriculumPlanFormValues),
                    sessionToken: session.upstreamSessionToken,
                  });

            persistStoredSession(session, {
              expiresAt: result.expiresAt,
              upstreamSessionToken: result.upstreamSessionToken,
            });
            setCurriculumPlanResult((current) => ({
              ...current,
              [action.scope]: result,
            }));
            return;
          }
        }
      } catch (error) {
        if (isExpiredUpstreamSessionError(error)) {
          clearCurrentSession();
          setPendingAction(action);
          setLoginError('upstream 会话已失效，请重新登录后继续。');
          setIsLoginModalOpen(true);
          form.setFieldsValue({
            password: '',
            userId: storedSession?.upstreamLoginId ?? '',
          });
          return;
        }

        switch (action.type) {
          case 'teacher-directory':
            setDirectoryResult(null);
            setActionError({
              panel: 'teacher-directory',
              message: resolveUpstreamErrorMessage(error, '暂时无法读取教师字典。'),
            });
            return;
          case 'verified-staff-identity':
            setVerifiedIdentityResult(null);
            setActionError({
              panel: 'verified-staff-identity',
              message: resolveUpstreamErrorMessage(error, '暂时无法读取教职工身份。'),
            });
            return;
          case 'curriculum-plan':
            setCurriculumPlanResult((current) => ({
              ...current,
              [action.scope]: null,
            }));
            setActionError({
              panel: CURRICULUM_PLAN_PANEL_BY_SCOPE[action.scope],
              message: resolveUpstreamErrorMessage(
                error,
                `暂时无法读取${CURRICULUM_PLAN_SCOPE_LABEL[action.scope]}列表。`,
              ),
            });
            return;
        }
      } finally {
        if (action.type === 'curriculum-plan') {
          setIsLoadingCurriculumPlans((current) => ({
            ...current,
            [action.scope]: false,
          }));
        }

        setIsLoadingDirectory(false);
        setIsLoadingIdentity(false);
      }
    },
    [persistStoredSession, clearCurrentSession, form, storedSession?.upstreamLoginId],
  );

  const ensureSessionAndRun = useCallback(
    async (action: PendingUpstreamAction) => {
      setActionError(null);
      setLoginError(null);

      if (!storedSession) {
        setPendingAction(action);
        setIsLoginModalOpen(true);
        form.setFieldsValue({
          password: '',
          userId: '',
        });
        return;
      }

      await performAction(storedSession, action);
    },
    [storedSession, performAction, form],
  );

  useEffect(() => {
    let isCancelled = false;

    async function bootstrapPage() {
      setIsLoadingCurrentAccount(true);
      setPageError(null);
      setLoginError(null);
      setActionError(null);
      setCurriculumPlanResult({
        personal: null,
        department: null,
      });
      setDirectoryResult(null);
      setVerifiedIdentityResult(null);

      try {
        const nextAccount = await fetchCurrentUpstreamDemoAccount();

        if (isCancelled) {
          return;
        }

        const nextStoredSession = readStoredUpstreamSession(nextAccount.accountId);

        setCurrentAccount(nextAccount);
        setStoredSession(nextStoredSession);
        setIsLoadingCurrentAccount(false);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setCurrentAccount(null);
        setStoredSession(null);
        setPageError(resolveUpstreamErrorMessage(error, '暂时无法确认当前登录账号。'));
        setIsLoadingCurrentAccount(false);
      }
    }

    void bootstrapPage();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storedSession || isLoginModalOpen || isLoadingCurrentAccount) {
      return;
    }

    if (activePanelKey === 'teacher-directory' && !directoryResult && !isLoadingDirectory) {
      void performAction(storedSession, { type: 'teacher-directory' });
    } else if (
      activePanelKey === 'verified-staff-identity' &&
      !verifiedIdentityResult &&
      !isLoadingIdentity
    ) {
      void performAction(storedSession, { type: 'verified-staff-identity' });
    }
  }, [
    activePanelKey,
    storedSession,
    directoryResult,
    verifiedIdentityResult,
    isLoadingDirectory,
    isLoadingIdentity,
    isLoadingCurrentAccount,
    performAction,
    isLoginModalOpen,
  ]);

  useEffect(() => {
    const records = personalCurriculumPlanRecords;

    if (!records.length) {
      personalCurriculumPlanForm.setFieldsValue({
        className: undefined,
        courseName: undefined,
      });
      return;
    }

    const nextClassNameOptions = getUniqueValues(records.map((record) => record.className));
    const currentClassName = personalCurriculumPlanForm.getFieldValue('className') as
      | string
      | undefined;
    const nextClassName = nextClassNameOptions.includes(currentClassName ?? '')
      ? currentClassName
      : nextClassNameOptions[0];
    const nextCourseNameOptions = getUniqueValues(
      records
        .filter((record) => record.className === nextClassName)
        .map((record) => record.courseName),
    );
    const currentCourseName = personalCurriculumPlanForm.getFieldValue('courseName') as
      | string
      | undefined;
    const nextCourseName = nextCourseNameOptions.includes(currentCourseName ?? '')
      ? currentCourseName
      : nextCourseNameOptions[0];

    if (currentClassName !== nextClassName || currentCourseName !== nextCourseName) {
      personalCurriculumPlanForm.setFieldsValue({
        className: nextClassName,
        courseName: nextCourseName,
      });
    }
  }, [personalCurriculumPlanForm, personalCurriculumPlanRecords]);

  useEffect(() => {
    const records = departmentCurriculumPlanRecords;

    if (!records.length) {
      departmentCurriculumPlanForm.setFieldsValue({
        className: undefined,
        courseName: undefined,
      });
      return;
    }

    const nextClassNameOptions = getUniqueValues(records.map((record) => record.className));
    const currentClassName = departmentCurriculumPlanForm.getFieldValue('className') as
      | string
      | undefined;
    const nextClassName = nextClassNameOptions.includes(currentClassName ?? '')
      ? currentClassName
      : nextClassNameOptions[0];
    const nextCourseNameOptions = getUniqueValues(
      records
        .filter((record) => record.className === nextClassName)
        .map((record) => record.courseName),
    );
    const currentCourseName = departmentCurriculumPlanForm.getFieldValue('courseName') as
      | string
      | undefined;
    const nextCourseName = nextCourseNameOptions.includes(currentCourseName ?? '')
      ? currentCourseName
      : nextCourseNameOptions[0];

    if (currentClassName !== nextClassName || currentCourseName !== nextCourseName) {
      departmentCurriculumPlanForm.setFieldsValue({
        className: nextClassName,
        courseName: nextCourseName,
      });
    }
  }, [departmentCurriculumPlanForm, departmentCurriculumPlanRecords]);

  const hasStoredSession = Boolean(storedSession);
  const isRunningUpstreamAction =
    isLoadingCurriculumPlans.personal ||
    isLoadingCurriculumPlans.department ||
    isLoadingDirectory ||
    isLoadingIdentity;
  const activePanelError = actionError?.panel === activePanelKey ? actionError.message : null;

  function getPendingActionLabel(action: PendingUpstreamAction | null) {
    switch (action?.type) {
      case 'teacher-directory':
        return '读取教师字典';
      case 'verified-staff-identity':
        return '读取教职工身份';
      case 'curriculum-plan':
        return `读取${CURRICULUM_PLAN_SCOPE_LABEL[action.scope]}列表`;
      default:
        return '读取上游数据';
    }
  }

  async function handleCurriculumPlanRequest(scope: CurriculumPlanScope) {
    try {
      if (scope === 'personal') {
        const values = await personalCurriculumPlanForm.validateFields([
          'schoolYear',
          'semester',
          'departmentId',
        ]);

        await ensureSessionAndRun({
          scope,
          type: 'curriculum-plan',
          values,
        });
      } else {
        const values = await departmentCurriculumPlanForm.validateFields([
          'schoolYear',
          'semester',
          'departmentId',
          'reviewStatus',
          'teacherId',
        ]);

        await ensureSessionAndRun({
          scope,
          type: 'curriculum-plan',
          values,
        });
      }
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'errorFields' in error &&
        Array.isArray(error.errorFields)
      ) {
        return;
      }

      setActionError({
        panel: CURRICULUM_PLAN_PANEL_BY_SCOPE[scope],
        message: resolveUpstreamErrorMessage(
          error,
          `暂时无法读取${CURRICULUM_PLAN_SCOPE_LABEL[scope]}列表。`,
        ),
      });
    }
  }

  function renderIntroductionPanel() {
    return (
      <div className="flex flex-col gap-4">
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          使用说明
        </Typography.Title>
        <Typography.Paragraph>
          本页面用于演示与上游系统 (Upstream) 的会话集成与数据交互。
        </Typography.Paragraph>
        <Typography.Paragraph>
          <ul className="list-disc pl-6 flex flex-col gap-2">
            <li>
              <strong>身份与会话：</strong>
              页面会自动检测当前本站账号是否持有有效的上游 Token。若未登录或 Token
              已过期，系统会引导您进行登录。
            </li>
            <li>
              <strong>自动读取：</strong>
              在登录状态下，切换至“教师字典”或“教职工身份”标签页时，页面会<strong>自动触发</strong>
              后端请求并读取最新数据。
            </li>
            <li>
              <strong>按需查询：</strong>
              “个人教学计划”和“系部教学计划”标签页均支持按学年、学期查询列表，并基于班级与课程读取对应详情。
            </li>
            <li>
              <strong>Token 滚动：</strong>
              后端在代访问上游时，若上游返回了更新的
              Token，页面会实时感知并更新本地存储，确保持续可用。
            </li>
          </ul>
        </Typography.Paragraph>
        {!hasStoredSession && (
          <Alert
            type="info"
            showIcon
            title="您尚未登录上游账号，请点击右上角“登录”按钮开始体验。"
          />
        )}
      </div>
    );
  }

  function renderTeacherDirectoryPanel() {
    return (
      <div className="flex flex-col gap-4">
        {renderUpstreamInterfaceTag('fetchTeacherDirectory')}
        {activePanelError ? <Alert type="warning" showIcon title={activePanelError} /> : null}

        {isLoadingDirectory ? (
          <Alert type="info" showIcon title="正在读取教师字典..." />
        ) : directoryResult ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Tag variant="filled" color="processing">
                教师总数：{directoryResult.teachers.length}
              </Tag>
              <Tag variant="filled" color="cyan">
                过期时间：{formatDateTime(directoryResult.expiresAt)}
              </Tag>
              <Tag variant="filled" color="blue">
                预览条数：{Math.min(directoryResult.teachers.length, TEACHER_PREVIEW_LIMIT)}
              </Tag>
              <Button
                size="small"
                type="link"
                onClick={() => void ensureSessionAndRun({ type: 'teacher-directory' })}
              >
                刷新
              </Button>
            </div>

            <pre className="overflow-x-auto rounded-block border border-border-secondary bg-bg-layout p-4 text-sm leading-6 text-text">
              {JSON.stringify(buildTeacherDirectoryPreview(directoryResult), null, 2)}
            </pre>
          </>
        ) : (
          <Alert
            type="info"
            showIcon
            title={
              hasStoredSession ? '正在尝试读取数据...' : '登录 upstream 后即可自动读取教师字典。'
            }
          />
        )}
      </div>
    );
  }

  function renderVerifiedStaffIdentityPanel() {
    return (
      <div className="flex flex-col gap-4">
        {renderUpstreamInterfaceTag('fetchVerifiedStaffIdentity')}
        {activePanelError ? <Alert type="warning" showIcon title={activePanelError} /> : null}

        {isLoadingIdentity ? (
          <Alert type="info" showIcon title="正在读取教职工身份..." />
        ) : verifiedIdentityResult ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Tag variant="filled" color="green">
                姓名：{verifiedIdentityResult.personName}
              </Tag>
              <Tag variant="filled" color="gold">
                身份：{verifiedIdentityResult.identityKind}
              </Tag>
              <Tag variant="filled" color="cyan">
                过期时间：{formatDateTime(verifiedIdentityResult.expiresAt)}
              </Tag>
              <Button
                size="small"
                type="link"
                onClick={() => void ensureSessionAndRun({ type: 'verified-staff-identity' })}
              >
                刷新
              </Button>
            </div>

            <pre className="overflow-x-auto rounded-block border border-border-secondary bg-bg-layout p-4 text-sm leading-6 text-text">
              {JSON.stringify(verifiedIdentityResult, null, 2)}
            </pre>
          </>
        ) : (
          <Alert
            type="info"
            showIcon
            title={
              hasStoredSession ? '正在尝试读取数据...' : '登录 upstream 后即可自动读取教职工身份。'
            }
          />
        )}
      </div>
    );
  }

  function renderCurriculumPlanPanel() {
    const scope: CurriculumPlanScope =
      activePanelKey === 'department-curriculum-plan' ? 'department' : 'personal';
    const curriculumPlanForm =
      scope === 'personal' ? personalCurriculumPlanForm : departmentCurriculumPlanForm;
    const currentCurriculumPlanResult = curriculumPlanResult[scope];
    const currentCurriculumPlanRecords =
      scope === 'personal' ? personalCurriculumPlanRecords : departmentCurriculumPlanRecords;
    const currentClassNameOptions =
      scope === 'personal' ? personalClassNameOptions : departmentClassNameOptions;
    const currentCourseNameOptions =
      scope === 'personal' ? personalCourseNameOptions : departmentCourseNameOptions;
    const currentMatchingCurriculumPlans =
      scope === 'personal' ? personalMatchingCurriculumPlans : departmentMatchingCurriculumPlans;
    const selectedClassName =
      scope === 'personal' ? selectedPersonalClassName : selectedDepartmentClassName;
    const selectedCourseName =
      scope === 'personal' ? selectedPersonalCourseName : selectedDepartmentCourseName;
    const isLoadingCurriculumPlanList = isLoadingCurriculumPlans[scope];
    const panelLabel = CURRICULUM_PLAN_SCOPE_LABEL[scope];

    return (
      <div className="flex flex-col gap-4">
        {renderUpstreamInterfaceTag(
          scope === 'personal' ? 'fetchCurriculumPlanList' : 'fetchDepartmentCurriculumPlanList',
        )}
        {activePanelError ? <Alert type="warning" showIcon title={activePanelError} /> : null}

        <Form
          form={curriculumPlanForm}
          initialValues={
            scope === 'personal'
              ? getDefaultPersonalCurriculumPlanValues()
              : getDefaultDepartmentCurriculumPlanValues()
          }
          layout="inline"
          requiredMark={false}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}
        >
          <Form.Item
            label="学年"
            name="schoolYear"
            rules={[{ required: true, message: '请输入学年' }]}
          >
            <Input placeholder="2025" style={{ width: 100 }} />
          </Form.Item>

          <Form.Item
            label="学期"
            name="semester"
            rules={[{ required: true, message: '请输入学期' }]}
          >
            <Input placeholder="2" style={{ width: 60 }} />
          </Form.Item>

          <Form.Item label="部门 ID" name="departmentId">
            <Input placeholder="ORG0302" style={{ width: 120 }} />
          </Form.Item>

          {scope === 'department' ? (
            <Form.Item label="审核状态" name="reviewStatus">
              <Select
                allowClear
                placeholder="全部"
                style={{ width: 140 }}
                options={DEPARTMENT_CURRICULUM_PLAN_REVIEW_STATUS_OPTIONS}
              />
            </Form.Item>
          ) : null}

          {scope === 'department' ? (
            <Form.Item label="教师 ID" name="teacherId">
              <Input placeholder="默认空字符串" style={{ width: 140 }} />
            </Form.Item>
          ) : null}

          <Form.Item>
            <Button
              type="primary"
              loading={isLoadingCurriculumPlanList}
              onClick={() => {
                void handleCurriculumPlanRequest(scope);
              }}
            >
              查询
            </Button>
          </Form.Item>

          {isLoadingCurriculumPlanList ? (
            <Alert type="info" showIcon title={`正在读取${panelLabel}列表...`} />
          ) : currentCurriculumPlanResult ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Tag variant="filled" color="magenta">
                  计划总数：{currentCurriculumPlanResult.count}
                </Tag>
                <Tag variant="filled" color="cyan">
                  过期时间：{formatDateTime(currentCurriculumPlanResult.expiresAt)}
                </Tag>
                <Tag variant="filled" color="blue">
                  预览条数：
                  {Array.isArray(currentCurriculumPlanResult.plans)
                    ? Math.min(
                        currentCurriculumPlanResult.plans.length,
                        CURRICULUM_PLAN_PREVIEW_LIMIT,
                      )
                    : CURRICULUM_PLAN_PREVIEW_LIMIT}
                </Tag>
                <Tag variant="filled" color="processing">
                  可匹配计划：{currentCurriculumPlanRecords.length}
                </Tag>
              </div>

              {currentCurriculumPlanRecords.length > 0 ? (
                <Card size="small" title="详情定位">
                  <div className="flex flex-col gap-4">
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      这里直接展示当前班级与课程唯一命中的计划原始记录，便于确认定位是否正确。
                    </Typography.Paragraph>

                    <div className="flex flex-wrap gap-4">
                      <Form.Item
                        label="班级名称"
                        name="className"
                        rules={[{ required: true, message: '请选择班级名称' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Select
                          placeholder="请选择班级名称"
                          style={{ width: 280 }}
                          options={currentClassNameOptions.map((value) => ({
                            label: value,
                            value,
                          }))}
                          onChange={() => {
                            setActionError(null);
                          }}
                        />
                      </Form.Item>

                      <Form.Item
                        label="课程名称"
                        name="courseName"
                        rules={[{ required: true, message: '请选择课程名称' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Select
                          placeholder="请选择课程名称"
                          style={{ width: 360 }}
                          options={currentCourseNameOptions.map((value) => ({
                            label: value,
                            value,
                          }))}
                          onChange={() => {
                            setActionError(null);
                          }}
                        />
                      </Form.Item>
                    </div>

                    {selectedClassName && selectedCourseName ? (
                      currentMatchingCurriculumPlans.length === 1 ? (
                        <Card
                          size="small"
                          title={`已定位计划：${currentMatchingCurriculumPlans[0].className} / ${currentMatchingCurriculumPlans[0].courseName}`}
                        >
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap gap-2">
                              <Tag variant="filled" color="processing">
                                计划 ID：{currentMatchingCurriculumPlans[0].planId}
                              </Tag>
                              {currentMatchingCurriculumPlans[0].teacherName ? (
                                <Tag variant="filled" color="cyan">
                                  任课教师：{currentMatchingCurriculumPlans[0].teacherName}
                                </Tag>
                              ) : null}
                              {currentMatchingCurriculumPlans[0].weeklyHours ? (
                                <Tag variant="filled" color="blue">
                                  周学时：{currentMatchingCurriculumPlans[0].weeklyHours}
                                </Tag>
                              ) : null}
                            </div>

                            <pre className="overflow-x-auto rounded-block border border-border-secondary bg-bg-layout p-4 text-sm leading-6 text-text">
                              {JSON.stringify(currentMatchingCurriculumPlans[0].raw, null, 2)}
                            </pre>
                          </div>
                        </Card>
                      ) : currentMatchingCurriculumPlans.length > 1 ? (
                        <Alert
                          type="warning"
                          showIcon
                          title={`当前组合匹配到 ${currentMatchingCurriculumPlans.length} 条计划，暂时无法唯一定位详情。`}
                        />
                      ) : (
                        <Alert
                          type="warning"
                          showIcon
                          title="当前班级与课程在列表中没有匹配项，请重新选择。"
                        />
                      )
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          setActionError(null);
                          curriculumPlanForm.setFieldsValue({
                            className: currentClassNameOptions[0],
                            courseName: getUniqueValues(
                              currentCurriculumPlanRecords
                                .filter((record) => record.className === currentClassNameOptions[0])
                                .map((record) => record.courseName),
                            )[0],
                          });
                        }}
                      >
                        重置选择
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <Alert
                  type="info"
                  showIcon
                  title="当前列表未识别出可用的班级名称、课程名称或计划 ID，暂时无法继续读取详情。"
                />
              )}
            </>
          ) : (
            !hasStoredSession && (
              <Alert type="info" showIcon title={`登录 upstream 后即可读取${panelLabel}列表。`} />
            )
          )}
        </Form>
      </div>
    );
  }

  function renderActivePanel() {
    switch (activePanelKey) {
      case 'introduction':
        return renderIntroductionPanel();
      case 'teacher-directory':
        return renderTeacherDirectoryPanel();
      case 'verified-staff-identity':
        return renderVerifiedStaffIdentityPanel();
      case 'personal-curriculum-plan':
      case 'department-curriculum-plan':
        return renderCurriculumPlanPanel();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <Typography.Title level={3} style={{ marginBottom: 8 }}>
            Upstream 会话示例页
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {upstreamSessionDemoLabMeta.purpose}
          </Typography.Paragraph>
        </div>

        <div className="flex flex-wrap gap-2">
          <Tag variant="filled" color="blue">
            负责人：{upstreamSessionDemoLabMeta.owner}
          </Tag>
          <Tag variant="filled" color="purple">
            复核时间：{upstreamSessionDemoLabMeta.reviewAt}
          </Tag>
          <Tag variant="filled" color="green">
            环境：{upstreamSessionDemoLabAccess.env.join(', ')}
          </Tag>
          <Tag variant="filled" color="gold">
            访问级别：{upstreamSessionDemoLabAccess.allowedAccessLevels.join(', ')}
          </Tag>
        </div>

        <Alert
          type="info"
          showIcon
          title="链路说明"
          description="当前页演示前端持有 upstream token、后端代访问 upstream 的链路。登录成功后，切换到教师字典或教职工身份会自动读取数据，个人/系部教学计划则按需查询。任一 upstream 请求若返回滚动 token，页面都会立即覆盖本地旧 token。"
        />
      </div>

      <div className="flex flex-col gap-6">
        <Card size="small">
          <Descriptions
            size="small"
            column={{ xxl: 5, xl: 5, lg: 3, md: 2, sm: 1, xs: 1 }}
            items={[
              {
                key: 'account',
                label: '本站账号',
                children: currentAccount?.displayName ?? '未命名账号',
              },
              {
                key: 'upstream',
                label: '上游账号',
                children: (
                  <span className={storedSession ? 'font-medium' : 'text-text-secondary'}>
                    {storedSession?.upstreamLoginId || '未登录'}
                  </span>
                ),
              },
              {
                key: 'expires',
                label: '过期时间',
                children: formatDateTime(storedSession?.expiresAt ?? null),
              },
              {
                key: 'token',
                label: '上游 Token',
                children: storedSession?.upstreamSessionToken ? (
                  <Tooltip
                    title={
                      <span className="break-all font-mono text-xs">
                        {storedSession.upstreamSessionToken}
                      </span>
                    }
                  >
                    <Tag
                      color="processing"
                      variant="filled"
                      style={{ cursor: 'help', marginInlineEnd: 0 }}
                    >
                      已持有
                    </Tag>
                  </Tooltip>
                ) : (
                  <Tag variant="filled" style={{ marginInlineEnd: 0 }}>
                    未持有
                  </Tag>
                ),
              },
              {
                key: 'actions',
                label: '操作',
                children: (
                  <div className="flex gap-2">
                    {!hasStoredSession && (
                      <Button type="primary" size="small" onClick={() => setIsLoginModalOpen(true)}>
                        登录
                      </Button>
                    )}
                    <Button
                      size="small"
                      danger
                      disabled={!hasStoredSession || isRunningUpstreamAction}
                      onClick={() => {
                        clearCurrentSession();
                        setLoginError(null);
                      }}
                    >
                      清空 Token
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </Card>

        <div className="overflow-hidden">
          <Card styles={{ body: { padding: 0 } }}>
            {pageError ? (
              <div className="p-4">
                <Alert type="error" showIcon title={pageError} />
              </div>
            ) : null}

            <Tabs
              tabPosition="left"
              activeKey={activePanelKey}
              onChange={(key) => setActivePanelKey(key as UpstreamPanelKey)}
              style={{ minHeight: 400 }}
              items={UPSTREAM_PANELS.map((panel) => ({
                key: panel.key,
                label: panel.label,
                children: (
                  <div className="p-6">
                    {activePanelKey === panel.key ? renderActivePanel() : null}
                  </div>
                ),
              }))}
            />
          </Card>
        </div>
      </div>

      <Modal
        destroyOnHidden
        open={isLoginModalOpen}
        title={`${getPendingActionLabel(pendingAction)}前登录 upstream`}
        okText="登录并继续"
        cancelText="取消"
        confirmLoading={isSubmittingLogin}
        onCancel={() => {
          setIsLoginModalOpen(false);
          setPendingAction(null);
          setLoginError(null);
          form.resetFields(['password']);
        }}
        onOk={() => {
          void form.submit();
        }}
      >
        <div className="flex flex-col gap-4 pt-2">
          <Typography.Text type="secondary">
            当前操作需要有效的 upstream token。登录成功后，页面会自动继续
            {getPendingActionLabel(pendingAction)}。
          </Typography.Text>

          {loginError ? <Alert type="error" showIcon title={loginError} /> : null}

          <Form<UpstreamLoginFormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={async (values) => {
              if (!currentAccount) {
                return;
              }

              setIsSubmittingLogin(true);
              setLoginError(null);
              setActionError(null);

              try {
                const normalizedUserId = values.userId.trim();
                const upstreamSession = await loginUpstreamSession({
                  password: values.password,
                  userId: normalizedUserId,
                });
                const nextStoredSession: StoredUpstreamSession = {
                  accountId: currentAccount.accountId,
                  expiresAt: upstreamSession.expiresAt,
                  upstreamLoginId: normalizedUserId,
                  upstreamSessionToken: upstreamSession.upstreamSessionToken,
                  version: 1,
                };
                const nextPendingAction = pendingAction;

                writeStoredUpstreamSession(nextStoredSession);
                setStoredSession(nextStoredSession);
                setCurriculumPlanResult({
                  personal: null,
                  department: null,
                });
                setDirectoryResult(null);
                setVerifiedIdentityResult(null);
                setIsLoginModalOpen(false);
                setPendingAction(null);
                form.setFieldsValue({
                  password: '',
                  userId: normalizedUserId,
                });

                if (nextPendingAction) {
                  await performAction(nextStoredSession, nextPendingAction);
                }
              } catch (error) {
                setLoginError(
                  resolveUpstreamErrorMessage(error, '暂时无法登录 upstream，请稍后重试。'),
                );
              } finally {
                setIsSubmittingLogin(false);
              }
            }}
          >
            <Form.Item
              label="Upstream 用户名"
              name="userId"
              rules={[{ required: true, message: '请输入 upstream 用户名。' }]}
            >
              <Input placeholder="请输入 upstream 用户名" autoComplete="username" />
            </Form.Item>

            <Form.Item
              label="Upstream 密码"
              name="password"
              rules={[{ required: true, message: '请输入 upstream 密码。' }]}
            >
              <Input.Password placeholder="请输入 upstream 密码" autoComplete="current-password" />
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </div>
  );
}
