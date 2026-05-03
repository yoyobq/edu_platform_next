import { useCallback, useEffect, useMemo, useState } from 'react';

import { type AdminUserListResult, requestAdminUsers } from '@/entities/admin-user';

import type { AuthAccessGroup } from '@/shared/auth-access';

import { resolveResultMessage } from './verification-issuance-feedback';

const DEFAULT_VERIFICATION_ACCOUNT_PICKER_PAGE_SIZE = 50;

export function useVerificationAccountPicker(input: {
  accessGroups?: readonly AuthAccessGroup[];
  initialPageSize?: number;
  loadErrorFallback: string;
}) {
  const accessGroupsKey = (input.accessGroups ?? []).join(',');
  const initialPageSize = input.initialPageSize ?? DEFAULT_VERIFICATION_ACCOUNT_PICKER_PAGE_SIZE;
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [result, setResult] = useState<AdminUserListResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<readonly number[]>([]);

  const accessGroups = useMemo(
    () => (accessGroupsKey ? (accessGroupsKey.split(',') as AuthAccessGroup[]) : undefined),
    [accessGroupsKey],
  );
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
          accessGroups,
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
          setErrorMessage(resolveResultMessage(error, input.loadErrorFallback));
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
  }, [accessGroups, input.loadErrorFallback, page, pageSize, submittedQuery]);

  const searchUsers = useCallback((value: string) => {
    setSelectedAccountIds([]);
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

  return {
    changePage,
    currentList,
    currentPage,
    errorMessage,
    isLoading,
    pageSize,
    query,
    searchUsers,
    selectAccountIds,
    selectedAccountIds,
    selectedRecords,
    setQuery,
    setSelectedAccountIds,
    totalCount,
  };
}
