import { useEffect, useState } from 'react';

import type { AdminDepartmentOption } from './get-admin-department-options';

export type AdminDepartmentOptionsLoader = () => Promise<readonly AdminDepartmentOption[]>;

type AdminDepartmentOptionsState = {
  errorMessage: string | null;
  hasLoaded: boolean;
  isLoading: boolean;
  options: readonly AdminDepartmentOption[];
};

const INITIAL_STATE: AdminDepartmentOptionsState = {
  errorMessage: null,
  hasLoaded: false,
  isLoading: true,
  options: [],
};

export function useAdminDepartmentOptions(loadOptions: AdminDepartmentOptionsLoader) {
  const [state, setState] = useState(INITIAL_STATE);

  useEffect(() => {
    let isActive = true;

    async function loadDepartmentOptions() {
      setState((currentState) => ({
        ...currentState,
        errorMessage: null,
        isLoading: true,
      }));

      try {
        const options = await loadOptions();

        if (!isActive) {
          return;
        }

        setState({
          errorMessage: null,
          hasLoaded: true,
          isLoading: false,
          options,
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState({
          errorMessage: error instanceof Error ? error.message : '部门列表加载失败。',
          hasLoaded: true,
          isLoading: false,
          options: [],
        });
      }
    }

    void loadDepartmentOptions();

    return () => {
      isActive = false;
    };
  }, [loadOptions]);

  return {
    errorMessage: state.errorMessage,
    hasLoaded: state.hasLoaded,
    isLoading: state.isLoading,
    options: state.options,
  };
}
