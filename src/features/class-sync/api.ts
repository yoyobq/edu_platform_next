// src/features/class-sync/api.ts

import type { OperationVariables } from '@apollo/client';

import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import { normalizeRequiredTextValue } from '@/shared/form-normalization';
import { executeGraphQL } from '@/shared/graphql';

export { isExpiredUpstreamSessionError };

export type ClassSyncDepartmentOption = {
  departmentName: string;
  id: string;
  isEnabled: boolean;
  shortName: string | null;
};

export type ClassSyncDryRunAction =
  | 'CREATE'
  | 'UPDATE'
  | 'EXISTS'
  | 'CONFLICT'
  | 'SKIPPED_INVALID_UPSTREAM_CODE'
  | 'SKIPPED_DUPLICATE_UPSTREAM_CODE'
  | 'SKIPPED_INVALID_UPSTREAM_GRADE';

export type ClassSyncCommitAction =
  | 'CREATED'
  | 'UPDATED'
  | 'EXISTS'
  | 'CONFLICT'
  | 'SKIPPED_INVALID_UPSTREAM_CODE'
  | 'SKIPPED_DUPLICATE_UPSTREAM_CODE';

export type ClassSyncItem<Action extends string> = {
  action: Action;
  classCode: string | null;
  classId: string | null;
  className: string;
  conflictReason: string | null;
  departmentId: string;
  gradeYear: number | null;
  majorId: string | null;
  majorName?: string | null;
  sortOrder: number | null;
};

export type ClassSyncDryRunItem = ClassSyncItem<ClassSyncDryRunAction> & {
  majorName: string | null;
};

export type ClassSyncCommitItem = ClassSyncItem<ClassSyncCommitAction>;

type ClassSyncResultBase<Item> = {
  conflictCount: number;
  createdCount: number;
  departmentId: string;
  dryRun: boolean;
  existsCount: number;
  expiresAt: string | null;
  fetchedCount: number;
  items: Item[];
  skippedCount: number;
  updatedCount: number;
  upstreamSessionToken: string | null;
};

export type ClassSyncDryRunResult = ClassSyncResultBase<ClassSyncDryRunItem> & {
  previewedCount: number;
};

export type ClassSyncCommitResult = ClassSyncResultBase<ClassSyncCommitItem> & {
  processedCount: number;
};

export type DryRunSyncClassesFromUpstreamInput = {
  departmentId: string;
  upstreamSessionToken: string;
};

export type SyncClassesFromUpstreamInput = DryRunSyncClassesFromUpstreamInput;

type DepartmentDTO = {
  departmentName: string;
  id: string;
  isEnabled: boolean;
  shortName: string | null;
};

type DepartmentsResponse = {
  departments: DepartmentDTO[];
};

type DryRunSyncClassesFromUpstreamResponse = {
  dryRunSyncClassesFromUpstream: ClassSyncDryRunResult;
};

type SyncClassesFromUpstreamResponse = {
  syncClassesFromUpstream: ClassSyncCommitResult;
};

const DEPARTMENTS_QUERY = `
  query ClassSyncDepartments($limit: Int) {
    departments(limit: $limit) {
      departmentName
      id
      isEnabled
      shortName
    }
  }
`;

const DRY_RUN_SYNC_CLASSES_FROM_UPSTREAM_MUTATION = `
  mutation DryRunSyncClassesFromUpstream($input: DryRunSyncClassesFromUpstreamInput!) {
    dryRunSyncClassesFromUpstream(input: $input) {
      dryRun
      upstreamSessionToken
      expiresAt
      departmentId
      fetchedCount
      previewedCount
      createdCount
      updatedCount
      existsCount
      conflictCount
      skippedCount
      items {
        action
        departmentId
        classId
        classCode
        className
        majorId
        majorName
        gradeYear
        sortOrder
        conflictReason
      }
    }
  }
`;

const SYNC_CLASSES_FROM_UPSTREAM_MUTATION = `
  mutation SyncClassesFromUpstream($input: SyncClassesFromUpstreamInput!) {
    syncClassesFromUpstream(input: $input) {
      dryRun
      upstreamSessionToken
      expiresAt
      departmentId
      fetchedCount
      processedCount
      createdCount
      updatedCount
      existsCount
      conflictCount
      skippedCount
      items {
        action
        departmentId
        classId
        classCode
        className
        majorId
        gradeYear
        sortOrder
        conflictReason
      }
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}

function toDepartmentOption(department: DepartmentDTO): ClassSyncDepartmentOption | null {
  const id = department.id.trim();

  if (!id) {
    return null;
  }

  return {
    departmentName: department.departmentName?.trim() || id,
    id,
    isEnabled: department.isEnabled,
    shortName: department.shortName?.trim() || null,
  };
}

function buildEnabledDepartmentOptions(departments: readonly DepartmentDTO[]) {
  return departments
    .map(toDepartmentOption)
    .filter((department): department is ClassSyncDepartmentOption =>
      Boolean(department && department.isEnabled),
    );
}

function normalizeDryRunInput(input: DryRunSyncClassesFromUpstreamInput) {
  return {
    departmentId: normalizeRequiredTextValue(input.departmentId, { label: '系部' }),
    upstreamSessionToken: normalizeRequiredTextValue(input.upstreamSessionToken, {
      message: 'upstreamSessionToken 为必填。',
    }),
  };
}

export async function fetchClassSyncDepartmentOptions() {
  try {
    const response = await requestGraphQL<DepartmentsResponse, { limit: number }>(
      DEPARTMENTS_QUERY,
      { limit: 500 },
    );

    return buildEnabledDepartmentOptions(response.departments);
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载可选系部。'));
  }
}

export async function dryRunSyncClassesFromUpstream(input: DryRunSyncClassesFromUpstreamInput) {
  const response = await requestGraphQL<
    DryRunSyncClassesFromUpstreamResponse,
    {
      input: ReturnType<typeof normalizeDryRunInput>;
    }
  >(DRY_RUN_SYNC_CLASSES_FROM_UPSTREAM_MUTATION, {
    input: normalizeDryRunInput(input),
  });

  return response.dryRunSyncClassesFromUpstream;
}

export async function syncClassesFromUpstream(input: SyncClassesFromUpstreamInput) {
  const response = await requestGraphQL<
    SyncClassesFromUpstreamResponse,
    {
      input: ReturnType<typeof normalizeDryRunInput>;
    }
  >(SYNC_CLASSES_FROM_UPSTREAM_MUTATION, {
    input: normalizeDryRunInput(input),
  });

  return response.syncClassesFromUpstream;
}

export function resolveClassSyncErrorMessage(error: unknown) {
  return resolveUpstreamErrorMessage(error, '暂时无法执行班级同步。');
}
