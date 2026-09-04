import {
  type AdminUserAccountStatus,
  type AdminUserEmploymentStatus,
  type AdminUserListItem,
  type AdminUserListQuery,
  type AdminUserListResult,
  type AdminUserSortField,
  type AdminUserSortOrder,
  type AdminUserState,
  normalizeAdminUserListQuery,
} from '@/entities/admin-user';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

type IssueInviteResponse = {
  expiresAt?: string | null;
  message?: string | null;
  recordId?: number | null;
  success: boolean;
  token?: string | null;
  type?: 'INVITE_STAFF' | null;
};

type AdminRequestPasswordResetEmailResponse = {
  message?: string | null;
  success: boolean;
};

type AdminRequestChangeLoginEmailResponse = {
  message?: string | null;
  success: boolean;
};

type IssueStudentRegistrationLinkResponse = {
  classCode: string;
  expiresAt: string;
  link: string;
  recordId: number;
  studentId?: string | null;
  success: boolean;
  token: string;
};

type LocalClassOptionResponse = {
  classCode: string;
  className: string;
  departmentId: string;
  gradeYear: number | null;
  id: string;
};

export type IssueInviteResult = {
  expiresAt: string | null;
  message: string | null;
  recordId: number | null;
  token: string | null;
  type: 'INVITE_STAFF' | null;
};

export type AdminRequestPasswordResetEmailResult = {
  message: string | null;
  success: boolean;
};

export type AdminRequestChangeLoginEmailResult = {
  message: string | null;
  success: boolean;
};

export type VerificationIssuanceClassOption = LocalClassOptionResponse;

export type VerificationStudentRegistrationLinkResult = {
  classCode: string;
  expiresAt: string;
  link: string;
  recordId: number;
  token: string;
};

export type VerificationIssuanceCurrentAccount = {
  accountId: number;
  displayName: string;
};

type CurrentAccountResponse = {
  me: {
    accountId: number;
  } | null;
};

type AdminUsersQueryResponse = {
  adminUsers: {
    current: number;
    list: AdminUserListItemDTO[];
    pageSize: number;
    total: number;
  };
};

type AdminUserListItemDTO = {
  account: {
    createdAt: string;
    id: number;
    identityHint: string | null;
    loginEmail: string | null;
    loginName: string | null;
    status: AdminUserAccountStatus;
  };
  staff: {
    departmentId: string | null;
    employmentStatus: AdminUserEmploymentStatus;
    id: string;
    jobTitle: string | null;
    name: string;
  } | null;
  slotGroups: readonly {
    code: string;
    name: string;
  }[];
  userInfo: {
    accessGroup: AdminUserListItem['userInfo']['accessGroup'];
    avatarUrl: string | null;
    nickname: string;
    phone: string | null;
    userState: AdminUserState;
  };
};

type AdminUsersQueryVariables = {
  accessGroups?: readonly string[];
  hasStaff?: boolean;
  limit: number;
  page: number;
  query?: string;
  sortBy: AdminUserSortField;
  sortOrder: AdminUserSortOrder;
  status?: AdminUserAccountStatus;
};

type LocalClassOptionsResponse = {
  listLocalClassOptions: LocalClassOptionResponse[];
};

const ADMIN_USERS_QUERY = `
  query VerificationAccountPickerAdminUsers(
    $accessGroups: [IdentityTypeEnum!]
    $hasStaff: Boolean
    $limit: Int!
    $page: Int!
    $query: String
    $sortBy: String!
    $sortOrder: SortDirection!
    $status: AccountStatus
  ) {
    adminUsers(
      accessGroups: $accessGroups
      hasStaff: $hasStaff
      limit: $limit
      page: $page
      query: $query
      sortBy: $sortBy
      sortOrder: $sortOrder
      status: $status
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

const LOCAL_CLASS_OPTIONS_QUERY = `
  query VerificationIssuanceLocalClassOptions($input: ListLocalClassOptionsInput) {
    listLocalClassOptions(input: $input) {
      id
      departmentId
      classCode
      className
      gradeYear
    }
  }
`;

const ISSUE_STUDENT_REGISTRATION_LINK_MUTATION = `
  mutation VerificationIssuanceStudentRegistrationLink(
    $input: IssueStudentRegistrationLinkInput!
  ) {
    issueStudentRegistrationLink(input: $input) {
      success
      link
      token
      recordId
      expiresAt
      classCode
      studentId
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

const ADMIN_REQUEST_CHANGE_LOGIN_EMAIL_MUTATION = `
  mutation AdminRequestChangeLoginEmail($input: AdminRequestChangeLoginEmailInput!) {
    adminRequestChangeLoginEmail(input: $input) {
      message
      success
    }
  }
`;

const CURRENT_ACCOUNT_QUERY = `
  query Me {
    me {
      accountId
    }
  }
`;

function mapAdminUserListItem(dto: AdminUserListItemDTO): AdminUserListItem {
  return {
    account: dto.account,
    staff: dto.staff,
    slotGroups: dto.slotGroups,
    userInfo: dto.userInfo,
  };
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

function normalizeAdminRequestChangeLoginEmailResult(
  result: AdminRequestChangeLoginEmailResponse,
): AdminRequestChangeLoginEmailResult {
  return {
    message: result.message || null,
    success: result.success,
  };
}

export function resolveVerificationIssuanceErrorMessage(error: unknown, fallback: string) {
  if (isGraphQLIngressError(error)) {
    const firstError = error.graphqlErrors?.[0];
    const extensions = (firstError?.extensions as Record<string, unknown> | undefined) || {};

    if (typeof extensions.errorMessage === 'string') {
      return extensions.errorMessage;
    }

    if (extensions.errorCode === 'INVITE_ISSUE_FAILED') {
      return '邀请邮件发送失败，系统已撤销该邀请，请稍后重试或联系管理员。';
    }

    return error.userMessage;
  }

  return error instanceof Error ? error.message : fallback;
}

export async function requestVerificationAccountPickerUsers(
  input: AdminUserListQuery,
): Promise<AdminUserListResult> {
  const query = normalizeAdminUserListQuery(input);
  const response = await executeGraphQL<AdminUsersQueryResponse, AdminUsersQueryVariables>(
    ADMIN_USERS_QUERY,
    {
      accessGroups: query.accessGroups,
      hasStaff: query.hasStaff,
      limit: query.limit ?? 50,
      page: query.page ?? 1,
      query: query.query,
      sortBy: query.sortBy ?? 'createdAt',
      sortOrder: query.sortOrder ?? 'DESC',
      status: query.status,
    },
  );

  return {
    current: response.adminUsers.current,
    list: response.adminUsers.list.map(mapAdminUserListItem),
    pageSize: response.adminUsers.pageSize,
    total: response.adminUsers.total,
  };
}

export async function issueVerificationStaffInvite(input: {
  invitedEmail: string;
  staffId: string;
}) {
  try {
    const response = await executeGraphQL<
      {
        inviteStaff: IssueInviteResponse;
      },
      {
        input: {
          invitedEmail: string;
          staffId: string;
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
    throw new Error(resolveVerificationIssuanceErrorMessage(error, '暂时无法签发教职工邀请。'));
  }
}

export async function requestVerificationIssuanceClassOptions(): Promise<
  VerificationIssuanceClassOption[]
> {
  try {
    const response = await executeGraphQL<
      LocalClassOptionsResponse,
      { input: Record<string, never> }
    >(LOCAL_CLASS_OPTIONS_QUERY, { input: {} });

    return response.listLocalClassOptions;
  } catch (error) {
    throw new Error(resolveVerificationIssuanceErrorMessage(error, '暂时无法加载班级列表。'));
  }
}

export async function issueVerificationStudentRegistrationLink(input: {
  classCode: string;
}): Promise<VerificationStudentRegistrationLinkResult> {
  try {
    const response = await executeGraphQL<
      { issueStudentRegistrationLink: IssueStudentRegistrationLinkResponse },
      { input: { classCode: string } }
    >(ISSUE_STUDENT_REGISTRATION_LINK_MUTATION, {
      input: { classCode: input.classCode.trim() },
    });
    const result = response.issueStudentRegistrationLink;

    if (!result.success || result.studentId) {
      throw new Error('暂时无法签发班级共享注册链接。');
    }

    return {
      classCode: result.classCode,
      expiresAt: result.expiresAt,
      link: result.link,
      recordId: result.recordId,
      token: result.token,
    };
  } catch (error) {
    throw new Error(
      resolveVerificationIssuanceErrorMessage(error, '暂时无法签发班级共享注册链接。'),
    );
  }
}

export async function adminRequestVerificationPasswordResetEmail(input: { accountId: number }) {
  try {
    const response = await executeGraphQL<
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
    throw new Error(
      resolveVerificationIssuanceErrorMessage(
        error,
        '暂时无法为指定账号发送老用户回归密码设置邮件。',
      ),
    );
  }
}

export async function adminRequestVerificationChangeLoginEmail(input: {
  accountId: number;
  newLoginEmail: string;
}) {
  try {
    const response = await executeGraphQL<
      {
        adminRequestChangeLoginEmail: AdminRequestChangeLoginEmailResponse;
      },
      {
        input: {
          accountId: number;
          newLoginEmail: string;
        };
      }
    >(ADMIN_REQUEST_CHANGE_LOGIN_EMAIL_MUTATION, {
      input,
    });

    const result = normalizeAdminRequestChangeLoginEmailResult(
      response.adminRequestChangeLoginEmail,
    );

    if (!result.success) {
      throw new Error(result.message || '暂时无法为指定账号发送登录邮箱变更验证邮件。');
    }

    return result;
  } catch (error) {
    throw new Error(
      resolveVerificationIssuanceErrorMessage(
        error,
        '暂时无法为指定账号发送登录邮箱变更验证邮件。',
      ),
    );
  }
}

export async function fetchVerificationIssuanceCurrentAccount(): Promise<VerificationIssuanceCurrentAccount> {
  try {
    const response = await executeGraphQL<CurrentAccountResponse, Record<string, never>>(
      CURRENT_ACCOUNT_QUERY,
      {},
    );

    if (!response.me) {
      throw new Error('当前登录账号尚未就绪。');
    }

    return {
      accountId: response.me.accountId,
      displayName: `account-${response.me.accountId}`,
    };
  } catch (error) {
    throw new Error(resolveVerificationIssuanceErrorMessage(error, '暂时无法读取当前账号。'));
  }
}
