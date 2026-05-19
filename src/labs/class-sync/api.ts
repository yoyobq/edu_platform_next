// src/labs/class-sync/api.ts

import type { OperationVariables } from '@apollo/client';

import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import { normalizeRequiredTextValue } from '@/shared/form-normalization';
import { executeGraphQL } from '@/shared/graphql';

export { isExpiredUpstreamSessionError };

export type ClassSyncViewerRole = 'admin' | 'studentAffairsOfficer';

export type CurrentClassSyncAccount = {
  accessGroup: readonly string[];
  accountId: number;
  displayName: string;
  staffId: string | null;
  viewerRole: ClassSyncViewerRole;
};

export type ClassSyncDepartmentOption = {
  departmentName: string;
  id: string;
  isEnabled: boolean;
  label: string;
  shortName: string | null;
};

export type ClassSyncDryRunAction =
  | 'CREATE'
  | 'UPDATE'
  | 'EXISTS'
  | 'CONFLICT'
  | 'SKIPPED_INVALID_UPSTREAM_CODE'
  | 'SKIPPED_DUPLICATE_UPSTREAM_CODE';

export type ClassSyncAnnualMajorClassListDryRunAction =
  | ClassSyncDryRunAction
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
  classId: string | null;
  className: string;
  conflictReason: string | null;
  departmentId: string;
  gradeYear: number | null;
  majorId: string | null;
  majorName?: string | null;
  sortOrder: number | null;
};

export type ClassSyncDryRunItem = ClassSyncItem<ClassSyncDryRunAction>;

export type ClassSyncAnnualMajorClassListDryRunItem =
  ClassSyncItem<ClassSyncAnnualMajorClassListDryRunAction> & {
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

export type ClassSyncAnnualMajorClassListDryRunResult =
  ClassSyncResultBase<ClassSyncAnnualMajorClassListDryRunItem> & {
    previewedCount: number;
  };

export type ClassSyncCommitResult = ClassSyncResultBase<ClassSyncCommitItem> & {
  processedCount: number;
};

export type DryRunSyncClassesFromUpstreamInput = {
  departmentId: string;
  upstreamSessionToken: string;
};

export type DryRunSyncClassesFromAnnualMajorClassListInput = DryRunSyncClassesFromUpstreamInput;

export type SyncClassesFromUpstreamInput = DryRunSyncClassesFromUpstreamInput;

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

type DryRunSyncClassesFromUpstreamResponse = {
  dryRunSyncClassesFromUpstream: ClassSyncDryRunResult;
};

type DryRunSyncClassesFromAnnualMajorClassListResponse = {
  dryRunSyncClassesFromAnnualMajorClassList: ClassSyncAnnualMajorClassListDryRunResult;
};

type SyncClassesFromUpstreamResponse = {
  syncClassesFromUpstream: ClassSyncCommitResult;
};

const CURRENT_ACCOUNT_QUERY = `
  query ClassSyncCurrentAccount {
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
  query ClassSyncDepartments($limit: Int) {
    departments(limit: $limit) {
      departmentName
      id
      isEnabled
      shortName
    }
  }
`;

const STUDENT_AFFAIRS_DEPARTMENT_SCOPE_QUERY = `
  query ClassSyncStudentAffairsDepartmentScope($accountId: Int!, $limit: Int) {
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
        className
        majorId
        gradeYear
        sortOrder
        conflictReason
      }
    }
  }
`;

const DRY_RUN_SYNC_CLASSES_FROM_ANNUAL_MAJOR_CLASS_LIST_MUTATION = `
  mutation DryRunSyncClassesFromAnnualMajorClassList(
    $input: DryRunSyncClassesFromAnnualMajorClassListInput!
  ) {
    dryRunSyncClassesFromAnnualMajorClassList(input: $input) {
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

function buildDepartmentLabel(
  department: Pick<DepartmentDTO, 'departmentName' | 'id' | 'shortName'>,
) {
  const name = department.departmentName?.trim() || department.id;

  return department.shortName?.trim() ? `${name} (${department.shortName.trim()})` : name;
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
    label: buildDepartmentLabel({ ...department, id }),
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

function buildStudentAffairsDepartmentOptions(response: StudentAffairsDepartmentScopeResponse) {
  const departmentsById = new Map(
    response.departments
      .map(toDepartmentOption)
      .filter((department): department is ClassSyncDepartmentOption => Boolean(department))
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

function normalizeDryRunInput(input: DryRunSyncClassesFromUpstreamInput) {
  return {
    departmentId: normalizeRequiredTextValue(input.departmentId, { label: '系部' }),
    upstreamSessionToken: normalizeRequiredTextValue(input.upstreamSessionToken, {
      message: 'upstreamSessionToken 为必填。',
    }),
  };
}

export async function fetchCurrentClassSyncAccount(): Promise<CurrentClassSyncAccount> {
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

export async function fetchClassSyncDepartmentOptions(input: {
  accountId: number;
  viewerRole: ClassSyncViewerRole;
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

export async function dryRunSyncClassesFromAnnualMajorClassList(
  input: DryRunSyncClassesFromAnnualMajorClassListInput,
) {
  const response = await requestGraphQL<
    DryRunSyncClassesFromAnnualMajorClassListResponse,
    {
      input: ReturnType<typeof normalizeDryRunInput>;
    }
  >(DRY_RUN_SYNC_CLASSES_FROM_ANNUAL_MAJOR_CLASS_LIST_MUTATION, {
    input: normalizeDryRunInput(input),
  });

  return response.dryRunSyncClassesFromAnnualMajorClassList;
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
