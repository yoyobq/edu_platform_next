import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

type IssueInviteResponse = {
  expiresAt?: string | null;
  message?: string | null;
  recordId?: number | null;
  success: boolean;
  token?: string | null;
  type?: 'INVITE_STAFF' | 'INVITE_STUDENT' | null;
};

type IssueInviteResult = {
  expiresAt: string | null;
  message: string | null;
  recordId: number | null;
  token: string | null;
  type: 'INVITE_STAFF' | 'INVITE_STUDENT' | null;
};

const INVITE_STAFF_MUTATION = `
  mutation InviteStaff($input: InviteStaffInput!) {
    inviteStaff(input: $input) {
      expiresAt
      message
      recordId
      success
      token
      type
    }
  }
`;

const INVITE_STUDENT_MUTATION = `
  mutation InviteStudent($input: InviteStudentInput!) {
    inviteStudent(input: $input) {
      expiresAt
      message
      recordId
      success
      token
      type
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}

function normalizeIssueInviteResult(result: IssueInviteResponse): IssueInviteResult {
  return {
    expiresAt: result.expiresAt || null,
    message: result.message || null,
    recordId: result.recordId ?? null,
    token: result.token || null,
    type: result.type || null,
  };
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (isGraphQLIngressError(error)) {
    const firstError = error.graphqlErrors?.[0];
    const extensions = (firstError?.extensions as Record<string, unknown> | undefined) || {};

    if (typeof extensions.errorMessage === 'string') {
      return extensions.errorMessage;
    }

    return error.userMessage;
  }

  return error instanceof Error ? error.message : fallback;
}

export async function issueStaffInvite(input: { invitedEmail: string; staffId?: string }) {
  try {
    const response = await requestGraphQL<
      {
        inviteStaff: IssueInviteResponse;
      },
      {
        input: {
          invitedEmail: string;
          staffId?: string;
        };
      }
    >(INVITE_STAFF_MUTATION, {
      input,
    });

    if (!response.inviteStaff.success) {
      throw new Error(response.inviteStaff.message || '暂时无法签发教职工邀请。');
    }

    return normalizeIssueInviteResult(response.inviteStaff);
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法签发教职工邀请。'));
  }
}

export async function issueStudentInvite(input: { invitedEmail: string; studentId?: string }) {
  try {
    const response = await requestGraphQL<
      {
        inviteStudent: IssueInviteResponse;
      },
      {
        input: {
          invitedEmail: string;
          studentId?: string;
        };
      }
    >(INVITE_STUDENT_MUTATION, {
      input,
    });

    if (!response.inviteStudent.success) {
      throw new Error(response.inviteStudent.message || '暂时无法签发学生邀请。');
    }

    return normalizeIssueInviteResult(response.inviteStudent);
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法签发学生邀请。'));
  }
}
