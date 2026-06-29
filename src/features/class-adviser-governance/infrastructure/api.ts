// src/features/class-adviser-governance/infrastructure/api.ts

import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

import {
  normalizeAssignClassAdviserByStaffIdInput,
  normalizeListClassAdviserGovernanceClassesInput,
} from '../application/input-normalization';
import type {
  AssignClassAdviserByStaffIdInput,
  AssignClassAdviserByStaffIdResult,
  ClassAdviserGovernanceClass,
  ListClassAdviserGovernanceClassesInput,
  LocalDepartmentOption,
} from '../application/types';

type ListClassAdviserGovernanceClassesResponse = {
  listClassAdviserGovernanceClasses: ClassAdviserGovernanceClass[];
};

type AssignClassAdviserByStaffIdResponse = {
  assignClassAdviserByStaffId: AssignClassAdviserByStaffIdResult;
};

type DepartmentsResponse = {
  departments: LocalDepartmentOption[];
};

const DEPARTMENTS_QUERY = `
  query AdminClassAdviserGovernanceDepartments($isEnabled: Boolean, $limit: Int) {
    departments(isEnabled: $isEnabled, limit: $limit) {
      id
      departmentName
      isEnabled
      shortName
    }
  }
`;

const LIST_CLASS_ADVISER_GOVERNANCE_CLASSES_QUERY = `
  query AdminClassAdviserGovernance($input: ListClassAdviserGovernanceClassesInput) {
    listClassAdviserGovernanceClasses(input: $input) {
      classId
      classCode
      className
      departmentId
      gradeYear
      studentCount
      lastObservedAt
      canAssign
      activeAdvisers {
        postId
        staffId
        staffName
        hasLocalStaff
        isTemporary
        startAt
        endAt
        remarks
      }
    }
  }
`;

const ASSIGN_CLASS_ADVISER_BY_STAFF_ID_MUTATION = `
  mutation AssignClassAdviserByStaffId($input: AssignClassAdviserByStaffIdInput!) {
    assignClassAdviserByStaffId(input: $input) {
      changed
      classId
      classCode
      className
      staffId
      staffName
      postId
      hasLocalStaff
      bindingStatus
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}

export function resolveClassAdviserGovernanceErrorMessage(error: unknown, fallback: string) {
  if (isGraphQLIngressError(error)) {
    const firstMessage = error.graphqlErrors?.find((item) => item.message.trim())?.message.trim();

    return firstMessage || error.userMessage || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

export async function listLocalDepartmentOptions() {
  try {
    const response = await requestGraphQL<
      DepartmentsResponse,
      {
        isEnabled: boolean;
        limit: number;
      }
    >(DEPARTMENTS_QUERY, {
      isEnabled: true,
      limit: 500,
    });

    return response.departments;
  } catch (error) {
    throw new Error(resolveClassAdviserGovernanceErrorMessage(error, '暂时无法加载系部列表。'));
  }
}

export async function listClassAdviserGovernanceClasses(
  input: ListClassAdviserGovernanceClassesInput = {},
) {
  const response = await requestGraphQL<
    ListClassAdviserGovernanceClassesResponse,
    {
      input: ReturnType<typeof normalizeListClassAdviserGovernanceClassesInput>;
    }
  >(LIST_CLASS_ADVISER_GOVERNANCE_CLASSES_QUERY, {
    input: normalizeListClassAdviserGovernanceClassesInput(input),
  });

  return response.listClassAdviserGovernanceClasses;
}

export async function assignClassAdviserByStaffId(input: AssignClassAdviserByStaffIdInput) {
  const response = await requestGraphQL<
    AssignClassAdviserByStaffIdResponse,
    {
      input: ReturnType<typeof normalizeAssignClassAdviserByStaffIdInput>;
    }
  >(ASSIGN_CLASS_ADVISER_BY_STAFF_ID_MUTATION, {
    input: normalizeAssignClassAdviserByStaffIdInput(input),
  });

  return response.assignClassAdviserByStaffId;
}
