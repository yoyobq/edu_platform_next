import { useCallback, useEffect, useState } from 'react';

import type { AdminUserDetail } from './get-admin-user-detail';

export type AdminUserDetailLoader = (accountId: number) => Promise<AdminUserDetail>;

type AdminUserDetailState = {
  errorMessage: string | null;
  hasLoaded: boolean;
  isLoading: boolean;
  result: AdminUserDetail | null;
};

const INITIAL_STATE: AdminUserDetailState = {
  errorMessage: null,
  hasLoaded: false,
  isLoading: true,
  result: null,
};

function omitUndefinedFields<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as Partial<T>;
}

export function useAdminUserDetail(accountId: number, loadDetail: AdminUserDetailLoader) {
  const [state, setState] = useState(INITIAL_STATE);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function loadDetailData() {
      setState((currentState) => ({
        ...currentState,
        errorMessage: null,
        isLoading: true,
      }));

      try {
        const result = await loadDetail(accountId);

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

        setState({
          errorMessage: error instanceof Error ? error.message : '用户详情加载失败。',
          hasLoaded: true,
          isLoading: false,
          result: null,
        });
      }
    }

    void loadDetailData();

    return () => {
      isActive = false;
    };
  }, [accountId, loadDetail, refreshKey]);

  const retry = useCallback(() => {
    setRefreshKey((currentValue) => currentValue + 1);
  }, []);

  const applyAccountUpdate = useCallback((account: Partial<AdminUserDetail['account']>) => {
    setState((currentState) => {
      if (!currentState.result) {
        return currentState;
      }

      const nextAccountPatch = omitUndefinedFields(account);

      return {
        ...currentState,
        result: {
          ...currentState.result,
          account: {
            ...currentState.result.account,
            ...nextAccountPatch,
          },
        },
      };
    });
  }, []);

  const applyUserInfoUpdate = useCallback((userInfo: AdminUserDetail['userInfo']) => {
    setState((currentState) => {
      if (!currentState.result) {
        return currentState;
      }

      return {
        ...currentState,
        result: {
          ...currentState.result,
          userInfo,
        },
      };
    });
  }, []);

  const applyStaffUpdate = useCallback((staff: AdminUserDetail['staff']) => {
    setState((currentState) => {
      if (!currentState.result) {
        return currentState;
      }

      return {
        ...currentState,
        result: {
          ...currentState.result,
          staff,
        },
      };
    });
  }, []);

  return {
    applyAccountUpdate,
    applyStaffUpdate,
    applyUserInfoUpdate,
    errorMessage: state.errorMessage,
    hasLoaded: state.hasLoaded,
    isLoading: state.isLoading,
    result: state.result,
    retry,
  };
}
