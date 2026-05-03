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

type AdminRequestPasswordResetEmailResponse = {
  message?: string | null;
  success: boolean;
};

type IssueInviteResult = {
  expiresAt: string | null;
  message: string | null;
  recordId: number | null;
  token: string | null;
  type: 'INVITE_STAFF' | 'INVITE_STUDENT' | null;
};

type AdminRequestPasswordResetEmailResult = {
  message: string | null;
  success: boolean;
};

export type IssueMailCurrentAccount = {
  accountId: number;
  displayName: string;
};

export type IssueMailUserListItem = {
  account: {
    createdAt: string;
    id: number;
    identityHint: string | null;
    loginEmail: string | null;
    loginName: string | null;
    status: string;
  };
  staff: {
    departmentId: string | null;
    employmentStatus: string;
    id: string;
    jobTitle: string | null;
    name: string;
  } | null;
  slotGroups: readonly {
    code: string;
    name: string;
  }[];
  userInfo: {
    accessGroup: readonly string[];
    avatarUrl: string | null;
    nickname: string;
    phone: string | null;
    userState: string;
  };
};

export type IssueMailUserListResult = {
  current: number;
  list: readonly IssueMailUserListItem[];
  pageSize: number;
  total: number;
};

type CurrentAccountResponse = {
  me: {
    accountId: number;
    userInfo: {
      nickname: string | null;
    };
  } | null;
};

type IssueMailUsersResponse = {
  adminUsers: IssueMailUserListResult;
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

const ADMIN_REQUEST_PASSWORD_RESET_EMAIL_MUTATION = `
  mutation AdminRequestPasswordResetEmail($input: AdminRequestPasswordResetEmailInput!) {
    adminRequestPasswordResetEmail(input: $input) {
      message
      success
    }
  }
`;

const CURRENT_ACCOUNT_QUERY = `
  query Me {
    me {
      accountId
      userInfo {
        nickname
      }
    }
  }
`;

const ISSUE_MAIL_USERS_QUERY = `
  query AdminUsers(
    $accessGroups: [IdentityTypeEnum!]
    $limit: Int!
    $page: Int!
    $query: String
    $sortBy: String!
    $sortOrder: SortDirection!
  ) {
    adminUsers(
      accessGroups: $accessGroups
      limit: $limit
      page: $page
      query: $query
      sortBy: $sortBy
      sortOrder: $sortOrder
    ) {
      current
      pageSize
      total
      list {
        account {
          createdAt
          id
          identityHint
          loginEmail
          loginName
          status
        }
        slotGroups {
          code
          name
        }
        userInfo {
          accessGroup
          avatarUrl
          nickname
          phone
          userState
        }
        staff {
          departmentId
          employmentStatus
          id
          jobTitle
          name
        }
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

function normalizeIssueInviteResult(result: IssueInviteResponse): IssueInviteResult {
  return {
    expiresAt: result.expiresAt || null,
    message: result.message || null,
    recordId: result.recordId ?? null,
    token: result.token || null,
    type: result.type || null,
  };
}

function normalizeAdminRequestPasswordResetEmailResult(
  result: AdminRequestPasswordResetEmailResponse,
): AdminRequestPasswordResetEmailResult {
  return {
    message: result.message || null,
    success: result.success,
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

export async function adminRequestPasswordResetEmail(input: { accountId: number }) {
  try {
    const response = await requestGraphQL<
      {
        adminRequestPasswordResetEmail: AdminRequestPasswordResetEmailResponse;
      },
      {
        input: {
          accountId: number;
        };
      }
    >(ADMIN_REQUEST_PASSWORD_RESET_EMAIL_MUTATION, {
      input,
    });

    const result = normalizeAdminRequestPasswordResetEmailResult(
      response.adminRequestPasswordResetEmail,
    );

    if (!result.success) {
      throw new Error(result.message || '暂时无法为指定账号发送老用户回归密码设置邮件。');
    }

    return result;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法为指定账号发送老用户回归密码设置邮件。'));
  }
}

export async function fetchIssueMailCurrentAccount(): Promise<IssueMailCurrentAccount> {
  try {
    const response = await requestGraphQL<CurrentAccountResponse, OperationVariables>(
      CURRENT_ACCOUNT_QUERY,
      {},
    );

    if (!response.me) {
      throw new Error('当前登录账号尚未就绪。');
    }

    return {
      accountId: response.me.accountId,
      displayName: response.me.userInfo.nickname || `account-${response.me.accountId}`,
    };
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法读取当前账号。'));
  }
}

export async function requestIssueMailUsers(input: {
  limit: number;
  page: number;
  query?: string;
}): Promise<IssueMailUserListResult> {
  try {
    const response = await requestGraphQL<
      IssueMailUsersResponse,
      {
        accessGroups: readonly string[];
        limit: number;
        page: number;
        query?: string;
        sortBy: string;
        sortOrder: string;
      }
    >(ISSUE_MAIL_USERS_QUERY, {
      accessGroups: ['ADMIN', 'STAFF'],
      limit: input.limit,
      page: input.page,
      query: input.query?.trim() || undefined,
      sortBy: 'id',
      sortOrder: 'DESC',
    });

    return response.adminUsers;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法加载已有用户列表。'));
  }
}
