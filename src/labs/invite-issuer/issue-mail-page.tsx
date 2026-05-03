import { type Key, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Input,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';

import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
  type StoredUpstreamSession,
  type UpstreamLoginFormValues,
  UpstreamLoginModal,
  useUpstreamSession,
} from '@/entities/upstream-session';

import {
  populateStaffDirectory,
  readStaffDirectory,
  type StaffDirectoryEntry,
  type StaffDirectoryResult,
} from '@/shared/upstream';

import { inviteIssuerLabAccess } from './access';
import {
  adminRequestPasswordResetEmail,
  fetchIssueMailCurrentAccount,
  type IssueMailCurrentAccount,
  type IssueMailUserListItem,
  type IssueMailUserListResult,
  issueStaffInvite,
  requestIssueMailUsers,
} from './api';

type IssueFeedback = {
  detail: string;
  message: string;
  title: string;
  type: 'staff-invite' | 'welcome-back';
} | null;

function resolveResultMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '暂无';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    year: 'numeric',
  });
}

function buildTeacherLabel(teacher: StaffDirectoryEntry) {
  return `${teacher.name} (${teacher.staffId})`;
}

type TeacherSearchOption = {
  key: string;
  label: string;
  name: string;
  staffId: string;
  value: string;
};

function getUserDisplayName(user: IssueMailUserListItem) {
  return (
    user.userInfo.nickname ||
    user.staff?.name ||
    user.account.loginName ||
    `账号 ${user.account.id}`
  );
}

function getUserIdentityTags(user: IssueMailUserListItem) {
  return user.userInfo.accessGroup.filter((group) => group === 'ADMIN' || group === 'STAFF');
}

function renderOptionalText(value: string | null | undefined) {
  return value ? value : <span className="text-text-quaternary">—</span>;
}

function getStatusTagColor(status: string) {
  if (status === 'ACTIVE') {
    return 'green';
  }

  if (status === 'PENDING') {
    return 'gold';
  }

  if (status === 'SUSPENDED' || status === 'INACTIVE') {
    return 'orange';
  }

  if (status === 'BANNED' || status === 'DELETED') {
    return 'red';
  }

  return 'blue';
}

function StaffInvitePanel({ onFeedback }: { onFeedback: (feedback: IssueFeedback) => void }) {
  const [account, setAccount] = useState<IssueMailCurrentAccount | null>(null);
  const { clear, keepAliveFailure, login, persistSessionFromResult, session } = useUpstreamSession({
    account,
    keepAlive: true,
  });
  const [form] = Form.useForm<{ invitedEmail: string; staffId: string; staffName: string }>();
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const [directory, setDirectory] = useState<StaffDirectoryResult | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(true);
  const [isRefreshingDirectory, setIsRefreshingDirectory] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [requiresUpstreamSession, setRequiresUpstreamSession] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);

  const selectedTeacher = useMemo(
    () => directory?.teachers.find((teacher) => teacher.staffId === selectedStaffId) ?? null,
    [directory?.teachers, selectedStaffId],
  );

  const staffIdOptions = useMemo<TeacherSearchOption[]>(
    () =>
      (directory?.teachers ?? []).map((teacher) => ({
        key: teacher.staffId,
        label: buildTeacherLabel(teacher),
        name: teacher.name,
        staffId: teacher.staffId,
        value: teacher.staffId,
      })),
    [directory?.teachers],
  );

  const staffNameOptions = useMemo<TeacherSearchOption[]>(
    () =>
      (directory?.teachers ?? []).map((teacher) => ({
        key: teacher.staffId,
        label: buildTeacherLabel(teacher),
        name: teacher.name,
        staffId: teacher.staffId,
        value: teacher.name,
      })),
    [directory?.teachers],
  );

  const selectTeacher = useCallback(
    (teacher: StaffDirectoryEntry) => {
      setSelectedStaffId(teacher.staffId);
      form.setFieldsValue({
        staffId: teacher.staffId,
        staffName: teacher.name,
      });
    },
    [form],
  );

  const filterTeacherOption = useCallback((inputValue: string, option?: TeacherSearchOption) => {
    const keyword = inputValue.trim().toLowerCase();

    if (!keyword || !option) {
      return true;
    }

    return (
      option.staffId.toLowerCase().includes(keyword) ||
      option.name.toLowerCase().includes(keyword) ||
      option.label.toLowerCase().includes(keyword)
    );
  }, []);

  const refreshDirectory = useCallback(
    async (
      sessionToken: string,
      options: { forceRefresh?: boolean; sourceSession?: StoredUpstreamSession } = {},
    ) => {
      setIsRefreshingDirectory(true);
      setDirectoryError(null);
      setRequiresUpstreamSession(false);

      try {
        const result = await populateStaffDirectory({
          forceRefresh: options.forceRefresh,
          sessionToken,
        });

        const sourceSession = options.sourceSession ?? session;

        if (sourceSession) {
          persistSessionFromResult(sourceSession, result);
        }

        setDirectory(result);
      } catch (error) {
        if (isExpiredUpstreamSessionError(error)) {
          clear();
          setRequiresUpstreamSession(true);
          setIsLoginOpen(true);
          loginForm.setFieldsValue({
            password: '',
            userId: options.sourceSession?.upstreamLoginId ?? session?.upstreamLoginId ?? '',
          });
        }

        setDirectoryError(resolveUpstreamErrorMessage(error, '暂时无法刷新教师字典。'));
      } finally {
        setIsRefreshingDirectory(false);
      }
    },
    [clear, loginForm, persistSessionFromResult, session],
  );

  const loadDirectory = useCallback(async () => {
    setIsLoadingDirectory(true);
    setDirectoryError(null);

    try {
      const currentDirectory = await readStaffDirectory();

      setDirectory(currentDirectory);

      if (currentDirectory.cacheStatus !== 'MISS') {
        setRequiresUpstreamSession(false);
        return;
      }

      if (!session?.upstreamSessionToken) {
        setRequiresUpstreamSession(true);
        return;
      }

      await refreshDirectory(session.upstreamSessionToken);
    } catch (error) {
      setDirectoryError(resolveResultMessage(error, '暂时无法读取教师字典。'));
    } finally {
      setIsLoadingDirectory(false);
    }
  }, [refreshDirectory, session?.upstreamSessionToken]);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentAccount() {
      try {
        const nextAccount = await fetchIssueMailCurrentAccount();

        if (!cancelled) {
          setAccount(nextAccount);
          setAccountError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setAccountError(resolveResultMessage(error, '暂时无法读取当前账号。'));
        }
      }
    }

    void loadCurrentAccount();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  useEffect(() => {
    if (!keepAliveFailure) {
      return;
    }

    setRequiresUpstreamSession(true);
    setDirectoryError(keepAliveFailure.message);
    setIsLoginOpen(true);
    loginForm.setFieldsValue({
      password: '',
      userId: keepAliveFailure.upstreamLoginId ?? '',
    });
  }, [keepAliveFailure, loginForm]);

  const openUpstreamLogin = useCallback(() => {
    setLoginError(null);
    setIsLoginOpen(true);
    loginForm.setFieldsValue({
      password: '',
      userId: session?.upstreamLoginId ?? '',
    });
  }, [loginForm, session?.upstreamLoginId]);

  return (
    <div>
      <Card title="发送教职工邀请">
        <Flex vertical gap={16}>
          {directoryError ? <Alert showIcon type="error" title={directoryError} /> : null}
          {accountError ? <Alert showIcon type="warning" title={accountError} /> : null}
          {requiresUpstreamSession ? (
            <Alert
              showIcon
              type="warning"
              title="需要先登录校园网"
              description="当前没有可用教师字典缓存。登录成功后会继续拉取教师字典。"
              action={
                <Button size="small" type="primary" onClick={openUpstreamLogin}>
                  登录校园网
                </Button>
              }
            />
          ) : null}

          {directory ? (
            <Alert
              showIcon
              type={directory.cacheStatus === 'FRESH' ? 'success' : 'warning'}
              title={`教师字典：${directory.cacheStatus}`}
              description={`共 ${directory.teacherCount} 位教师，更新时间 ${formatDateTime(
                directory.fetchedAt,
              )}`}
            />
          ) : null}

          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            size="large"
            onFinish={async (values) => {
              setIsIssuing(true);
              onFeedback(null);

              try {
                const result = await issueStaffInvite({
                  invitedEmail: values.invitedEmail.trim(),
                  staffId: values.staffId.trim(),
                });

                onFeedback({
                  detail: `${selectedTeacher ? buildTeacherLabel(selectedTeacher) : values.staffId} -> ${
                    values.invitedEmail
                  }`,
                  message: result.message || '教职工邀请已签发。',
                  title: '教职工邀请已发送',
                  type: 'staff-invite',
                });
              } catch (error) {
                onFeedback({
                  detail: values.invitedEmail,
                  message: resolveResultMessage(error, '暂时无法发送教职工邀请。'),
                  title: '发送失败',
                  type: 'staff-invite',
                });
              } finally {
                setIsIssuing(false);
              }
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Form.Item
                label="教师 ID"
                name="staffId"
                rules={[
                  { required: true, message: '请选择教师。' },
                  {
                    validator: async (_, value: string | undefined) => {
                      if (selectedTeacher?.staffId === value?.trim()) {
                        return;
                      }

                      throw new Error('请从教师字典选择教师。');
                    },
                  },
                ]}
              >
                <AutoComplete
                  allowClear
                  aria-label="教师 ID"
                  filterOption={(inputValue, option) =>
                    filterTeacherOption(inputValue, option as TeacherSearchOption | undefined)
                  }
                  notFoundContent={isLoadingDirectory ? '正在加载教师字典' : '暂无教师'}
                  options={staffIdOptions}
                  placeholder="输入教师 ID 或姓名搜索"
                  onChange={(value) => {
                    const nextTeacher = directory?.teachers.find(
                      (teacher) => teacher.staffId === value.trim(),
                    );

                    if (nextTeacher) {
                      selectTeacher(nextTeacher);
                      return;
                    }

                    setSelectedStaffId(null);
                    form.setFieldsValue({
                      staffId: value,
                      staffName: '',
                    });
                  }}
                  onSelect={(_, option) => {
                    const nextOption = option as TeacherSearchOption;

                    selectTeacher({
                      name: nextOption.name,
                      staffId: nextOption.staffId,
                    });
                  }}
                />
              </Form.Item>

              <Form.Item
                label="教师姓名"
                name="staffName"
                rules={[
                  { required: true, message: '请选择教师。' },
                  {
                    validator: async (_, value: string | undefined) => {
                      if (selectedTeacher?.name === value?.trim()) {
                        return;
                      }

                      throw new Error('请从教师字典选择教师。');
                    },
                  },
                ]}
              >
                <AutoComplete
                  allowClear
                  aria-label="教师姓名"
                  filterOption={(inputValue, option) =>
                    filterTeacherOption(inputValue, option as TeacherSearchOption | undefined)
                  }
                  notFoundContent={isLoadingDirectory ? '正在加载教师字典' : '暂无教师'}
                  options={staffNameOptions}
                  placeholder="输入教师姓名或 ID 搜索"
                  onChange={(value) => {
                    const nextTeacher = directory?.teachers.find(
                      (teacher) => teacher.name === value.trim(),
                    );

                    if (nextTeacher) {
                      selectTeacher(nextTeacher);
                      return;
                    }

                    setSelectedStaffId(null);
                    form.setFieldsValue({
                      staffId: '',
                      staffName: value,
                    });
                  }}
                  onSelect={(_, option) => {
                    const nextOption = option as TeacherSearchOption;

                    selectTeacher({
                      name: nextOption.name,
                      staffId: nextOption.staffId,
                    });
                  }}
                />
              </Form.Item>
            </div>

            <Form.Item
              label="被邀请邮箱"
              name="invitedEmail"
              rules={[
                { required: true, message: '请输入被邀请邮箱。' },
                { type: 'email', message: '请输入有效邮箱地址。' },
              ]}
            >
              <Input autoComplete="email" placeholder="name@example.com" />
            </Form.Item>

            <Flex justify="space-between" gap={12} wrap>
              <Button
                loading={isRefreshingDirectory}
                onClick={() => {
                  if (session?.upstreamSessionToken) {
                    void refreshDirectory(session.upstreamSessionToken, { forceRefresh: true });
                    return;
                  }

                  setRequiresUpstreamSession(true);
                  openUpstreamLogin();
                }}
              >
                刷新教师字典
              </Button>
              <Button htmlType="submit" loading={isIssuing} type="primary">
                发送教职工邀请
              </Button>
            </Flex>
          </Form>
        </Flex>
      </Card>

      <UpstreamLoginModal
        form={loginForm}
        isSubmitting={isSubmittingLogin}
        loginError={loginError}
        okText="登录并拉取教师字典"
        open={isLoginOpen}
        title="登录校园网"
        onCancel={() => setIsLoginOpen(false)}
        onFinish={async (values) => {
          setIsSubmittingLogin(true);
          setLoginError(null);

          try {
            const nextSession = await login(values);

            setIsLoginOpen(false);
            setRequiresUpstreamSession(false);
            await refreshDirectory(nextSession.upstreamSessionToken, {
              sourceSession: nextSession,
            });
          } catch (error) {
            setLoginError(resolveUpstreamErrorMessage(error, '暂时无法登录校园网。'));
          } finally {
            setIsSubmittingLogin(false);
          }
        }}
      />
    </div>
  );
}

function WelcomeBackPanel({ onFeedback }: { onFeedback: (feedback: IssueFeedback) => void }) {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [result, setResult] = useState<IssueMailUserListResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<readonly number[]>([]);
  const [isSending, setIsSending] = useState(false);
  const totalCount = result?.total ?? 0;
  const currentPage = result?.current ?? page;
  const currentList = useMemo(() => result?.list ?? [], [result]);
  const selectedRecords = useMemo(
    () => currentList.filter((item) => selectedAccountIds.includes(item.account.id)),
    [currentList, selectedAccountIds],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextResult = await requestIssueMailUsers({
          limit: pageSize,
          page,
          query: submittedQuery,
        });

        if (!cancelled) {
          setResult(nextResult);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(resolveResultMessage(error, '暂时无法加载已有用户列表。'));
          setResult(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, submittedQuery]);

  useEffect(() => {
    const availableIds = new Set(currentList.map((item) => item.account.id));

    setSelectedAccountIds((currentSelectedAccountIds) =>
      currentSelectedAccountIds.filter((accountId) => availableIds.has(accountId)),
    );
  }, [currentList]);

  const sendWelcomeBackEmails = useCallback(async () => {
    if (selectedRecords.length === 0) {
      return;
    }

    setIsSending(true);
    onFeedback(null);

    const failures: string[] = [];

    try {
      for (const record of selectedRecords) {
        try {
          await adminRequestPasswordResetEmail({
            accountId: record.account.id,
          });
        } catch (error) {
          failures.push(
            `${getUserDisplayName(record)} (${record.account.id})：${resolveResultMessage(
              error,
              '发送失败',
            )}`,
          );
        }
      }

      if (failures.length > 0) {
        onFeedback({
          detail: failures.join('；'),
          message: `已完成 ${selectedRecords.length - failures.length} 封，失败 ${failures.length} 封。`,
          title: '部分发送失败',
          type: 'welcome-back',
        });
        return;
      }

      onFeedback({
        detail: selectedRecords
          .map((record) => `${getUserDisplayName(record)} (${record.account.id})`)
          .join('、'),
        message:
          selectedRecords.length === 1
            ? '老用户回归改密邮件已发送。'
            : `已发送 ${selectedRecords.length} 封老用户回归改密邮件。`,
        title: '回归改密邮件已发送',
        type: 'welcome-back',
      });
      setSelectedAccountIds([]);
    } finally {
      setIsSending(false);
    }
  }, [onFeedback, selectedRecords]);

  const columns = useMemo(
    () => [
      {
        dataIndex: ['account', 'id'],
        key: 'id',
        render: (value: number) => <span className="font-mono text-sm">#{value}</span>,
        title: '账号 ID',
        width: 110,
      },
      {
        dataIndex: ['account', 'loginEmail'],
        key: 'loginEmail',
        render: (value: string | null) => (
          <Typography.Text copyable={Boolean(value)}>{renderOptionalText(value)}</Typography.Text>
        ),
        title: '登陆邮箱',
        width: 240,
      },
      {
        dataIndex: ['userInfo', 'nickname'],
        key: 'nickname',
        render: (value: string | null) => (
          <span className="font-medium">{renderOptionalText(value)}</span>
        ),
        title: 'nickname',
        width: 180,
      },
      {
        dataIndex: ['account', 'loginName'],
        key: 'loginName',
        render: (value: string | null) => (
          <span className="font-mono text-sm text-text-secondary">{renderOptionalText(value)}</span>
        ),
        title: 'loginName',
        width: 180,
      },
      {
        dataIndex: ['userInfo', 'accessGroup'],
        key: 'accessGroup',
        render: (_value: readonly string[], record: IssueMailUserListItem) => (
          <Space wrap size={4}>
            {getUserIdentityTags(record).map((group) => (
              <Tag key={group} color={group === 'ADMIN' ? 'purple' : 'blue'} style={{ margin: 0 }}>
                {group}
              </Tag>
            ))}
          </Space>
        ),
        title: '访问组',
        width: 160,
      },
      {
        dataIndex: ['account', 'status'],
        key: 'status',
        render: (value: string) => (
          <Tag color={getStatusTagColor(value)} style={{ margin: 0 }}>
            {value}
          </Tag>
        ),
        title: '状态',
        width: 120,
      },
    ],
    [],
  );

  const rowSelection = useMemo(
    () => ({
      selectedRowKeys: [...selectedAccountIds],
      onChange: (nextSelectedRowKeys: Key[]) => {
        setSelectedAccountIds(nextSelectedRowKeys.map((key) => Number(key)));
      },
    }),
    [selectedAccountIds],
  );

  return (
    <Flex vertical gap={16}>
      <Flex gap={12} justify="space-between" wrap>
        <Input.Search
          allowClear
          enterButton="搜索"
          placeholder="搜索登陆邮箱、nickname、loginName 或账号 ID"
          style={{ maxWidth: 420 }}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onSearch={(value) => {
            setSubmittedQuery(value.trim());
            setPage(1);
          }}
        />
        <Space wrap>
          <Typography.Text type="secondary">
            已选择 {selectedRecords.length} / 共 {totalCount} 位 ADMIN / STAFF 用户
          </Typography.Text>
          <Button
            type="primary"
            disabled={selectedRecords.length === 0}
            loading={isSending}
            onClick={sendWelcomeBackEmails}
          >
            发送回归改密邮件
          </Button>
        </Space>
      </Flex>

      {errorMessage ? <Alert showIcon type="error" title={errorMessage} /> : null}

      <div className="issue-mail-user-table">
        <Table<IssueMailUserListItem>
          rowKey={(record) => record.account.id}
          columns={columns}
          dataSource={[...currentList]}
          loading={isLoading}
          rowSelection={rowSelection}
          scroll={{ x: 980 }}
          pagination={{
            current: currentPage,
            className: 'px-4 py-3 m-0',
            pageSize,
            placement: ['bottomCenter'],
            pageSizeOptions: [10, 20, 50, 100],
            showSizeChanger: true,
            size: 'small',
            total: totalCount,
          }}
          locale={{
            emptyText: (
              <Empty description="暂无 ADMIN / STAFF 用户" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ),
          }}
          onChange={(pagination) => {
            setSelectedAccountIds([]);
            const nextPageSize = pagination.pageSize ?? pageSize;

            if (nextPageSize !== pageSize) {
              setPageSize(nextPageSize);
              setPage(1);
              return;
            }

            setPage(pagination.current ?? 1);
          }}
        />
      </div>

      <style>{`
        .issue-mail-user-table .ant-table-thead > tr > th {
          background: transparent;
          color: var(--ant-color-text-secondary);
          font-size: var(--ant-font-size-sm);
          font-weight: 600;
          padding: 12px 16px;
        }

        .issue-mail-user-table .ant-table-tbody > tr > td {
          padding: 12px 16px;
        }

        .issue-mail-user-table .ant-table-row:hover > td {
          background-color: var(--ant-color-fill-tertiary) !important;
        }
      `}</style>
    </Flex>
  );
}

export function IssueMailLabPage() {
  const [activeTab, setActiveTab] = useState('staff');
  const [feedback, setFeedback] = useState<IssueFeedback>(null);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <Flex vertical gap={12}>
          <div>
            <Typography.Title level={3} style={{ marginBottom: 8 }}>
              认证码签发
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              面向管理员的签发与发信工作台。当前覆盖教职工邀请和老用户回归改密邮件。
            </Typography.Paragraph>
          </div>
          <div className="flex flex-wrap gap-2">
            <Tag color="blue">负责人：frontend</Tag>
            <Tag color="green">环境：{inviteIssuerLabAccess.env.join(', ')}</Tag>
            <Tag color="gold">访问级别：{inviteIssuerLabAccess.allowedAccessLevels.join(', ')}</Tag>
          </div>
        </Flex>
      </Card>

      {feedback ? (
        <Alert
          showIcon
          type={feedback.title.includes('失败') ? 'error' : 'success'}
          title={feedback.title}
          description={
            <Space orientation="vertical" size={2}>
              <span>{feedback.message}</span>
              <span>{feedback.detail}</span>
            </Space>
          }
        />
      ) : null}

      <Card
        tabList={[
          { key: 'staff', tab: '教职工邀请' },
          { key: 'welcome-back', tab: '老用户回归' },
        ]}
        activeTabKey={activeTab}
        onTabChange={(key) => {
          setActiveTab(key);
          setFeedback(null);
        }}
      >
        {activeTab === 'staff' ? (
          <StaffInvitePanel onFeedback={setFeedback} />
        ) : (
          <WelcomeBackPanel onFeedback={setFeedback} />
        )}
      </Card>
    </div>
  );
}
