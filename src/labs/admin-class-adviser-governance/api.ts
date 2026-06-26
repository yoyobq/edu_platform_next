// src/labs/admin-class-adviser-governance/api.ts

import type { OperationVariables } from '@apollo/client';

import { executeUpstreamSessionGraphQL } from '@/entities/upstream-session';

import {
  normalizeOptionalTextValue,
  normalizeRequiredTextValue,
} from '@/shared/form-normalization';
import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

export type ClassAdviserBindingStatus = 'ACTIVE' | 'INACTIVE';

export type ClassAdviserGovernanceActiveAdviser = {
  endAt: string | null;
  hasLocalStaff: boolean;
  isTemporary: boolean;
  postId: number | string;
  remarks: string | null;
  staffId: string;
  staffName: string | null;
  startAt: string | null;
};

export type ClassAdviserGovernanceClass = {
  activeAdvisers: ClassAdviserGovernanceActiveAdviser[];
  canAssign: boolean;
  classCode: string;
  classId: string;
  className: string;
  departmentId: string;
  gradeYear: number | null;
  lastObservedAt: string | null;
  studentCount: number;
};

export type LocalDepartmentOption = {
  departmentName: string;
  id: string;
  isEnabled: boolean;
  shortName: string | null;
};

export type TeacherDirectoryTeacher = {
  code: string;
  image: string;
  name: string;
  text: string;
  value: string;
};

export type TeacherDirectoryResult = {
  expiresAt: string;
  teachers: TeacherDirectoryTeacher[];
  upstreamSessionToken: string;
};

export type ListClassAdviserGovernanceClassesInput = {
  departmentId?: string | null;
  keyword?: string | null;
  onlyMissing?: boolean;
};

export type AssignClassAdviserByStaffIdInput = {
  classId: string;
  remarks?: string | null;
  staffId: string;
  staffName?: string | null;
};

export type AssignClassAdviserByStaffIdResult = {
  bindingStatus: ClassAdviserBindingStatus | null;
  changed: boolean;
  classCode: string;
  classId: string;
  className: string;
  hasLocalStaff: boolean;
  postId: number | string;
  staffId: string;
  staffName: string | null;
};

type ListClassAdviserGovernanceClassesResponse = {
  listClassAdviserGovernanceClasses: ClassAdviserGovernanceClass[];
};

type AssignClassAdviserByStaffIdResponse = {
  assignClassAdviserByStaffId: AssignClassAdviserByStaffIdResult;
};

type DepartmentsResponse = {
  departments: LocalDepartmentOption[];
};

type TeacherDirectoryResponse = {
  fetchTeacherDirectory: TeacherDirectoryResult;
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

const FETCH_TEACHER_DIRECTORY_QUERY = `
  query AdminClassAdviserGovernanceTeacherDirectory($sessionToken: String!) {
    fetchTeacherDirectory(sessionToken: $sessionToken) {
      expiresAt
      teachers {
        code
        image
        name
        text
        value
      }
      upstreamSessionToken
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

function compactInput<TValue extends Record<string, unknown>>(input: TValue) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<TValue>;
}

function assertMaxLength(value: string | undefined, maxLength: number, label: string) {
  if (value !== undefined && value.length > maxLength) {
    throw new Error(`${label}不能超过 ${maxLength} 个字符。`);
  }
}

function assertNoStaffIdForbiddenCharacters(value: string) {
  if (/\s/.test(value) || value.includes("'")) {
    throw new Error('教职工 ID 不能包含空白或单引号。');
  }
}

export function normalizeListClassAdviserGovernanceClassesInput(
  input: ListClassAdviserGovernanceClassesInput = {},
) {
  const departmentId = normalizeOptionalTextValue(input.departmentId, 'to_undefined');
  const keyword = normalizeOptionalTextValue(input.keyword, 'to_undefined');

  assertMaxLength(departmentId, 8, '系部 ID');
  assertMaxLength(keyword, 100, '关键词');

  return compactInput({
    departmentId,
    keyword,
    onlyMissing: input.onlyMissing === true ? true : undefined,
  });
}

export function normalizeAssignClassAdviserByStaffIdInput(input: AssignClassAdviserByStaffIdInput) {
  const classId = normalizeRequiredTextValue(input.classId, { label: '班级 ID' });
  const staffId = normalizeRequiredTextValue(input.staffId, { label: '教职工 ID' });
  const staffName = normalizeOptionalTextValue(input.staffName, 'to_undefined');
  const remarks = normalizeOptionalTextValue(input.remarks, 'to_undefined');

  assertMaxLength(classId, 8, '班级 ID');
  assertMaxLength(staffId, 8, '教职工 ID');
  assertMaxLength(staffName, 100, '班主任姓名');
  assertMaxLength(remarks, 500, '备注');
  assertNoStaffIdForbiddenCharacters(staffId);

  return compactInput({
    classId,
    remarks,
    staffId,
    staffName,
  });
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

export async function fetchTeacherDirectory(input: { upstreamSessionToken: string }) {
  const sessionToken = normalizeRequiredTextValue(input.upstreamSessionToken, {
    message: 'upstreamSessionToken 为必填。',
  });

  const response = await executeUpstreamSessionGraphQL<
    TeacherDirectoryResponse,
    {
      sessionToken: string;
    }
  >(FETCH_TEACHER_DIRECTORY_QUERY, {
    sessionToken,
  });

  return response.fetchTeacherDirectory;
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
