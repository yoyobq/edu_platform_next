import { useCallback, useMemo, useState } from 'react';

import type { AdminUserListItem } from '@/entities/admin-user';

import { adminRequestVerificationChangeLoginEmail } from '../infrastructure/verification-issuance-api';

import { useVerificationAccountPicker } from './use-verification-account-picker';
import {
  resolveResultMessage,
  type VerificationIssuanceFeedback,
} from './verification-issuance-feedback';

export type ChangeLoginEmailIssuanceFormValues = {
  newLoginEmail: string;
};

export function getAdminUserDisplayName(user: AdminUserListItem) {
  return (
    user.userInfo.nickname ||
    user.staff?.name ||
    user.account.loginName ||
    `账号 ${user.account.id}`
  );
}

export function useChangeLoginEmailIssuance(input: {
  onFeedback: (feedback: VerificationIssuanceFeedback) => void;
}) {
  const { onFeedback } = input;
  const accountPicker = useVerificationAccountPicker({
    initialPageSize: 10,
    loadErrorFallback: '暂时无法加载用户列表。',
  });
  const { selectedRecords, setSelectedAccountIds } = accountPicker;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedRecord = useMemo(() => selectedRecords[0] ?? null, [selectedRecords]);

  const openModal = useCallback(() => {
    if (!selectedRecord) {
      return;
    }

    setSubmitError(null);
    setIsModalOpen(true);
  }, [selectedRecord]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSubmitError(null);
  }, []);

  const sendChangeLoginEmail = useCallback(
    async (values: ChangeLoginEmailIssuanceFormValues) => {
      if (!selectedRecord) {
        return false;
      }

      const newLoginEmail = values.newLoginEmail.trim();

      setIsSending(true);
      setSubmitError(null);
      onFeedback(null);

      try {
        const result = await adminRequestVerificationChangeLoginEmail({
          accountId: selectedRecord.account.id,
          newLoginEmail,
        });

        onFeedback({
          detail: `${getAdminUserDisplayName(selectedRecord)} (${selectedRecord.account.id}) -> ${newLoginEmail}`,
          message: result.message || '登录邮箱变更验证邮件已发送。',
          title: '登录邮箱变更验证已发送',
          type: 'change-login-email',
        });
        setSelectedAccountIds([]);
        setIsModalOpen(false);
        return true;
      } catch (error) {
        setSubmitError(resolveResultMessage(error, '暂时无法发送登录邮箱变更验证邮件。'));
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [onFeedback, selectedRecord, setSelectedAccountIds],
  );

  return {
    closeModal,
    isModalOpen,
    isSending,
    openModal,
    selectedRecord,
    sendChangeLoginEmail,
    submitError,
    ...accountPicker,
  };
}
