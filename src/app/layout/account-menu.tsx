import { type CSSProperties, useMemo, useState } from 'react';
import {
  LogoutOutlined,
  MoonOutlined,
  PlusOutlined,
  RightOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Dropdown,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Popover,
  Segmented,
  Tooltip,
} from 'antd';
import { useNavigate } from 'react-router';

import { FONT_SCALE_OPTIONS, type FontScale } from '@/app/providers';

import { type AuthSessionSnapshot, logout } from '@/features/auth';

import {
  type AccountSwitchLabSession,
  createAccountSwitchLabSession,
} from '@/shared/account-switch/api';
import {
  type AccountSwitchLabRecord,
  readAccountSwitchLabRecords,
  upsertAccountSwitchLabRecord,
  writeAccountSwitchLabRecords,
  writeCurrentAuthSession,
} from '@/shared/account-switch/storage';
import { getGraphQLClient } from '@/shared/graphql';
import { HexAvatar } from '@/shared/hex-avatar';

const ACCOUNT_SWITCH_LIMIT = 2;

type AccountMenuProps = {
  activeSnapshot: AuthSessionSnapshot;
  controlSize: number;
  fontScale: FontScale;
  isDark: boolean;
  isSessionResolving: boolean;
  placement: 'bottomRight' | 'topLeft';
  setFontScale: (value: FontScale) => void;
  setIsDark: (updater: (value: boolean) => boolean) => void;
  trigger: 'rail' | 'sidebar' | 'top';
};

function formatAccessGroupLabel(value: string) {
  const normalizedValue = value.toLowerCase();

  return normalizedValue.charAt(0).toUpperCase() + normalizedValue.slice(1);
}

function getAccountDisplayName(session: AccountSwitchLabSession) {
  return session.userInfo.nickname || session.displayName || `#${session.accountId}`;
}

function getAccountLoginEmail(session: AccountSwitchLabSession) {
  return session.account.loginEmail || session.userInfo.email || '未设置邮箱';
}

function buildAccountSessions(
  activeSnapshot: AuthSessionSnapshot,
  records: readonly AccountSwitchLabRecord[],
) {
  const sessions: AccountSwitchLabSession[] = [];
  const seenAccountIds = new Set<number>();

  sessions.push(activeSnapshot);
  seenAccountIds.add(activeSnapshot.accountId);

  for (const record of records) {
    if (seenAccountIds.has(record.session.accountId)) {
      continue;
    }

    sessions.push(record.session);
    seenAccountIds.add(record.session.accountId);
  }

  return sessions;
}

export function AccountMenu({
  activeSnapshot,
  controlSize,
  fontScale,
  isDark,
  isSessionResolving,
  placement,
  setFontScale,
  setIsDark,
  trigger,
}: AccountMenuProps) {
  const navigate = useNavigate();
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);
  const [addAccountForm] = Form.useForm<{ loginName: string; loginPassword: string }>();
  const [accountRecords, setAccountRecords] = useState<AccountSwitchLabRecord[]>(() =>
    readAccountSwitchLabRecords(),
  );
  const [addAccountSubmitting, setAddAccountSubmitting] = useState(false);
  const [addAccountError, setAddAccountError] = useState<string | null>(null);
  const [switchingAccountId, setSwitchingAccountId] = useState<number | null>(null);
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const accountSessions = useMemo(
    () => buildAccountSessions(activeSnapshot, accountRecords),
    [accountRecords, activeSnapshot],
  );
  const identityLabel = isSessionResolving
    ? '同步中'
    : formatAccessGroupLabel(activeSnapshot.primaryAccessGroup);
  const hasReachedAccountSwitchLimit = accountSessions.length >= ACCOUNT_SWITCH_LIMIT;

  function commitAccountRecords(nextRecords: AccountSwitchLabRecord[]) {
    writeAccountSwitchLabRecords(nextRecords);
    setAccountRecords(nextRecords);
  }

  function getFallbackSessionAfterLogout(session: AccountSwitchLabSession) {
    return accountSessions.find((candidate) => candidate.accountId !== session.accountId) ?? null;
  }

  async function switchToSession(session: AccountSwitchLabSession) {
    if (activeSnapshot.accountId === session.accountId) {
      return;
    }

    setSwitchingAccountId(session.accountId);

    try {
      await getGraphQLClient().clearStore();
      writeCurrentAuthSession(session);
      window.location.reload();
    } finally {
      setSwitchingAccountId(null);
    }
  }

  async function handleAddAccount() {
    if (hasReachedAccountSwitchLimit) {
      setAddAccountError('只允许最多两个用户。');
      return;
    }

    const values = await addAccountForm.validateFields();

    setAddAccountSubmitting(true);
    setAddAccountError(null);

    try {
      const session = await createAccountSwitchLabSession({
        loginName: values.loginName,
        loginPassword: values.loginPassword,
      });
      const baseRecords = upsertAccountSwitchLabRecord(accountRecords, activeSnapshot);

      if (accountSessions.some((candidate) => candidate.accountId === session.accountId)) {
        const nextRecords = upsertAccountSwitchLabRecord(baseRecords, session);

        commitAccountRecords(nextRecords);
        setAddAccountModalOpen(false);
        addAccountForm.resetFields();
        messageApi.info('这个账号已经在列表里，已顺便刷新登录状态。');
        return;
      }

      const nextRecords = upsertAccountSwitchLabRecord(baseRecords, session);

      commitAccountRecords(nextRecords);
      setAddAccountModalOpen(false);
      addAccountForm.resetFields();
      modalApi.confirm({
        title: '切换到新账号？',
        content: `已添加 ${getAccountDisplayName(session)}，现在切换过去吗？`,
        okText: '切换过去',
        cancelText: '先不切换',
        onOk: () => switchToSession(session),
      });
    } catch (error) {
      setAddAccountError(error instanceof Error ? error.message : '添加账号失败。');
    } finally {
      setAddAccountSubmitting(false);
    }
  }

  async function logoutAccount(session: AccountSwitchLabSession) {
    const nextRecords = accountRecords.filter(
      (record) => record.session.accountId !== session.accountId,
    );
    const isActiveAccount = activeSnapshot.accountId === session.accountId;
    const fallbackSession = isActiveAccount ? getFallbackSessionAfterLogout(session) : null;

    commitAccountRecords(nextRecords);

    if (isActiveAccount && fallbackSession) {
      await getGraphQLClient().clearStore();
      writeCurrentAuthSession(fallbackSession);
      window.location.reload();
      return;
    }

    if (isActiveAccount) {
      await getGraphQLClient().clearStore();
      logout();
      navigate('/login', { replace: true });
    }
  }

  function renderAccountMenuContent() {
    const surfaceStyle: CSSProperties = {
      background: 'var(--ant-color-bg-elevated)',
      borderRadius: 'var(--ant-border-radius-lg)',
      boxShadow: 'var(--ant-box-shadow-secondary)',
      minWidth: 280,
      overflow: 'hidden',
      padding: 8,
    };
    const accountListMenu = (
      <div style={surfaceStyle}>
        <div className="px-1 pb-2">
          <div className="flex flex-col gap-1">
            {accountSessions.map((session) => {
              const isActiveAccount = activeSnapshot.accountId === session.accountId;

              return (
                <button
                  key={session.accountId}
                  type="button"
                  className={
                    isActiveAccount
                      ? 'flex w-full items-center gap-3 rounded-lg bg-fill-hover px-3 py-2.5 text-left'
                      : 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-bg-layout'
                  }
                  disabled={isActiveAccount || switchingAccountId === session.accountId}
                  onClick={() => void switchToSession(session)}
                >
                  <HexAvatar
                    accountId={session.accountId}
                    avatarUrl={session.userInfo.avatarUrl}
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {getAccountDisplayName(session)}
                    </div>
                    <div className="truncate text-xs text-text-secondary">
                      {getAccountLoginEmail(session)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-1 pt-2" style={{ borderTop: '1px solid var(--ant-color-split)' }}>
          <button
            type="button"
            className={
              hasReachedAccountSwitchLimit
                ? 'flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-tertiary'
                : 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-bg-layout'
            }
            disabled={hasReachedAccountSwitchLimit}
            onClick={() => {
              if (hasReachedAccountSwitchLimit) {
                return;
              }

              setAddAccountModalOpen(true);
            }}
          >
            <PlusOutlined />
            <span className="min-w-0 flex-1 text-left">
              {hasReachedAccountSwitchLimit ? '只允许最多两个用户' : '增加另一个账号'}
            </span>
          </button>
        </div>
      </div>
    );
    const logoutAccountMenu = (
      <div style={surfaceStyle}>
        <div className="px-1 pb-2">
          <div className="flex flex-col gap-1">
            {accountSessions.map((session) => {
              const isActiveAccount = activeSnapshot.accountId === session.accountId;
              const fallbackSession = isActiveAccount
                ? getFallbackSessionAfterLogout(session)
                : null;
              const confirmTitle = isActiveAccount
                ? fallbackSession
                  ? '换到另一个账号？'
                  : '结束会话'
                : '不再保留这个账号？';
              const confirmDescription = isActiveAccount
                ? fallbackSession
                  ? `${getAccountDisplayName(session)} 会退出，随后切换到 ${getAccountDisplayName(
                      fallbackSession,
                    )}。`
                  : '且将公事付清风，他日相逢再续行'
                : `${getAccountDisplayName(session)} 会从这个列表里移除。`;

              return (
                <Popconfirm
                  key={session.accountId}
                  title={confirmTitle}
                  description={confirmDescription}
                  okText={
                    isActiveAccount && fallbackSession
                      ? '切换过去'
                      : isActiveAccount
                        ? '江湖再见'
                        : '确认'
                  }
                  cancelText={isActiveAccount && !fallbackSession ? '不累' : '取消'}
                  placement="right"
                  onConfirm={() => void logoutAccount(session)}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-bg-layout"
                  >
                    <HexAvatar
                      accountId={session.accountId}
                      avatarUrl={session.userInfo.avatarUrl}
                      size={36}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {getAccountDisplayName(session)}
                      </div>
                      <div className="truncate text-xs text-text-secondary">
                        {getAccountLoginEmail(session)}
                      </div>
                    </div>
                  </button>
                </Popconfirm>
              );
            })}
          </div>
        </div>
      </div>
    );

    return (
      <div style={surfaceStyle}>
        <div className="px-1 pb-3 pt-1">
          <Popover
            placement="rightTop"
            trigger="click"
            content={accountListMenu}
            overlayInnerStyle={{ padding: 0 }}
          >
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-bg-layout"
            >
              <HexAvatar
                accountId={activeSnapshot.accountId}
                avatarUrl={activeSnapshot.userInfo.avatarUrl}
                size={44}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{activeSnapshot.displayName}</div>
                <div className="truncate text-xs text-text-secondary">{identityLabel}</div>
              </div>
              <RightOutlined className="text-text-tertiary" style={{ fontSize: 10 }} />
            </button>
          </Popover>
        </div>

        <div className="px-1 py-2" style={{ borderTop: '1px solid var(--ant-color-split)' }}>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-bg-layout"
            onClick={() => navigate('/profile')}
          >
            <UserOutlined />
            <span className="min-w-0 flex-1 text-left">个人资料</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-bg-layout"
            onClick={() => setIsDark((value) => !value)}
          >
            {isDark ? <SunOutlined /> : <MoonOutlined />}
            <span className="min-w-0 flex-1 text-left">{isDark ? '浅色模式' : '深色模式'}</span>
          </button>
          <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm">
            <span className="text-text-secondary">字号</span>
            <Segmented
              size="small"
              value={fontScale}
              options={FONT_SCALE_OPTIONS}
              onChange={(value) => setFontScale(value as FontScale)}
            />
          </div>
        </div>

        <div className="px-1 pt-2" style={{ borderTop: '1px solid var(--ant-color-split)' }}>
          {accountSessions.length > 1 ? (
            <Popover
              placement="rightBottom"
              trigger="click"
              content={logoutAccountMenu}
              overlayInnerStyle={{ padding: 0 }}
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-bg-layout"
              >
                <LogoutOutlined />
                <span className="min-w-0 flex-1 text-left">退出账户</span>
                <RightOutlined className="text-text-tertiary" style={{ fontSize: 10 }} />
              </button>
            </Popover>
          ) : (
            <Popconfirm
              title="结束会话"
              description="且将公事付清风，他日相逢再续行"
              okText="江湖再见"
              cancelText="不累"
              placement="right"
              onConfirm={() => void logoutAccount(activeSnapshot)}
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-bg-layout"
              >
                <LogoutOutlined />
                <span className="min-w-0 flex-1 text-left">退出账户</span>
              </button>
            </Popconfirm>
          )}
        </div>
      </div>
    );
  }

  function renderTrigger() {
    if (trigger === 'top') {
      return (
        <button
          type="button"
          className="flex cursor-pointer items-center rounded-full border-2 border-transparent p-0.5 transition-all hover:border-border-secondary"
          aria-label="用户菜单"
        >
          <HexAvatar
            accountId={activeSnapshot.accountId}
            avatarUrl={activeSnapshot.userInfo.avatarUrl}
            size={32}
          />
        </button>
      );
    }

    const isSidebar = trigger === 'sidebar';

    return (
      <Tooltip title="账户菜单" placement="right">
        <button
          type="button"
          className={
            isSidebar
              ? 'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-bg-layout'
              : 'mx-auto flex items-center justify-center rounded-lg transition-colors hover:bg-bg-layout'
          }
          style={
            isSidebar
              ? undefined
              : {
                  height: controlSize,
                  width: controlSize,
                }
          }
          aria-label="用户菜单"
        >
          <HexAvatar
            accountId={activeSnapshot.accountId}
            avatarUrl={activeSnapshot.userInfo.avatarUrl}
            size={isSidebar ? 28 : 24}
          />
          {isSidebar ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{activeSnapshot.displayName}</div>
              <div className="truncate text-xs text-text-secondary">{identityLabel}</div>
            </div>
          ) : null}
        </button>
      </Tooltip>
    );
  }

  return (
    <>
      {messageContextHolder}
      {modalContextHolder}
      <Dropdown placement={placement} trigger={['click']} popupRender={renderAccountMenuContent}>
        {renderTrigger()}
      </Dropdown>
      <Modal
        title="增加另一个账号"
        open={addAccountModalOpen}
        okText="添加账号"
        cancelText="取消"
        confirmLoading={addAccountSubmitting}
        okButtonProps={{ disabled: hasReachedAccountSwitchLimit }}
        onCancel={() => {
          setAddAccountModalOpen(false);
          setAddAccountError(null);
          addAccountForm.resetFields();
        }}
        onOk={() => void handleAddAccount()}
      >
        {addAccountError ? (
          <Alert
            type="error"
            showIcon
            message={addAccountError}
            style={{ marginBottom: 16, marginTop: 8 }}
          />
        ) : null}
        <Form
          form={addAccountForm}
          layout="vertical"
          requiredMark={false}
          autoComplete="on"
          style={{ paddingTop: 8 }}
        >
          <Form.Item
            label="登录名或邮箱"
            name="loginName"
            rules={[{ required: true, message: '请输入登录名或邮箱。' }]}
          >
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="loginPassword"
            rules={[{ required: true, message: '请输入密码。' }]}
            style={{ marginBottom: 0 }}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
