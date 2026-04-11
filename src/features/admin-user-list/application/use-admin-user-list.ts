import { useCallback, useEffect, useState } from 'react';

import type {
  AdminUserAccountStatus,
  AdminUserEmploymentStatus,
  AdminUserListQuery,
  AdminUserListResult,
} from './get-admin-users';

export type AdminUserListLoader = (criteria: AdminUserListQuery) => Promise<AdminUserListResult>;

type AdminUserListState = {
  errorMessage: string | null;
  hasLoaded: boolean;
  isLoading: boolean;
  result: AdminUserListResult | null;
};

const INITIAL_STATE: AdminUserListState = {
  errorMessage: null,
  hasLoaded: false,
  isLoading: true,
  result: null,
};

export function useAdminUserList(
  criteria: AdminUserListQuery,
  loadUsers: AdminUserListLoader,
): {
  applyAccountStatusUpdate: (accountIds: readonly number[], status: AdminUserAccountStatus) => void;
  applyStaffEmploymentStatusUpdate: (
    accountIds: readonly number[],
    employmentStatus: AdminUserEmploymentStatus,
  ) => void;
  errorMessage: string | null;
  hasLoaded: boolean;
  isLoading: boolean;
  result: AdminUserListResult | null;
  retry: () => void;
} {
  const [state, setState] = useState(INITIAL_STATE);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function loadUsers() {
      setState((currentState) => ({
        ...currentState,
        errorMessage: null,
        isLoading: true,
      }));

      try {
        const result = await loadUsers(criteria);

        if (!isActive) {
          return;
        }

        setState({
          errorMessage: null,
          hasLoaded: true,
          isLoading: false,
          result,
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState((currentState) => ({
          ...currentState,
          errorMessage: error instanceof Error ? error.message : '用户列表加载失败。',
          hasLoaded: true,
          isLoading: false,
          result: null,
        }));
      }
    }

    void loadUsers();

    return () => {
      isActive = false;
    };
  }, [criteria, loadUsers, refreshKey]);

  const retry = useCallback(() => {
    setRefreshKey((currentValue) => currentValue + 1);
  }, []);

  const applyAccountStatusUpdate = useCallback(
    (accountIds: readonly number[], status: AdminUserAccountStatus) => {
      const targetIds = new Set(accountIds);

      setState((currentState) => {
        if (!currentState.result) {
          return currentState;
        }

        return {
          ...currentState,
          result: {
            ...currentState.result,
            list: currentState.result.list.map((item) =>
              targetIds.has(item.account.id)
                ? {
                    ...item,
                    account: {
                      ...item.account,
                      status,
                    },
                  }
                : item,
            ),
          },
        };
      });
    },
    [],
  );

  const applyStaffEmploymentStatusUpdate = useCallback(
    (accountIds: readonly number[], employmentStatus: AdminUserEmploymentStatus) => {
      const targetIds = new Set(accountIds);

      setState((currentState) => {
        if (!currentState.result) {
          return currentState;
        }

        return {
          ...currentState,
          result: {
            ...currentState.result,
            list: currentState.result.list.map((item) =>
              targetIds.has(item.account.id) && item.staff
                ? {
                    ...item,
                    staff: {
                      ...item.staff,
                      employmentStatus,
                    },
                  }
                : item,
            ),
          },
        };
      });
    },
    [],
  );

  return {
    applyAccountStatusUpdate,
    applyStaffEmploymentStatusUpdate,
    errorMessage: state.errorMessage,
    hasLoaded: state.hasLoaded,
    isLoading: state.isLoading,
    result: state.result,
    retry,
  };
}
