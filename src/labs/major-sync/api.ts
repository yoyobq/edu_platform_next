// src/labs/major-sync/api.ts

import type { OperationVariables } from '@apollo/client';

import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import { normalizeRequiredTextValue } from '@/shared/form-normalization';
import { executeGraphQL } from '@/shared/graphql';

export { isExpiredUpstreamSessionError };

export type CurrentMajorSyncAccount = {
  accessGroup: readonly string[];
  accountId: number;
  displayName: string;
};

export type MajorSyncDepartmentOption = {
  departmentName: string;
  id: string;
  isEnabled: boolean;
  label: string;
  shortName: string | null;
};

export type MajorSyncDryRunAction =
  | 'CREATE'
  | 'UPDATE'
  | 'EXISTS'
  | 'SKIPPED_DUPLICATE_UPSTREAM_NAME';

export type MajorSyncCommitAction =
  | 'CREATED'
  | 'UPDATED'
  | 'EXISTS'
  | 'SKIPPED_DUPLICATE_UPSTREAM_NAME';

export type MajorSyncItem<Action extends string> = {
  action: Action;
  departmentId: string;
  majorId: string | null;
  majorName: string;
  shortName: string | null;
  trainingLevel: string | null;
  trainingYears: number | null;
};

export type MajorSyncDryRunItem = MajorSyncItem<MajorSyncDryRunAction>;

export type MajorSyncCommitItem = MajorSyncItem<MajorSyncCommitAction>;

type MajorSyncResultBase<Item> = {
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

export type MajorSyncDryRunResult = MajorSyncResultBase<MajorSyncDryRunItem> & {
  previewedCount: number;
};

export type MajorSyncCommitResult = MajorSyncResultBase<MajorSyncCommitItem> & {
  processedCount: number;
};

export type DryRunSyncMajorsFromUpstreamInput = {
  departmentId: string;
  upstreamSessionToken: string;
};

export type SyncMajorsFromUpstreamInput = DryRunSyncMajorsFromUpstreamInput;

type CurrentAccountResponse = {
  me: {
    accountId: number;
    userInfo: {
      accessGroup: string[];
      nickname: string | null;
    };
  };
};

type DepartmentDTO = {
  departmentName: string;
  id: string;
  isEnabled: boolean;
  shortName: string | null;
};

type DepartmentsResponse = {
  departments: DepartmentDTO[];
};

type DryRunSyncMajorsFromUpstreamResponse = {
  dryRunSyncMajorsFromUpstream: MajorSyncDryRunResult;
};

type SyncMajorsFromUpstreamResponse = {
  syncMajorsFromUpstream: MajorSyncCommitResult;
};

const CURRENT_ACCOUNT_QUERY = `
  query MajorSyncCurrentAccount {
    me {
      accountId
      userInfo {
        accessGroup
        nickname
      }
    }
  }
`;

const DEPARTMENTS_QUERY = `
  query MajorSyncDepartments($limit: Int) {
    departments(limit: $limit) {
      departmentName
      id
      isEnabled
      shortName
    }
  }
`;

const DRY_RUN_SYNC_MAJORS_FROM_UPSTREAM_MUTATION = `
  mutation DryRunSyncMajorsFromUpstream($input: DryRunSyncMajorsFromUpstreamInput!) {
    dryRunSyncMajorsFromUpstream(input: $input) {
      dryRun
      upstreamSessionToken
      expiresAt
      departmentId
      fetchedCount
      previewedCount
      createdCount
      updatedCount
      existsCount
      skippedCount
      items {
        action
        departmentId
        majorId
        majorName
        shortName
        trainingYears
        trainingLevel
      }
    }
  }
`;

const SYNC_MAJORS_FROM_UPSTREAM_MUTATION = `
  mutation SyncMajorsFromUpstream($input: SyncMajorsFromUpstreamInput!) {
    syncMajorsFromUpstream(input: $input) {
      dryRun
      upstreamSessionToken
      expiresAt
      departmentId
      fetchedCount
      processedCount
      createdCount
      updatedCount
      existsCount
      skippedCount
      items {
        action
        departmentId
        majorId
        majorName
        shortName
        trainingYears
        trainingLevel
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

function buildDepartmentLabel(
  department: Pick<DepartmentDTO, 'departmentName' | 'id' | 'shortName'>,
) {
  const name = department.departmentName?.trim() || department.id;

  return department.shortName?.trim() ? `${name} (${department.shortName.trim()})` : name;
}

function toDepartmentOption(department: DepartmentDTO): MajorSyncDepartmentOption | null {
  const id = department.id.trim();

  if (!id) {
    return null;
  }

  return {
    departmentName: department.departmentName?.trim() || id,
    id,
    isEnabled: department.isEnabled,
    label: buildDepartmentLabel({ ...department, id }),
    shortName: department.shortName?.trim() || null,
  };
}

function buildEnabledDepartmentOptions(departments: readonly DepartmentDTO[]) {
  return departments
    .map(toDepartmentOption)
    .filter((department): department is MajorSyncDepartmentOption =>
      Boolean(department && department.isEnabled),
    );
}

function normalizeDryRunInput(input: DryRunSyncMajorsFromUpstreamInput) {
  return {
    departmentId: normalizeRequiredTextValue(input.departmentId, { label: '系部' }),
    upstreamSessionToken: normalizeRequiredTextValue(input.upstreamSessionToken, {
      message: 'upstreamSessionToken 为必填。',
    }),
  };
}

export async function fetchCurrentMajorSyncAccount(): Promise<CurrentMajorSyncAccount> {
  try {
    const response = await requestGraphQL<CurrentAccountResponse, Record<string, never>>(
      CURRENT_ACCOUNT_QUERY,
      {},
    );
    const accessGroup = response.me.userInfo.accessGroup;

    return {
      accessGroup,
      accountId: response.me.accountId,
      displayName: response.me.userInfo.nickname?.trim() || `account-${response.me.accountId}`,
    };
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法确认当前登录账号。'));
  }
}

export async function fetchMajorSyncDepartmentOptions() {
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

export async function dryRunSyncMajorsFromUpstream(input: DryRunSyncMajorsFromUpstreamInput) {
  const response = await requestGraphQL<
    DryRunSyncMajorsFromUpstreamResponse,
    {
      input: ReturnType<typeof normalizeDryRunInput>;
    }
  >(DRY_RUN_SYNC_MAJORS_FROM_UPSTREAM_MUTATION, {
    input: normalizeDryRunInput(input),
  });

  return response.dryRunSyncMajorsFromUpstream;
}

export async function syncMajorsFromUpstream(input: SyncMajorsFromUpstreamInput) {
  const response = await requestGraphQL<
    SyncMajorsFromUpstreamResponse,
    {
      input: ReturnType<typeof normalizeDryRunInput>;
    }
  >(SYNC_MAJORS_FROM_UPSTREAM_MUTATION, {
    input: normalizeDryRunInput(input),
  });

  return response.syncMajorsFromUpstream;
}

export function resolveMajorSyncErrorMessage(error: unknown) {
  return resolveUpstreamErrorMessage(error, '暂时无法执行专业同步。');
}
