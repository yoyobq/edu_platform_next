import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
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

// ---------------------------------------------------------------------------
// myProfileBasic
// ---------------------------------------------------------------------------

const MY_PROFILE_BASIC_QUERY = `
  query MyProfileBasic {
    myProfileBasic {
      account {
        id
        loginEmail
        loginName
        recentLoginHistory {
          audience
          ip
          timestamp
        }
      }
      userInfo {
        accountId
        accessGroup
        nickname
        email
        phone
        gender
        avatarUrl
        address
        birthDate
        geographic {
          city
          province
        }
        signature
        tags
        userState
      }
    }
  }
`;

type GeographicInfo = {
  city: string | null;
  province: string | null;
};

type LoginHistoryItem = {
  audience: string | null;
  ip: string;
  timestamp: string;
};

export type MyProfileAccount = {
  id: number;
  loginEmail: string | null;
  loginName: string | null;
  recentLoginHistory: LoginHistoryItem[] | null;
};

export type MyProfileUserInfo = {
  accountId: number;
  accessGroup: string[];
  nickname: string;
  email: string | null;
  phone: string | null;
  gender: string;
  avatarUrl: string | null;
  address: string | null;
  birthDate: string | null;
  geographic: GeographicInfo | null;
  signature: string | null;
  tags: string[] | null;
  userState: string;
};

export type MyProfileBasicData = {
  account: MyProfileAccount;
  userInfo: MyProfileUserInfo;
};

export async function fetchMyProfileBasic(): Promise<MyProfileBasicData> {
  try {
    const response = await requestGraphQL<
      { myProfileBasic: MyProfileBasicData },
      Record<string, never>
    >(MY_PROFILE_BASIC_QUERY, {});

    return response.myProfileBasic;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '无法加载个人基本资料。'));
  }
}

// ---------------------------------------------------------------------------
// myProfileIdentity
// ---------------------------------------------------------------------------

const MY_PROFILE_IDENTITY_QUERY = `
  query MyProfileIdentity {
    myProfileIdentity {
      __typename
      ... on MyProfileStaffIdentityDTO {
        id
        accountId
        name
        departmentId
        employmentStatus
        jobTitle
        remark
      }
      ... on MyProfileStudentIdentityDTO {
        id
        accountId
        name
        classId
        studentStatus
        remarks
      }
    }
  }
`;

export type MyProfileStaffIdentity = {
  __typename: 'MyProfileStaffIdentityDTO';
  id: string;
  accountId: number;
  name: string;
  departmentId: string | null;
  employmentStatus: string;
  jobTitle: string | null;
  remark: string | null;
};

export type MyProfileStudentIdentity = {
  __typename: 'MyProfileStudentIdentityDTO';
  id: string;
  accountId: number;
  name: string;
  classId: number | null;
  studentStatus: string;
  remarks: string | null;
};

export type MyProfileIdentityData = MyProfileStaffIdentity | MyProfileStudentIdentity;

export async function fetchMyProfileIdentity(): Promise<MyProfileIdentityData | null> {
  try {
    const response = await requestGraphQL<
      { myProfileIdentity: MyProfileIdentityData | null },
      Record<string, never>
    >(MY_PROFILE_IDENTITY_QUERY, {});

    return response.myProfileIdentity;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '无法加载身份信息。'));
  }
}

// ---------------------------------------------------------------------------
// updateMyUserInfo (self)
// ---------------------------------------------------------------------------

const UPDATE_MY_USER_INFO_MUTATION = `
  mutation UpdateMyUserInfo($input: UpdateMyUserInfoInput!) {
    updateMyUserInfo(input: $input) {
      isUpdated
      userInfo {
        accountId
        accessGroup
        nickname
        email
        phone
        gender
        avatarUrl
        address
        birthDate
        geographic {
          city
          province
        }
        signature
        tags
        userState
      }
    }
  }
`;

export type UpdateMyUserInfoInput = {
  address: string | null;
  birthDate: string | null;
  email: string | null;
  gender: MyProfileUserInfo['gender'];
  geographic: {
    city?: string;
    province?: string;
  } | null;
  nickname: string;
  phone: string | null;
  signature: string | null;
  tags: string[];
};

type UpdateMyUserInfoResponse = {
  updateMyUserInfo: {
    isUpdated: boolean;
    userInfo: MyProfileUserInfo;
  };
};

type UpdateMyUserInfoVariables = {
  input: UpdateMyUserInfoInput;
};

function normalizeRequiredTextValue(value: string): string {
  return value.trim();
}

function normalizeOptionalTextValue(value: string | null | undefined): string | null {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function normalizeTagsValue(tags: string[]): string[] {
  return tags
    .map((tag) => tag.trim())
    .filter((tag, index, values) => tag.length > 0 && values.indexOf(tag) === index);
}

export async function updateMyUserInfo(input: UpdateMyUserInfoInput) {
  try {
    const response = await requestGraphQL<UpdateMyUserInfoResponse, UpdateMyUserInfoVariables>(
      UPDATE_MY_USER_INFO_MUTATION,
      {
        input: {
          address: normalizeOptionalTextValue(input.address),
          birthDate: normalizeOptionalTextValue(input.birthDate),
          email: normalizeOptionalTextValue(input.email),
          gender: input.gender,
          geographic: input.geographic,
          nickname: normalizeRequiredTextValue(input.nickname),
          phone: normalizeOptionalTextValue(input.phone),
          signature: normalizeOptionalTextValue(input.signature),
          tags: normalizeTagsValue(input.tags),
        },
      },
    );

    return response.updateMyUserInfo;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法更新基本资料。'));
  }
}

// ---------------------------------------------------------------------------
// requestChangeLoginEmail (self)
// ---------------------------------------------------------------------------

const REQUEST_CHANGE_LOGIN_EMAIL_MUTATION = `
  mutation RequestChangeLoginEmail($input: RequestChangeLoginEmailInput!) {
    requestChangeLoginEmail(input: $input) {
      message
      success
    }
  }
`;

type SuccessResponse = {
  message?: string | null;
  success: boolean;
};

export async function requestChangeLoginEmailSelf(newLoginEmail: string) {
  try {
    const response = await requestGraphQL<
      { requestChangeLoginEmail: SuccessResponse },
      { input: { newLoginEmail: string } }
    >(REQUEST_CHANGE_LOGIN_EMAIL_MUTATION, {
      input: { newLoginEmail },
    });

    const result = response.requestChangeLoginEmail;

    if (!result.success) {
      throw new Error(result.message || '暂时无法发送登录邮箱变更邮件。');
    }

    return result;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法发送登录邮箱变更邮件。'));
  }
}

// ---------------------------------------------------------------------------
// requestPasswordResetEmail
// ---------------------------------------------------------------------------

const REQUEST_PASSWORD_RESET_EMAIL_MUTATION = `
  mutation RequestPasswordResetEmail($input: RequestPasswordResetEmailInput!) {
    requestPasswordResetEmail(input: $input) {
      message
      success
    }
  }
`;

export async function requestPasswordResetEmail(email: string) {
  try {
    const response = await requestGraphQL<
      { requestPasswordResetEmail: SuccessResponse },
      { input: { email: string } }
    >(REQUEST_PASSWORD_RESET_EMAIL_MUTATION, {
      input: { email },
    });

    const result = response.requestPasswordResetEmail;

    if (!result.success) {
      throw new Error(result.message || '暂时无法发送密码重置邮件。');
    }

    return result;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法发送密码重置邮件。'));
  }
}
