import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type AdminUserListItem,
  type AdminUserListResult,
  requestAdminUsers,
} from '@/entities/admin-user';

import { adminRequestVerificationPasswordResetEmail } from '../infrastructure/verification-issuance-api';

import {
  resolveResultMessage,
  type VerificationIssuanceFeedback,
} from './verification-issuance-feedback';

const DEFAULT_WELCOME_BACK_PAGE_SIZE = 50;

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
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_WELCOME_BACK_PAGE_SIZE);
  const [result, setResult] = useState<AdminUserListResult | null>(null);
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
    let isActive = true;

    async function loadUsers() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextResult = await requestAdminUsers({
          accessGroups: ['ADMIN', 'STAFF'],
          limit: pageSize,
          page,
          query: submittedQuery,
          sortBy: 'id',
          sortOrder: 'DESC',
        });

        if (isActive) {
          setResult(nextResult);
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(resolveResultMessage(error, '暂时无法加载已有用户列表。'));
          setResult(null);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      isActive = false;
    };
  }, [page, pageSize, submittedQuery]);

  useEffect(() => {
    const availableIds = new Set(currentList.map((item) => item.account.id));

    setSelectedAccountIds((currentSelectedAccountIds) =>
      currentSelectedAccountIds.filter((accountId) => availableIds.has(accountId)),
    );
  }, [currentList]);

  const searchUsers = useCallback((value: string) => {
    setSubmittedQuery(value.trim());
    setPage(1);
  }, []);

  const selectAccountIds = useCallback((nextSelectedRowKeys: readonly unknown[]) => {
    setSelectedAccountIds(nextSelectedRowKeys.map((key) => Number(key)));
  }, []);

  const changePage = useCallback(
    (nextPage: number, nextPageSize: number) => {
      setSelectedAccountIds([]);

      if (nextPageSize !== pageSize) {
        setPageSize(nextPageSize);
        setPage(1);
        return;
      }

      setPage(nextPage);
    },
    [pageSize],
  );

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
        setSelectedAccountIds(failedAccountIds);
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
      setSelectedAccountIds([]);
    } finally {
      setIsSending(false);
    }
  }, [onFeedback, selectedRecords]);

  return {
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
  };
}
