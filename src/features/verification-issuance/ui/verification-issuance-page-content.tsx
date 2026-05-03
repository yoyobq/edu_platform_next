import { type Key, useEffect, useMemo, useState } from 'react';
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

import type { AdminUserListItem } from '@/entities/admin-user';
import { type UpstreamLoginFormValues, UpstreamLoginModal } from '@/entities/upstream-session';

import {
  type StaffInviteFormValues,
  type TeacherSearchOption,
  useStaffInviteFlow,
} from '../application/use-staff-invite-flow';
import {
  getWelcomeBackUserIdentityTags,
  useWelcomeBackIssuance,
} from '../application/use-welcome-back-issuance';
import type { VerificationIssuanceFeedback } from '../application/verification-issuance-feedback';

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

function StaffInvitePanel({
  onFeedback,
}: {
  onFeedback: (feedback: VerificationIssuanceFeedback) => void;
}) {
  const [form] = Form.useForm<StaffInviteFormValues>();
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const staffInviteFlow = useStaffInviteFlow({
    onFeedback,
  });
  const {
    accountError,
    directory,
    directoryError,
    filterTeacherOption,
    isIssuing,
    isLoadingDirectory,
    isLoginOpen,
    isRefreshingDirectory,
    isSubmittingLogin,
    loginError,
    openUpstreamLogin,
    refreshDirectoryFromAction,
    requiresUpstreamSession,
    resolveTeacherByStaffIdValue,
    resolveTeacherByStaffNameValue,
    selectTeacherOption,
    selectedTeacher,
    setIsLoginOpen,
    staffIdOptions,
    staffInviteError,
    staffNameOptions,
    suggestedUpstreamLoginId,
    submitUpstreamLogin,
    issueStaffInvite,
  } = staffInviteFlow;

  function applySelectedTeacher(teacher: { name: string; staffId: string }) {
    form.setFieldsValue({
      staffId: teacher.staffId,
      staffName: teacher.name,
    });
  }

  function handleStaffIdChange(value: string) {
    const nextTeacher = resolveTeacherByStaffIdValue(value);

    if (nextTeacher) {
      applySelectedTeacher(nextTeacher);
      return;
    }

    form.setFieldsValue({
      staffId: value,
      staffName: '',
    });
  }

  function handleStaffNameChange(value: string) {
    const nextTeacher = resolveTeacherByStaffNameValue(value);

    if (nextTeacher) {
      applySelectedTeacher(nextTeacher);
      return;
    }

    form.setFieldsValue({
      staffId: '',
      staffName: value,
    });
  }

  function handleTeacherOptionSelect(option: TeacherSearchOption) {
    applySelectedTeacher(selectTeacherOption(option));
  }

  useEffect(() => {
    if (!isLoginOpen) {
      return;
    }

    loginForm.setFieldsValue({
      password: '',
      userId: suggestedUpstreamLoginId,
    });
  }, [isLoginOpen, loginForm, suggestedUpstreamLoginId]);

  return (
    <div>
      <Card title="发送教职工邀请">
        <Flex vertical gap={16}>
          {directoryError ? <Alert showIcon type="error" title={directoryError} /> : null}
          {staffInviteError ? <Alert showIcon type="error" title={staffInviteError} /> : null}
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
            onFinish={issueStaffInvite}
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
                  onChange={handleStaffIdChange}
                  onSelect={(_, option) => {
                    handleTeacherOptionSelect(option as TeacherSearchOption);
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
                  onChange={handleStaffNameChange}
                  onSelect={(_, option) => {
                    handleTeacherOptionSelect(option as TeacherSearchOption);
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
              <Button loading={isRefreshingDirectory} onClick={refreshDirectoryFromAction}>
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
        onFinish={submitUpstreamLogin}
      />
    </div>
  );
}

function WelcomeBackPanel({
  onFeedback,
}: {
  onFeedback: (feedback: VerificationIssuanceFeedback) => void;
}) {
  const welcomeBackIssuance = useWelcomeBackIssuance({ onFeedback });
  const {
    changePage,
    currentList,
    currentPage,
    errorMessage,
    isLoading,
    isSending,
    pageSize,
    query,
    searchUsers,
    selectAccountIds,
    selectedAccountIds,
    selectedRecords,
    sendWelcomeBackEmails,
    setQuery,
    totalCount,
  } = welcomeBackIssuance;

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
        render: (_value: readonly string[], record: AdminUserListItem) => (
          <Space wrap size={4}>
            {getWelcomeBackUserIdentityTags(record).map((group) => (
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
        selectAccountIds(nextSelectedRowKeys);
      },
    }),
    [selectAccountIds, selectedAccountIds],
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
          onSearch={searchUsers}
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

      <div className="verification-issuance-user-table">
        <Table<AdminUserListItem>
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
            changePage(pagination.current ?? 1, pagination.pageSize ?? pageSize);
          }}
        />
      </div>

      <style>{`
        .verification-issuance-user-table .ant-table-thead > tr > th {
          background: transparent;
          color: var(--ant-color-text-secondary);
          font-size: var(--ant-font-size-sm);
          font-weight: 600;
          padding: 12px 16px;
        }

        .verification-issuance-user-table .ant-table-tbody > tr > td {
          padding: 12px 16px;
        }

        .verification-issuance-user-table .ant-table-row:hover > td {
          background-color: var(--ant-color-fill-tertiary) !important;
        }
      `}</style>
    </Flex>
  );
}

export function VerificationIssuancePageContent() {
  const [activeTab, setActiveTab] = useState('staff');
  const [feedback, setFeedback] = useState<VerificationIssuanceFeedback>(null);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <Flex vertical gap={12}>
          <div>
            <Typography.Title level={3} style={{ marginBottom: 8 }}>
              认证码签发
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              为教职工邀请和老用户回归签发验证邮件。
            </Typography.Paragraph>
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
