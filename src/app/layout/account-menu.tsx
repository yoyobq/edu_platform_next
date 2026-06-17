import { type CSSProperties, useEffect, useMemo, useState } from 'react';
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

import {
  type AccountSwitchLabRecord,
  type AccountSwitchLabSession,
  type AuthSessionSnapshot,
  createAccountSwitchLabSession,
  isAccountSwitchLabAccountMismatchError,
  logout,
  readAccountSwitchLabRecords,
  restoreAccountSwitchLabSession,
  revokeAuthSession,
  upsertAccountSwitchLabRecord,
  writeAccountSwitchLabRecords,
  writeCurrentAuthSession,
} from '@/features/auth';

import { getGraphQLClient, isGraphQLIngressError } from '@/shared/graphql';
import { HexAvatar } from '@/shared/hex-avatar';

const ACCOUNT_SWITCH_LIMIT = 2;

type AccountCredentialsFormValues = {
  loginName: string;
  loginPassword: string;
};

type AccountReauthRequest = {
  mode: 'logout-fallback' | 'switch';
  nextRecords: AccountSwitchLabRecord[] | null;
  sessionToRevoke: AccountSwitchLabSession | null;
  session: AccountSwitchLabSession;
};

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
  return (
    session.identity?.name ||
    session.userInfo.nickname ||
    session.displayName ||
    `#${session.accountId}`
  );
}

function getAccountEmailValue(session: AccountSwitchLabSession) {
  const loginName = session.account.loginName?.trim() ?? '';

  return (
    session.account.loginEmail ||
    session.userInfo.email ||
    (loginName.includes('@') ? loginName : null)
  );
}

function getAccountLoginEmail(session: AccountSwitchLabSession) {
  return getAccountEmailValue(session) || '未设置邮箱';
}

function shouldRefreshAccountSwitchSessionDisplay(session: AccountSwitchLabSession) {
  return !getAccountEmailValue(session);
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

function getSwitchFailureMessage(error: unknown) {
  if (isGraphQLIngressError(error) && error.type === 'auth') {
    return '这个账号登录已失效，请重新登录后继续。';
  }

  return error instanceof Error ? error.message : '切换账号失败，请稍后再试。';
}

export function StaffAccountMenu({
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
  const [reauthRequest, setReauthRequest] = useState<AccountReauthRequest | null>(null);
  const [addAccountForm] = Form.useForm<AccountCredentialsFormValues>();
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
  const isAccountCredentialModalOpen = addAccountModalOpen || Boolean(reauthRequest);

  useEffect(() => {
    const recordsToRefresh = accountRecords.filter((record) =>
      shouldRefreshAccountSwitchSessionDisplay(record.session),
    );

    if (recordsToRefresh.length === 0) {
      return;
    }

    let isCancelled = false;

    void Promise.allSettled(
      recordsToRefresh.map((record) => restoreAccountSwitchLabSession(record.session)),
    ).then((results) => {
      if (isCancelled) {
        return;
      }

      const restoredSessions = results
        .filter((result): result is PromiseFulfilledResult<AccountSwitchLabSession> => {
          return (
            result.status === 'fulfilled' && !shouldRefreshAccountSwitchSessionDisplay(result.value)
          );
        })
        .map((result) => result.value);

      if (restoredSessions.length === 0) {
        return;
      }

      try {
        const nextRecords = restoredSessions.reduce(
          (records, session) => upsertAccountSwitchLabRecord(records, session),
          readAccountSwitchLabRecords(),
        );

        writeAccountSwitchLabRecords(nextRecords);
        setAccountRecords(nextRecords);
      } catch {
        // Display hydration must not block normal account switching.
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [accountRecords]);

  function commitAccountRecords(nextRecords: AccountSwitchLabRecord[]) {
    writeAccountSwitchLabRecords(nextRecords);
    setAccountRecords(nextRecords);
  }

  function getFallbackSessionAfterLogout(session: AccountSwitchLabSession) {
    return accountSessions.find((candidate) => candidate.accountId !== session.accountId) ?? null;
  }

  function buildSwitchAccountRecords(nextActiveSession: AccountSwitchLabSession) {
    const retainedRecords = readAccountSwitchLabRecords().filter((record) =>
      [activeSnapshot.accountId, nextActiveSession.accountId].includes(record.session.accountId),
    );

    return upsertAccountSwitchLabRecord(
      upsertAccountSwitchLabRecord(retainedRecords, activeSnapshot),
      nextActiveSession,
    );
  }

  async function replaceCurrentSession(session: AccountSwitchLabSession) {
    writeCurrentAuthSession(session);

    try {
      await getGraphQLClient().clearStore();
    } finally {
      writeCurrentAuthSession(session);
    }

    window.location.reload();
  }

  function closeAccountCredentialModal() {
    setAddAccountModalOpen(false);
    setReauthRequest(null);
    setAddAccountError(null);
    addAccountForm.resetFields();
  }

  function openReauthModal(
    session: AccountSwitchLabSession,
    mode: AccountReauthRequest['mode'] = 'switch',
    nextRecords: AccountSwitchLabRecord[] | null = null,
    sessionToRevoke: AccountSwitchLabSession | null = null,
  ) {
    setAddAccountModalOpen(false);
    setReauthRequest({
      mode,
      nextRecords,
      sessionToRevoke,
      session,
    });
    setAddAccountError(`${getAccountDisplayName(session)} 登录已失效，请重新登录后继续。`);
    addAccountForm.setFieldsValue({
      loginName: session.account.loginName || session.account.loginEmail || '',
      loginPassword: '',
    });
  }

  async function switchToSession(session: AccountSwitchLabSession) {
    if (activeSnapshot.accountId === session.accountId) {
      return;
    }

    setSwitchingAccountId(session.accountId);

    try {
      const restoredSession = await restoreAccountSwitchLabSession(session);

      commitAccountRecords(buildSwitchAccountRecords(restoredSession));
      await replaceCurrentSession(restoredSession);
    } catch (error) {
      if (
        (isGraphQLIngressError(error) && error.type === 'auth') ||
        isAccountSwitchLabAccountMismatchError(error)
      ) {
        openReauthModal(session);
        return;
      }

      messageApi.error(getSwitchFailureMessage(error));
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
        messageApi.info('这个账号已经在列表里，请换个账号添加。');
        return;
      }

      const nextRecords = upsertAccountSwitchLabRecord(baseRecords, session);

      commitAccountRecords(nextRecords);
      closeAccountCredentialModal();
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

  async function handleReauthAccount(request: AccountReauthRequest) {
    const values = await addAccountForm.validateFields();

    setAddAccountSubmitting(true);
    setAddAccountError(null);

    try {
      const session = await createAccountSwitchLabSession({
        loginName: values.loginName,
        loginPassword: values.loginPassword,
      });

      if (session.accountId !== request.session.accountId) {
        setAddAccountError(`请登录 ${getAccountDisplayName(request.session)} 对应的账号。`);
        return;
      }

      if (request.mode === 'logout-fallback') {
        if (request.sessionToRevoke) {
          await revokeAuthSession({ accessToken: request.sessionToRevoke.accessToken });
        }

        commitAccountRecords(
          upsertAccountSwitchLabRecord(
            (request.nextRecords ?? []).filter(
              (record) => record.session.accountId === session.accountId,
            ),
            session,
          ),
        );
      } else {
        commitAccountRecords(buildSwitchAccountRecords(session));
      }

      closeAccountCredentialModal();
      await replaceCurrentSession(session);
    } catch (error) {
      setAddAccountError(error instanceof Error ? error.message : '重新登录失败。');
    } finally {
      setAddAccountSubmitting(false);
    }
  }

  async function handleAccountCredentialSubmit() {
    if (reauthRequest) {
      await handleReauthAccount(reauthRequest);
      return;
    }

    await handleAddAccount();
  }

  async function logoutAccount(session: AccountSwitchLabSession) {
    const nextRecords = accountRecords.filter(
      (record) => record.session.accountId !== session.accountId,
    );
    const isActiveAccount = activeSnapshot.accountId === session.accountId;
    const fallbackSession = isActiveAccount ? getFallbackSessionAfterLogout(session) : null;

    if (isActiveAccount && fallbackSession) {
      setSwitchingAccountId(fallbackSession.accountId);

      try {
        const restoredFallbackSession = await restoreAccountSwitchLabSession(fallbackSession);

        await revokeAuthSession({ accessToken: session.accessToken });
        commitAccountRecords(
          upsertAccountSwitchLabRecord(
            nextRecords.filter(
              (record) => record.session.accountId === restoredFallbackSession.accountId,
            ),
            restoredFallbackSession,
          ),
        );
        await replaceCurrentSession(restoredFallbackSession);
      } catch (error) {
        if (
          (isGraphQLIngressError(error) && error.type === 'auth') ||
          isAccountSwitchLabAccountMismatchError(error)
        ) {
          openReauthModal(fallbackSession, 'logout-fallback', nextRecords, session);
          return;
        }

        messageApi.error(getSwitchFailureMessage(error));
      } finally {
        setSwitchingAccountId(null);
      }

      return;
    }

    commitAccountRecords(nextRecords);

    if (isActiveAccount) {
      await logout();
      await getGraphQLClient()
        .clearStore()
        .catch(() => undefined);
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
              setReauthRequest(null);
              setAddAccountError(null);
              addAccountForm.resetFields();
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
            styles={{ container: { padding: 0 } }}
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
                <div className="truncate text-sm font-semibold">
                  {getAccountDisplayName(activeSnapshot)}
                </div>
                <div className="truncate text-xs text-text-secondary">{identityLabel}</div>
              </div>
              <RightOutlined style={{ color: 'var(--ant-color-text-tertiary)', fontSize: 10 }} />
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
              styles={{ container: { padding: 0 } }}
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-bg-layout"
              >
                <LogoutOutlined />
                <span className="min-w-0 flex-1 text-left">退出账户</span>
                <RightOutlined style={{ color: 'var(--ant-color-text-tertiary)', fontSize: 10 }} />
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
              <div className="truncate text-sm font-medium">
                {getAccountDisplayName(activeSnapshot)}
              </div>
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
        title={reauthRequest ? '重新登录账号' : '增加另一个账号'}
        open={isAccountCredentialModalOpen}
        okText={reauthRequest ? '登录并切换' : '添加账号'}
        cancelText="取消"
        confirmLoading={addAccountSubmitting}
        forceRender
        okButtonProps={{ disabled: !reauthRequest && hasReachedAccountSwitchLimit }}
        onCancel={closeAccountCredentialModal}
        onOk={() => void handleAccountCredentialSubmit()}
      >
        {addAccountError ? (
          <Alert
            type={reauthRequest ? 'warning' : 'error'}
            showIcon
            title={addAccountError}
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
            <Input.Password autoComplete={reauthRequest ? 'current-password' : 'new-password'} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
