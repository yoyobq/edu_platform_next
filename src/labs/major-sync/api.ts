// src/labs/major-sync/api.ts

import type { OperationVariables } from '@apollo/client';

import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import { normalizeRequiredTextValue } from '@/shared/form-normalization';
import { executeGraphQL } from '@/shared/graphql';

export { isExpiredUpstreamSessionError };

export type MajorSyncViewerRole = 'admin' | 'studentAffairsOfficer';

export type CurrentMajorSyncAccount = {
  accessGroup: readonly string[];
  accountId: number;
  displayName: string;
  staffId: string | null;
  viewerRole: MajorSyncViewerRole;
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
  existsCount: number;
  expiresAt: string | null;
  fetchedCount: number;
  items: Item[];
  skippedCount: number;
  updatedCount: number;
  upstreamSessionToken: string | null;
};

export type MajorSyncDryRunResult = MajorSyncResultBase<MajorSyncDryRunItem> & {
  dryRun: boolean;
  previewedCount: number;
};

export type MajorSyncCommitResult = MajorSyncResultBase<MajorSyncCommitItem> & {
  previewedCount?: number;
};

export type DryRunSyncMajorsFromUpstreamInput = {
  departmentId: string;
  upstreamSessionToken: string;
};

export type SyncMajorsFromUpstreamInput = DryRunSyncMajorsFromUpstreamInput;

type CurrentAccountResponse = {
  me: {
    accountId: number;
    identity:
      | {
          __typename: 'StaffType';
          id: string;
        }
      | {
          __typename: 'StudentType';
          id: string;
        }
      | null;
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

type StaffCurrentSlotPostDTO = {
  id: number;
  scope: {
    departmentId: string | null;
  };
  slotCode: string;
  status: string;
};

type StudentAffairsDepartmentScopeResponse = DepartmentsResponse & {
  staffCurrentSlotPosts: StaffCurrentSlotPostDTO[];
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
      identity {
        __typename
        ... on StaffType {
          id
        }
        ... on StudentType {
          id
        }
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

const STUDENT_AFFAIRS_DEPARTMENT_SCOPE_QUERY = `
  query MajorSyncStudentAffairsDepartmentScope($accountId: Int!, $limit: Int) {
    departments(limit: $limit) {
      departmentName
      id
      isEnabled
      shortName
    }
    staffCurrentSlotPosts(accountId: $accountId) {
      id
      scope {
        departmentId
      }
      slotCode
      status
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

function buildStudentAffairsDepartmentOptions(response: StudentAffairsDepartmentScopeResponse) {
  const departmentsById = new Map(
    response.departments
      .map(toDepartmentOption)
      .filter((department): department is MajorSyncDepartmentOption => Boolean(department))
      .map((department) => [department.id, department]),
  );
  const departmentIds = Array.from(
    new Set(
      response.staffCurrentSlotPosts
        .filter((post) => post.slotCode === 'STUDENT_AFFAIRS_OFFICER' && post.status === 'ACTIVE')
        .map((post) => post.scope.departmentId?.trim() || '')
        .filter((departmentId) => departmentId.length > 0),
    ),
  );

  return departmentIds.map(
    (departmentId) =>
      departmentsById.get(departmentId) ?? {
        departmentName: departmentId,
        id: departmentId,
        isEnabled: true,
        label: departmentId,
        shortName: null,
      },
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

function normalizeSyncInput(input: SyncMajorsFromUpstreamInput) {
  return normalizeDryRunInput(input);
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
      staffId: response.me.identity?.__typename === 'StaffType' ? response.me.identity.id : null,
      viewerRole: accessGroup.includes('ADMIN') ? 'admin' : 'studentAffairsOfficer',
    };
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法确认当前登录账号。'));
  }
}

export async function fetchMajorSyncDepartmentOptions(input: {
  accountId: number;
  viewerRole: MajorSyncViewerRole;
}) {
  try {
    if (input.viewerRole === 'admin') {
      const response = await requestGraphQL<DepartmentsResponse, { limit: number }>(
        DEPARTMENTS_QUERY,
        { limit: 500 },
      );

      return buildEnabledDepartmentOptions(response.departments);
    }

    const response = await requestGraphQL<
      StudentAffairsDepartmentScopeResponse,
      { accountId: number; limit: number }
    >(STUDENT_AFFAIRS_DEPARTMENT_SCOPE_QUERY, {
      accountId: input.accountId,
      limit: 500,
    });

    return buildStudentAffairsDepartmentOptions(response);
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
      input: ReturnType<typeof normalizeSyncInput>;
    }
  >(SYNC_MAJORS_FROM_UPSTREAM_MUTATION, {
    input: normalizeSyncInput(input),
  });

  return response.syncMajorsFromUpstream;
}

export function resolveMajorSyncErrorMessage(error: unknown) {
  return resolveUpstreamErrorMessage(error, '暂时无法预览专业同步。');
}
