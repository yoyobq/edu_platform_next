import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, Space, Tag, Typography } from 'antd';

import { upstreamSessionDemoLabAccess } from './access';
import {
  type CurrentUpstreamDemoAccount,
  fetchCurrentUpstreamDemoAccount,
  fetchTeacherDirectory,
  isExpiredUpstreamSessionError,
  loginUpstreamSession,
  resolveUpstreamErrorMessage,
  type TeacherDirectoryResult,
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

export function UpstreamSessionDemoLabPage() {
  const [form] = Form.useForm<UpstreamLoginFormValues>();
  const [currentAccount, setCurrentAccount] = useState<CurrentUpstreamDemoAccount | null>(null);
  const [isLoadingCurrentAccount, setIsLoadingCurrentAccount] = useState(true);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directoryResult, setDirectoryResult] = useState<TeacherDirectoryResult | null>(null);
  const [storedSession, setStoredSession] = useState<StoredUpstreamSession | null>(null);

  const loadDirectory = useCallback(
    async (
      session: StoredUpstreamSession,
      options?: {
        invalidMessage?: string;
      },
    ) => {
      setIsLoadingDirectory(true);
      setDirectoryError(null);

      try {
        const result = await fetchTeacherDirectory({
          sessionToken: session.upstreamSessionToken,
        });

        writeStoredUpstreamSession({
          accountId: session.accountId,
          expiresAt: result.expiresAt,
          upstreamLoginId: session.upstreamLoginId,
          upstreamSessionToken: result.upstreamSessionToken,
        });

        setStoredSession(
          readStoredUpstreamSession(session.accountId) ?? {
            ...session,
            expiresAt: result.expiresAt,
            upstreamSessionToken: result.upstreamSessionToken,
          },
        );
        setDirectoryResult(result);
      } catch (error) {
        if (isExpiredUpstreamSessionError(error)) {
          clearStoredUpstreamSession();
          setStoredSession(null);
          setDirectoryResult(null);
          setDirectoryError(options?.invalidMessage ?? 'upstream 会话已失效，请重新登录。');
          return;
        }

        setDirectoryResult(null);
        setDirectoryError(resolveUpstreamErrorMessage(error, '暂时无法读取教师字典。'));
      } finally {
        setIsLoadingDirectory(false);
      }
    },
    [],
  );

  useEffect(() => {
    let isCancelled = false;

    async function bootstrapPage() {
      setIsLoadingCurrentAccount(true);
      setLoginError(null);
      setDirectoryError(null);
      setDirectoryResult(null);

      try {
        const nextAccount = await fetchCurrentUpstreamDemoAccount();

        if (isCancelled) {
          return;
        }

        const nextStoredSession = readStoredUpstreamSession(nextAccount.accountId);

        setCurrentAccount(nextAccount);
        setStoredSession(nextStoredSession);
        setIsLoadingCurrentAccount(false);

        if (nextStoredSession) {
          await loadDirectory(nextStoredSession, {
            invalidMessage: '当前账号的 upstream 会话已失效，请重新登录。',
          });
        }
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setCurrentAccount(null);
        setStoredSession(null);
        setDirectoryError(resolveUpstreamErrorMessage(error, '暂时无法确认当前登录账号。'));
        setIsLoadingCurrentAccount(false);
      }
    }

    void bootstrapPage();

    return () => {
      isCancelled = true;
    };
  }, [loadDirectory]);

  const showingLoginForm = !storedSession;
  const showPrimaryLoading =
    isLoadingCurrentAccount || (Boolean(storedSession) && isLoadingDirectory && !directoryResult);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              Upstream 会话示例页
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {upstreamSessionDemoLabMeta.purpose}
            </Typography.Paragraph>
          </div>

          <div className="flex flex-wrap gap-2">
            <Tag color="blue">负责人：{upstreamSessionDemoLabMeta.owner}</Tag>
            <Tag color="purple">复核时间：{upstreamSessionDemoLabMeta.reviewAt}</Tag>
            <Tag color="green">环境：{upstreamSessionDemoLabAccess.env.join(', ')}</Tag>
            <Tag color="gold">
              访问级别：{upstreamSessionDemoLabAccess.allowedAccessLevels.join(', ')}
            </Tag>
          </div>

          <Alert
            type="info"
            showIcon
            title="链路说明"
            description="当前页只演示前端持有 upstream token、后端代访问 upstream 的模式。本站后端不保存 upstream 用户名、密码或会话 token；教师字典成功返回后，页面会用后端回传的滚动 token 覆盖本地旧 token。"
          />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,460px)_minmax(0,1fr)]">
        <Card title={showingLoginForm ? '登录 upstream' : '当前 upstream 会话'}>
          <div className="flex flex-col gap-4">
            {loginError ? <Alert type="error" showIcon title={loginError} /> : null}
            {directoryError ? <Alert type="warning" showIcon title={directoryError} /> : null}

            {showPrimaryLoading ? (
              <Alert type="info" showIcon title="正在确认当前账号的 upstream 会话状态。" />
            ) : null}

            {showingLoginForm ? (
              <Form<UpstreamLoginFormValues>
                form={form}
                layout="vertical"
                requiredMark={false}
                size="large"
                onFinish={async (values) => {
                  if (!currentAccount) {
                    return;
                  }

                  setIsSubmittingLogin(true);
                  setLoginError(null);
                  setDirectoryError(null);

                  try {
                    const upstreamSession = await loginUpstreamSession({
                      password: values.password,
                      userId: values.userId.trim(),
                    });
                    const nextStoredSession: StoredUpstreamSession = {
                      accountId: currentAccount.accountId,
                      expiresAt: upstreamSession.expiresAt,
                      upstreamLoginId: values.userId.trim(),
                      upstreamSessionToken: upstreamSession.upstreamSessionToken,
                      version: 1,
                    };

                    writeStoredUpstreamSession(nextStoredSession);
                    setStoredSession(nextStoredSession);
                    setDirectoryResult(null);
                    await loadDirectory(nextStoredSession);
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
                  <Input.Password
                    placeholder="请输入 upstream 密码"
                    autoComplete="current-password"
                  />
                </Form.Item>

                <Form.Item style={{ marginBottom: 0 }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={isSubmittingLogin || isLoadingDirectory}
                  >
                    登录并读取教师字典
                  </Button>
                </Form.Item>
              </Form>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <Typography.Text type="secondary">当前本站账号</Typography.Text>
                  <Typography.Text>{currentAccount?.displayName ?? '未命名账号'}</Typography.Text>
                </div>

                <div className="flex flex-col gap-2">
                  <Typography.Text type="secondary">上游账号</Typography.Text>
                  <Typography.Text>{storedSession.upstreamLoginId || '未记录'}</Typography.Text>
                </div>

                <div className="flex flex-col gap-2">
                  <Typography.Text type="secondary">上游会话过期时间</Typography.Text>
                  <Typography.Text>{formatDateTime(storedSession.expiresAt)}</Typography.Text>
                </div>

                <Space>
                  <Button
                    type="primary"
                    loading={isLoadingDirectory}
                    onClick={() => {
                      void loadDirectory(storedSession);
                    }}
                  >
                    重新读取教师字典
                  </Button>
                  <Button
                    disabled={isLoadingDirectory}
                    onClick={() => {
                      clearStoredUpstreamSession();
                      setStoredSession(null);
                      setDirectoryResult(null);
                      setDirectoryError(null);
                      setLoginError(null);
                      form.resetFields();
                    }}
                  >
                    清空 token
                  </Button>
                </Space>
              </>
            )}
          </div>
        </Card>

        <Card title="教师字典原始结果">
          {showPrimaryLoading ? (
            <Alert type="info" showIcon title="正在通过后端读取 upstream 教师字典。" />
          ) : directoryResult ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <Tag color="processing">教师数量：{directoryResult.teachers.length}</Tag>
                <Tag color="cyan">过期时间：{formatDateTime(directoryResult.expiresAt)}</Tag>
              </div>

              <pre className="overflow-x-auto rounded-lg border border-border-secondary bg-bg-layout p-4 text-sm leading-6 text-text">
                {JSON.stringify(directoryResult, null, 2)}
              </pre>
            </div>
          ) : (
            <Alert
              type="info"
              showIcon
              title={
                showingLoginForm ? '登录 upstream 后即可读取教师字典。' : '当前暂无教师字典结果。'
              }
            />
          )}
        </Card>
      </div>
    </div>
  );
}
