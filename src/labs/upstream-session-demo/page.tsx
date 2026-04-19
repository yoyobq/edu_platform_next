import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';

import { upstreamSessionDemoLabAccess } from './access';
import {
  type CurrentUpstreamDemoAccount,
  type CurriculumPlanListResult,
  fetchCurrentUpstreamDemoAccount,
  fetchCurriculumPlanList,
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

type CurriculumPlanFormValues = {
  departmentId: string;
  schoolYear: string;
  semester: string;
};

type PendingUpstreamAction =
  | { type: 'teacher-directory' }
  | { type: 'verified-staff-identity' }
  | { type: 'curriculum-plan'; values: CurriculumPlanFormValues };

type UpstreamPanelKey = PendingUpstreamAction['type'] | 'introduction';

type UpstreamActionError = {
  message: string;
  panel: UpstreamPanelKey;
};

const TEACHER_PREVIEW_LIMIT = 5;
const CURRICULUM_PLAN_PREVIEW_LIMIT = 3;

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
    key: 'curriculum-plan',
    label: '教学计划列表',
  },
];

function getDefaultCurriculumPlanValues(): CurriculumPlanFormValues {
  return {
    departmentId: 'ORG0302',
    schoolYear: '2025',
    semester: '2',
  };
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

function buildCurriculumPlanPreview(result: CurriculumPlanListResult) {
  if (Array.isArray(result.plans)) {
    return {
      count: result.count,
      expiresAt: result.expiresAt,
      plans: result.plans.slice(0, CURRICULUM_PLAN_PREVIEW_LIMIT),
      truncated: result.plans.length > CURRICULUM_PLAN_PREVIEW_LIMIT,
      upstreamSessionToken: result.upstreamSessionToken,
    };
  }

  return {
    count: result.count,
    expiresAt: result.expiresAt,
    plans: result.plans,
    truncated: false,
    upstreamSessionToken: result.upstreamSessionToken,
  };
}

export function UpstreamSessionDemoLabPage() {
  const [form] = Form.useForm<UpstreamLoginFormValues>();
  const [curriculumPlanForm] = Form.useForm<CurriculumPlanFormValues>();
  const [activePanelKey, setActivePanelKey] = useState<UpstreamPanelKey>('introduction');
  const [currentAccount, setCurrentAccount] = useState<CurrentUpstreamDemoAccount | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLoadingCurrentAccount, setIsLoadingCurrentAccount] = useState(true);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [isLoadingCurriculumPlans, setIsLoadingCurriculumPlans] = useState(false);
  const [isLoadingIdentity, setIsLoadingIdentity] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<UpstreamActionError | null>(null);
  const [curriculumPlanResult, setCurriculumPlanResult] = useState<CurriculumPlanListResult | null>(
    null,
  );
  const [directoryResult, setDirectoryResult] = useState<TeacherDirectoryResult | null>(null);
  const [verifiedIdentityResult, setVerifiedIdentityResult] =
    useState<VerifiedStaffIdentityResult | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingUpstreamAction | null>(null);
  const [storedSession, setStoredSession] = useState<StoredUpstreamSession | null>(null);

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
    setCurriculumPlanResult(null);
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
            setIsLoadingCurriculumPlans(true);
            const result = await fetchCurriculumPlanList({
              departmentId: action.values.departmentId,
              schoolYear: action.values.schoolYear,
              semester: action.values.semester,
              sessionToken: session.upstreamSessionToken,
            });

            persistStoredSession(session, {
              expiresAt: result.expiresAt,
              upstreamSessionToken: result.upstreamSessionToken,
            });
            setCurriculumPlanResult(result);
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
            setCurriculumPlanResult(null);
            setActionError({
              panel: 'curriculum-plan',
              message: resolveUpstreamErrorMessage(error, '暂时无法读取教学计划列表。'),
            });
            return;
        }
      } finally {
        setIsLoadingCurriculumPlans(false);
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
      setCurriculumPlanResult(null);
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

  const hasStoredSession = Boolean(storedSession);
  const isRunningUpstreamAction =
    isLoadingCurriculumPlans || isLoadingDirectory || isLoadingIdentity;
  const activePanelError = actionError?.panel === activePanelKey ? actionError.message : null;

  function getPendingActionLabel(action: PendingUpstreamAction | null) {
    switch (action?.type) {
      case 'teacher-directory':
        return '读取教师字典';
      case 'verified-staff-identity':
        return '读取教职工身份';
      case 'curriculum-plan':
        return '读取教学计划列表';
      default:
        return '读取上游数据';
    }
  }

  async function handleCurriculumPlanRequest() {
    try {
      const values = await curriculumPlanForm.validateFields();

      await ensureSessionAndRun({
        type: 'curriculum-plan',
        values,
      });
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
        panel: 'curriculum-plan',
        message: resolveUpstreamErrorMessage(error, '暂时无法读取教学计划列表。'),
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
              “教学计划列表”标签页支持参数化的按需查询，需要手动填写年份、学期等信息后点击“查询”。
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
    return (
      <div className="flex flex-col gap-4">
        {activePanelError ? <Alert type="warning" showIcon title={activePanelError} /> : null}

        <Form<CurriculumPlanFormValues>
          form={curriculumPlanForm}
          initialValues={getDefaultCurriculumPlanValues()}
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

          <Form.Item>
            <Button
              type="primary"
              loading={isLoadingCurriculumPlans}
              onClick={() => {
                void handleCurriculumPlanRequest();
              }}
            >
              查询
            </Button>
          </Form.Item>
        </Form>

        {isLoadingCurriculumPlans ? (
          <Alert type="info" showIcon title="正在读取教学计划列表..." />
        ) : curriculumPlanResult ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Tag variant="filled" color="magenta">
                计划总数：{curriculumPlanResult.count}
              </Tag>
              <Tag variant="filled" color="cyan">
                过期时间：{formatDateTime(curriculumPlanResult.expiresAt)}
              </Tag>
              <Tag variant="filled" color="blue">
                预览条数：
                {Array.isArray(curriculumPlanResult.plans)
                  ? Math.min(curriculumPlanResult.plans.length, CURRICULUM_PLAN_PREVIEW_LIMIT)
                  : CURRICULUM_PLAN_PREVIEW_LIMIT}
              </Tag>
            </div>

            <pre className="overflow-x-auto rounded-block border border-border-secondary bg-bg-layout p-4 text-sm leading-6 text-text">
              {JSON.stringify(buildCurriculumPlanPreview(curriculumPlanResult), null, 2)}
            </pre>
          </>
        ) : (
          <Alert
            type="info"
            showIcon
            title={
              hasStoredSession
                ? '填写参数后点击“查询”即可查看预览结果。'
                : '登录 upstream 后即可读取教学计划列表。'
            }
          />
        )}
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
      case 'curriculum-plan':
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
          description="当前页演示前端持有 upstream token、后端代访问 upstream 的链路。登录成功后，切换标签页会自动读取数据。任一 upstream 请求若返回滚动 token，页面都会立即覆盖本地旧 token。"
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
              tabPlacement="left"
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
                setCurriculumPlanResult(null);
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
