// src/app/layout/student-account-menu.tsx

import { type CSSProperties } from 'react';
import { LogoutOutlined, MoonOutlined, SunOutlined, UserOutlined } from '@ant-design/icons';
import { Dropdown, Modal, Segmented, Tooltip } from 'antd';
import { useNavigate } from 'react-router';

import { FONT_SCALE_OPTIONS, type FontScale } from '@/app/providers';

import { type AuthSessionSnapshot, logout } from '@/features/auth';

import { HexAvatar } from '@/shared/hex-avatar';

type StudentAccountMenuProps = {
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

function getStudentDisplayName(snapshot: AuthSessionSnapshot) {
  return (
    snapshot.identity?.name ||
    snapshot.userInfo.nickname ||
    snapshot.displayName ||
    `#${snapshot.accountId}`
  );
}

function getStudentEmail(snapshot: AuthSessionSnapshot) {
  const loginName = snapshot.account.loginName?.trim() ?? '';

  return (
    snapshot.account.loginEmail ||
    snapshot.userInfo.email ||
    (loginName.includes('@') ? loginName : '未设置邮箱')
  );
}

export function StudentAccountMenu({
  activeSnapshot,
  controlSize,
  fontScale,
  isDark,
  isSessionResolving,
  placement,
  setFontScale,
  setIsDark,
  trigger,
}: StudentAccountMenuProps) {
  const navigate = useNavigate();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const identityLabel = isSessionResolving ? '同步中' : '学生账号';

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  function confirmLogout() {
    modalApi.confirm({
      title: '退出登录',
      content: '退出后需要重新登录。',
      okText: '退出',
      cancelText: '取消',
      onOk: () => handleLogout(),
    });
  }

  function renderStudentMenuContent() {
    const surfaceStyle: CSSProperties = {
      background: 'var(--ant-color-bg-elevated)',
      borderRadius: 'var(--ant-border-radius-lg)',
      boxShadow: 'var(--ant-box-shadow-secondary)',
      minWidth: 280,
      overflow: 'hidden',
      padding: 8,
    };

    return (
      <div style={surfaceStyle}>
        <div className="px-1 pb-3 pt-1">
          <div className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left">
            <HexAvatar
              accountId={activeSnapshot.accountId}
              avatarUrl={activeSnapshot.userInfo.avatarUrl}
              size={44}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {getStudentDisplayName(activeSnapshot)}
              </div>
              <div className="truncate text-xs text-text-secondary">
                {getStudentEmail(activeSnapshot)}
              </div>
            </div>
          </div>
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
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-bg-layout"
            onClick={confirmLogout}
          >
            <LogoutOutlined />
            <span className="min-w-0 flex-1 text-left">退出登录</span>
          </button>
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
                {getStudentDisplayName(activeSnapshot)}
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
      {modalContextHolder}
      <Dropdown placement={placement} trigger={['click']} popupRender={renderStudentMenuContent}>
        {renderTrigger()}
      </Dropdown>
    </>
  );
}
