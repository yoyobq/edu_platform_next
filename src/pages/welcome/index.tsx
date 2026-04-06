import { startTransition, useMemo, useState } from 'react';
import { Alert, Flex, Spin, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router';

import {
  type AuthAccessGroup,
  forceLogout,
  refreshSession,
  resolveWelcomeRedirectTarget,
  useAuthSessionState,
} from '@/features/auth';
import {
  ProfileCompletionForm,
  type ProfileCompletionFormValues,
  ProfileCompletionPanel,
  type ProfileCompletionTargetIdentity,
  submitProfileCompletion,
} from '@/features/profile-completion';
function resolveInitialTargetIdentity(
  identityHint: AuthAccessGroup | null | undefined,
): ProfileCompletionTargetIdentity | undefined {
  if (identityHint === 'STAFF' || identityHint === 'STUDENT') {
    return identityHint;
  }

  return undefined;
}

export function WelcomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const authSession = useAuthSessionState();
  const snapshot = authSession.snapshot;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'submitting' | 'refreshing'>('idle');
  const redirectTarget = useMemo(
    () => resolveWelcomeRedirectTarget(new URLSearchParams(location.search).get('redirect')),
    [location.search],
  );

  if (authSession.status === 'restoring') {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!snapshot) {
    return null;
  }

  const currentSnapshot = snapshot;
  const isSubmitting = phase === 'submitting' || phase === 'refreshing';
  const initialNickname =
    currentSnapshot.userInfo.nickname === currentSnapshot.primaryAccessGroup.toLowerCase()
      ? ''
      : currentSnapshot.userInfo.nickname;

  async function handleSubmit(values: ProfileCompletionFormValues) {
    setSubmitError(null);
    setPhase('submitting');

    try {
      const result = await submitProfileCompletion(
        {
          departmentId: values.departmentId,
          name: values.name,
          nickname: values.nickname,
          phone: values.phone,
          targetIdentity: values.targetIdentity as ProfileCompletionTargetIdentity,
        },
        {
          accessToken: currentSnapshot.accessToken,
        },
      );

      if (!result.success) {
        setPhase('idle');
        setSubmitError('资料补全未成功完成，请稍后重试。');
        return;
      }

      setPhase('refreshing');
      let refreshedSnapshot;

      try {
        refreshedSnapshot = await refreshSession();
      } catch {
        forceLogout('资料已提交，但当前会话刷新失败，请重新登录。');
        return;
      }

      if (refreshedSnapshot.needsProfileCompletion) {
        setPhase('idle');
        setSubmitError('资料已提交，但当前会话仍显示待补全，请联系管理员核查后端收敛。');
        return;
      }

      startTransition(() => {
        navigate(redirectTarget, { replace: true });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '资料补全失败。';
      setPhase('idle');
      setSubmitError(message);
    }
  }

  return (
    <Flex vertical gap={24} className="mx-auto w-full max-w-3xl">
      <div className="flex flex-col gap-3">
        <Typography.Title level={2} style={{ marginBottom: 0 }}>
          Welcome
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 720 }}>
          当前账号已建立登录会话，但还不能直接进入正式业务主流程。先补齐最小资料，再继续回到
          你的原目标页或默认工作台。
        </Typography.Paragraph>
      </div>

      <ProfileCompletionPanel
        accessGroup={currentSnapshot.userInfo.accessGroup}
        identityHint={currentSnapshot.account.identityHint}
        isRefreshing={phase === 'refreshing'}
      >
        {currentSnapshot.primaryAccessGroup === 'ADMIN' ? (
          <Alert
            type="warning"
            showIcon
            title="当前会话仍处于历史 ADMIN 过渡态"
            description="前台不会把 ADMIN 自动当成已完成身份；是否放行只认 needsProfileCompletion。"
          />
        ) : null}

        <ProfileCompletionForm
          errorMessage={submitError}
          initialValues={{
            name: currentSnapshot.identity?.name || currentSnapshot.displayName,
            nickname: initialNickname,
            targetIdentity: resolveInitialTargetIdentity(currentSnapshot.account.identityHint),
          }}
          onSubmit={handleSubmit}
          submitting={isSubmitting}
          submittingLabel={phase === 'refreshing' ? '正在刷新会话' : '正在提交'}
        />
      </ProfileCompletionPanel>
    </Flex>
  );
}
