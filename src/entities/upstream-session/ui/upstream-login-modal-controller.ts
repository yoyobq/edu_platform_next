// src/entities/upstream-session/ui/upstream-login-modal-controller.ts

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Form, type FormInstance } from 'antd';

import {
  buildUpstreamLoginCredentialsInitialValues,
  canUseRememberedUpstreamLoginCredentials,
  canUseStoredUpstreamSessionForLockedUser,
} from '../application/upstream-login-credentials';
import {
  type UpstreamAccountIdentity,
  useUpstreamSession,
} from '../application/upstream-session-controller';
import type { StoredUpstreamSession } from '../infrastructure/upstream-session-storage';

import type { UpstreamLoginFormValues } from './upstream-login-modal';

type MaybePromise<T> = T | Promise<T>;

export type UpstreamLoginModalControllerProps = {
  form: FormInstance<UpstreamLoginFormValues>;
  hasRememberedCredentials: boolean;
  isSubmitting: boolean;
  loginError: string | null;
  lockedUserId?: string | null;
  open: boolean;
  onCancel: () => void;
  onClearRememberedCredentials: () => void;
  onFinish: (values: UpstreamLoginFormValues) => Promise<void>;
};

export type OpenUpstreamLoginModalInput<TPendingAction> = {
  fallbackUserId?: string | null;
  loginError?: string | null;
  pendingAction?: TPendingAction | null;
};

export type OpenExpiredUpstreamLoginModalInput<TPendingAction> = {
  loginError: string;
  pendingAction?: TPendingAction | null;
  session: StoredUpstreamSession;
};

export type UpstreamLoginSuccessInput<TPendingAction> = {
  pendingAction: TPendingAction | null;
  session: StoredUpstreamSession;
};

export type UseUpstreamLoginModalControllerOptions<TPendingAction> = {
  account: UpstreamAccountIdentity | null;
  keepAlive?: boolean;
  lockedUserId?: string | null;
  refreshLeadTimeMs?: number;
  resolveLoginErrorMessage: (error: unknown) => string;
  onLoginSuccess?: (input: UpstreamLoginSuccessInput<TPendingAction>) => MaybePromise<void>;
};

export function useUpstreamLoginModalController<TPendingAction = never>({
  account,
  keepAlive,
  lockedUserId,
  refreshLeadTimeMs,
  resolveLoginErrorMessage,
  onLoginSuccess,
}: UseUpstreamLoginModalControllerOptions<TPendingAction>) {
  const [form] = Form.useForm<UpstreamLoginFormValues>();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<TPendingAction | null>(null);
  const {
    clear,
    clearRememberedCredentials,
    keepAliveFailure,
    login,
    persistSessionFromResult,
    rememberedCredentials,
    refreshSession,
    session,
  } = useUpstreamSession({
    account,
    keepAlive,
    lockedUserId,
    refreshLeadTimeMs,
  });
  const hasRememberedCredentials = canUseRememberedUpstreamLoginCredentials({
    lockedUserId,
    rememberedCredentials,
  });
  const canUseStoredSession = canUseStoredUpstreamSessionForLockedUser({
    lockedUserId,
    session,
  });
  const effectiveSession = canUseStoredSession ? session : null;

  const setLoginFormInitialValues = useCallback(
    (fallbackUserId?: string | null) => {
      form.setFieldsValue(
        buildUpstreamLoginCredentialsInitialValues({
          fallbackUserId,
          lockedUserId,
          rememberedCredentials,
        }),
      );
    },
    [form, lockedUserId, rememberedCredentials],
  );

  const openLoginModal = useCallback(
    (input: OpenUpstreamLoginModalInput<TPendingAction> = {}) => {
      setPendingAction(input.pendingAction ?? null);
      setLoginError(input.loginError ?? null);
      setLoginFormInitialValues(input.fallbackUserId);
      setIsOpen(true);
    },
    [setLoginFormInitialValues],
  );

  const closeLoginModal = useCallback(() => {
    setIsOpen(false);
    setPendingAction(null);
    setLoginError(null);
  }, []);

  const clearSession = useCallback(() => {
    clear();
    closeLoginModal();
    form.resetFields();
  }, [clear, closeLoginModal, form]);

  const openLoginModalForExpiredSession = useCallback(
    (input: OpenExpiredUpstreamLoginModalInput<TPendingAction>) => {
      clear();
      openLoginModal({
        fallbackUserId: input.session.upstreamLoginId,
        loginError: input.loginError,
        pendingAction: input.pendingAction ?? null,
      });
    },
    [clear, openLoginModal],
  );

  const handleLoginFinish = useCallback(
    async (values: UpstreamLoginFormValues) => {
      setIsSubmitting(true);
      setLoginError(null);

      try {
        const nextSession = await login(values);
        const nextPendingAction = pendingAction;

        setPendingAction(null);
        setIsOpen(false);
        form.resetFields();

        await onLoginSuccess?.({
          pendingAction: nextPendingAction,
          session: nextSession,
        });
      } catch (error) {
        setLoginError(resolveLoginErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, login, onLoginSuccess, pendingAction, resolveLoginErrorMessage],
  );

  useEffect(() => {
    if (session && !canUseStoredSession) {
      clear();
    }
  }, [canUseStoredSession, clear, session]);

  useEffect(() => {
    if (!keepAliveFailure) {
      return;
    }

    openLoginModal({
      fallbackUserId: keepAliveFailure.upstreamLoginId,
      loginError: keepAliveFailure.message,
    });
  }, [keepAliveFailure, openLoginModal]);

  const modalProps = useMemo<UpstreamLoginModalControllerProps>(
    () => ({
      form,
      hasRememberedCredentials,
      isSubmitting,
      lockedUserId,
      loginError,
      open: isOpen,
      onCancel: closeLoginModal,
      onClearRememberedCredentials: clearRememberedCredentials,
      onFinish: handleLoginFinish,
    }),
    [
      clearRememberedCredentials,
      closeLoginModal,
      form,
      handleLoginFinish,
      hasRememberedCredentials,
      isOpen,
      isSubmitting,
      lockedUserId,
      loginError,
    ],
  );

  return {
    clearSession,
    modalProps,
    openLoginModal,
    openLoginModalForExpiredSession,
    persistSessionFromResult,
    refreshSession,
    session: effectiveSession,
  };
}
