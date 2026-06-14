// src/entities/upstream-session/application/staff-directory-teachers-hook.ts
import { useEffect, useState } from 'react';

import {
  readStaffDirectory,
  type StaffDirectoryEntry,
  type StaffDirectoryResult,
} from '../infrastructure/staff-directory';

type UseStaffDirectoryTeachersOptions = {
  enabled?: boolean;
  readStaffDirectoryFn?: typeof readStaffDirectory;
};

export type UseStaffDirectoryTeachersResult = {
  directory: StaffDirectoryResult | null;
  error: string | null;
  loading: boolean;
  teachers: readonly StaffDirectoryEntry[];
};

export function useStaffDirectoryTeachers({
  enabled = true,
  readStaffDirectoryFn = readStaffDirectory,
}: UseStaffDirectoryTeachersOptions = {}): UseStaffDirectoryTeachersResult {
  const [directory, setDirectory] = useState<StaffDirectoryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function loadStaffDirectory() {
      setLoading(true);
      setError(null);

      try {
        const nextDirectory = await readStaffDirectoryFn();

        if (!cancelled) {
          setDirectory(nextDirectory);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '暂时无法加载教师目录。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadStaffDirectory();

    return () => {
      cancelled = true;
    };
  }, [enabled, readStaffDirectoryFn]);

  return {
    directory,
    error,
    loading,
    teachers: directory?.teachers ?? [],
  };
}
