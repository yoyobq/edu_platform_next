import { useCallback, useState } from 'react';

import type { AdminUserListItem } from '@/entities/admin-user';

import { adminRequestVerificationPasswordResetEmail } from '../infrastructure/verification-issuance-api';

import { useVerificationAccountPicker } from './use-verification-account-picker';
import {
  resolveResultMessage,
  type VerificationIssuanceFeedback,
} from './verification-issuance-feedback';

const WELCOME_BACK_ACCESS_GROUPS = ['ADMIN', 'STAFF'] as const;

export function getWelcomeBackUserDisplayName(user: AdminUserListItem) {
  return (
    user.userInfo.nickname ||
    user.staff?.name ||
    user.account.loginName ||
    `账号 ${user.account.id}`
  );
}

export function getWelcomeBackUserIdentityTags(user: AdminUserListItem) {
  return user.userInfo.accessGroup.filter((group) => group === 'ADMIN' || group === 'STAFF');
}

export function useWelcomeBackIssuance(input: {
  onFeedback: (feedback: VerificationIssuanceFeedback) => void;
}) {
  const { onFeedback } = input;
  const accountPicker = useVerificationAccountPicker({
    accessGroups: WELCOME_BACK_ACCESS_GROUPS,
    loadErrorFallback: '暂时无法加载已有用户列表。',
  });
  const { clearSelection, selectAccountIdsById, selectedRecords } = accountPicker;
  const [isSending, setIsSending] = useState(false);

  const sendWelcomeBackEmails = useCallback(async () => {
    if (selectedRecords.length === 0) {
      return;
    }

    setIsSending(true);
    onFeedback(null);

    const failures: string[] = [];
    const failedAccountIds: number[] = [];

    try {
      for (const record of selectedRecords) {
        try {
          await adminRequestVerificationPasswordResetEmail({
            accountId: record.account.id,
          });
        } catch (error) {
          failedAccountIds.push(record.account.id);
          failures.push(
            `${getWelcomeBackUserDisplayName(record)} (${record.account.id})：${resolveResultMessage(
              error,
              '发送失败',
            )}`,
          );
        }
      }

      if (failures.length > 0) {
        selectAccountIdsById(failedAccountIds);
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
          .map((record) => `${getWelcomeBackUserDisplayName(record)} (${record.account.id})`)
          .join('、'),
        message:
          selectedRecords.length === 1
            ? '老用户回归改密邮件已发送。'
            : `已发送 ${selectedRecords.length} 封老用户回归改密邮件。`,
        title: '回归改密邮件已发送',
        type: 'welcome-back',
      });
      clearSelection();
    } finally {
      setIsSending(false);
    }
  }, [clearSelection, onFeedback, selectAccountIdsById, selectedRecords]);

  return {
    isSending,
    sendWelcomeBackEmails,
    ...accountPicker,
  };
}
