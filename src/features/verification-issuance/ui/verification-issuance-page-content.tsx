import { type ReactNode, useEffect, useState } from 'react';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Modal,
  Space,
  Typography,
} from 'antd';

import {
  buildUpstreamLoginCredentialsInitialValues,
  canUseRememberedUpstreamLoginCredentials,
  type UpstreamLoginFormValues,
  UpstreamLoginModal,
} from '@/entities/upstream-session';

import {
  type ChangeLoginEmailIssuanceFormValues,
  getAdminUserDisplayName,
  useChangeLoginEmailIssuance,
} from '../application/use-change-login-email-issuance';
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

import { VerificationAccountPickerTable } from './verification-account-picker-table';

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

function StaffInvitePanel({
  lockedUpstreamLoginUserId,
  lockedUpstreamLoginUserIdHelp,
  onFeedback,
}: {
  lockedUpstreamLoginUserId?: string | null;
  lockedUpstreamLoginUserIdHelp?: ReactNode;
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
    clearRememberedCredentials,
    openUpstreamLogin,
    refreshDirectoryFromAction,
    requiresUpstreamSession,
    rememberedCredentials,
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
  const canUseRememberedCredentials = canUseRememberedUpstreamLoginCredentials({
    lockedUserId: lockedUpstreamLoginUserId,
    rememberedCredentials,
  });

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

    loginForm.setFieldsValue(
      buildUpstreamLoginCredentialsInitialValues({
        fallbackUserId: suggestedUpstreamLoginId,
        lockedUserId: lockedUpstreamLoginUserId,
        rememberedCredentials,
      }),
    );
  }, [
    isLoginOpen,
    lockedUpstreamLoginUserId,
    loginForm,
    rememberedCredentials,
    suggestedUpstreamLoginId,
  ]);

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
        hasRememberedCredentials={canUseRememberedCredentials}
        isSubmitting={isSubmittingLogin}
        loginError={loginError}
        lockedUserId={lockedUpstreamLoginUserId}
        lockedUserIdHelp={lockedUpstreamLoginUserIdHelp}
        okText="登录并拉取教师字典"
        open={isLoginOpen}
        title="登录校园网"
        onClearRememberedCredentials={clearRememberedCredentials}
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

  return (
    <VerificationAccountPickerTable
      action={
        <Button
          disabled={selectedRecords.length === 0}
          loading={isSending}
          type="primary"
          onClick={sendWelcomeBackEmails}
        >
          发送回归改密邮件
        </Button>
      }
      currentList={currentList}
      currentPage={currentPage}
      emptyDescription="暂无 ADMIN / STAFF 用户"
      errorMessage={errorMessage}
      getIdentityTags={getWelcomeBackUserIdentityTags}
      isLoading={isLoading}
      pageSize={pageSize}
      query={query}
      searchPlaceholder="搜索登陆邮箱、nickname、loginName 或账号 ID"
      selectedAccountIds={selectedAccountIds}
      selectedSummary={`已选择 ${selectedRecords.length} / 共 ${totalCount} 位 ADMIN / STAFF 用户`}
      selectionMode="multiple"
      totalCount={totalCount}
      onPageChange={changePage}
      onQueryChange={setQuery}
      onSearch={searchUsers}
      onSelectionChange={selectAccountIds}
    />
  );
}

function ChangeLoginEmailPanel({
  onFeedback,
}: {
  onFeedback: (feedback: VerificationIssuanceFeedback) => void;
}) {
  const [form] = Form.useForm<ChangeLoginEmailIssuanceFormValues>();
  const changeLoginEmailIssuance = useChangeLoginEmailIssuance({ onFeedback });
  const {
    changePage,
    closeModal,
    currentList,
    currentPage,
    errorMessage,
    isLoading,
    isModalOpen,
    isSending,
    openModal,
    pageSize,
    query,
    searchUsers,
    selectAccountIds,
    selectedAccountIds,
    selectedRecord,
    sendChangeLoginEmail,
    setQuery,
    submitError,
    totalCount,
  } = changeLoginEmailIssuance;

  function handleCloseModal() {
    closeModal();
    form.resetFields();
  }

  async function handleSubmit(values: ChangeLoginEmailIssuanceFormValues) {
    const isSuccess = await sendChangeLoginEmail(values);

    if (isSuccess) {
      form.resetFields();
    }
  }

  return (
    <>
      <VerificationAccountPickerTable
        action={
          <Button disabled={!selectedRecord} loading={isSending} type="primary" onClick={openModal}>
            发送邮箱变更验证
          </Button>
        }
        currentList={currentList}
        currentPage={currentPage}
        emptyDescription="暂无用户"
        errorMessage={errorMessage}
        isLoading={isLoading}
        pageSize={pageSize}
        query={query}
        searchPlaceholder="搜索登陆邮箱、nickname、loginName 或账号 ID"
        selectedAccountIds={selectedAccountIds}
        selectionMode="single"
        totalCount={totalCount}
        onPageChange={changePage}
        onQueryChange={setQuery}
        onSearch={searchUsers}
        onSelectionChange={selectAccountIds}
      />

      <Modal
        destroyOnHidden
        footer={null}
        open={isModalOpen}
        title="发送登录邮箱变更验证"
        onCancel={handleCloseModal}
      >
        <Flex vertical gap={16}>
          {selectedRecord ? (
            <Alert
              showIcon
              type="info"
              title={getAdminUserDisplayName(selectedRecord)}
              description={
                <Space orientation="vertical" size={2}>
                  <span>账号 ID：{selectedRecord.account.id}</span>
                  <span>当前登陆邮箱：{selectedRecord.account.loginEmail || '暂无'}</span>
                  <span>loginName：{selectedRecord.account.loginName || '暂无'}</span>
                </Space>
              }
            />
          ) : null}

          {submitError ? <Alert showIcon type="error" title={submitError} /> : null}

          <Form form={form} layout="vertical" requiredMark={false} onFinish={handleSubmit}>
            <Form.Item
              label="新的登录邮箱"
              name="newLoginEmail"
              rules={[
                { required: true, message: '请输入新的登录邮箱。' },
                { type: 'email', message: '请输入有效邮箱地址。' },
              ]}
            >
              <Input autoComplete="email" placeholder="new-email@example.com" />
            </Form.Item>

            <Flex justify="flex-end" gap={8}>
              <Button onClick={handleCloseModal}>取消</Button>
              <Button htmlType="submit" loading={isSending} type="primary">
                发送验证邮件
              </Button>
            </Flex>
          </Form>
        </Flex>
      </Modal>
    </>
  );
}

export function VerificationIssuancePageContent({
  lockedUpstreamLoginUserId = null,
  lockedUpstreamLoginUserIdHelp,
}: {
  lockedUpstreamLoginUserId?: string | null;
  lockedUpstreamLoginUserIdHelp?: ReactNode;
}) {
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
              为教职工邀请、老用户回归和登录邮箱变更签发验证邮件。
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
          { key: 'change-login-email', tab: '登录邮箱变更' },
        ]}
        activeTabKey={activeTab}
        onTabChange={(key) => {
          setActiveTab(key);
          setFeedback(null);
        }}
      >
        {activeTab === 'staff' ? (
          <StaffInvitePanel
            lockedUpstreamLoginUserId={lockedUpstreamLoginUserId}
            lockedUpstreamLoginUserIdHelp={lockedUpstreamLoginUserIdHelp}
            onFeedback={setFeedback}
          />
        ) : activeTab === 'welcome-back' ? (
          <WelcomeBackPanel onFeedback={setFeedback} />
        ) : (
          <ChangeLoginEmailPanel onFeedback={setFeedback} />
        )}
      </Card>
    </div>
  );
}
