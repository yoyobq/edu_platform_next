import { useCallback, useEffect, useState } from 'react';

import { requestAdminUsers } from '../infrastructure/admin-user-list-api';

import type {
  AdminUserAccountStatus,
  AdminUserListQuery,
  AdminUserListResult,
} from './get-admin-users';

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

export function useAdminUserList(criteria: AdminUserListQuery): {
  applyAccountStatusUpdate: (accountId: number, status: AdminUserAccountStatus) => void;
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
        const result = await requestAdminUsers(criteria);

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
  }, [criteria, refreshKey]);

  const retry = useCallback(() => {
    setRefreshKey((currentValue) => currentValue + 1);
  }, []);

  const applyAccountStatusUpdate = useCallback(
    (accountId: number, status: AdminUserAccountStatus) => {
      setState((currentState) => {
        if (!currentState.result) {
          return currentState;
        }

        return {
          ...currentState,
          result: {
            ...currentState.result,
            list: currentState.result.list.map((item) =>
              item.account.id === accountId
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

  return {
    applyAccountStatusUpdate,
    errorMessage: state.errorMessage,
    hasLoaded: state.hasLoaded,
    isLoading: state.isLoading,
    result: state.result,
    retry,
  };
}
