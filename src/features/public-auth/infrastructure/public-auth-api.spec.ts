// src/features/public-auth/infrastructure/public-auth-api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock, executeUpstreamSessionGraphQLMock, hasGraphQLDetailCodeMock } =
  vi.hoisted(() => ({
    executeGraphQLMock: vi.fn(),
    executeUpstreamSessionGraphQLMock: vi.fn(),
    hasGraphQLDetailCodeMock: vi.fn(),
  }));

vi.mock('@/entities/upstream-session', () => ({
  executeUpstreamSessionGraphQL: executeUpstreamSessionGraphQLMock,
  requestUpstreamLoginSession: vi.fn(),
  resolveStaffInviteUpstreamErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  resolveUpstreamErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  hasGraphQLDetailCode: hasGraphQLDetailCodeMock,
  isGraphQLIngressError: vi.fn(() => false),
}));

import { publicAuthApi } from './public-auth-api';

describe('public auth api student registration', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    executeUpstreamSessionGraphQLMock.mockReset();
    hasGraphQLDetailCodeMock.mockReset();
    hasGraphQLDetailCodeMock.mockReturnValue(false);
  });

  it('loads public student registration link info with path token', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      publicStudentRegistrationLinkInfo: {
        success: true,
        reason: 'AVAILABLE',
        message: null,
        info: {
          canProceed: true,
          status: 'ACTIVE',
          scope: 'STUDENT',
          classCode: '1031301',
          className: '信息1301班',
          studentId: 'S001',
          expiresAt: '2026-06-30T12:00:00.000Z',
        },
      },
    });

    await expect(
      publicAuthApi.getStudentRegistrationLinkInfo({
        token: ' token-001 ',
      }),
    ).resolves.toEqual({
      status: 'ready',
      info: {
        canProceed: true,
        status: 'ACTIVE',
        scope: 'STUDENT',
        classCode: '1031301',
        className: '信息1301班',
        studentId: 'S001',
        expiresAt: '2026-06-30T12:00:00.000Z',
      },
    });

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;

    expect(query).toContain('PublicStudentRegistrationLinkInfo');
    expect(query).toContain('publicStudentRegistrationLinkInfo');
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.any(String),
      {
        token: 'token-001',
      },
      {
        accessToken: undefined,
        allowAuthRetry: undefined,
        authMode: 'none',
      },
    );
  });

  it('maps missing student registration links with null info', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      publicStudentRegistrationLinkInfo: {
        success: false,
        reason: 'LINK_NOT_FOUND',
        message: '链接不存在',
        info: null,
      },
    });

    await expect(
      publicAuthApi.getStudentRegistrationLinkInfo({
        token: 'missing-token',
      }),
    ).resolves.toEqual({
      status: 'failure',
      reason: 'LINK_NOT_FOUND',
      message: '链接不存在',
      info: null,
    });
  });

  it('maps consumed student registration links as inactive failures with info', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      publicStudentRegistrationLinkInfo: {
        success: false,
        reason: 'LINK_NOT_ACTIVE',
        message: '学生注册链接不可用',
        info: {
          canProceed: false,
          status: 'CONSUMED',
          scope: 'STUDENT',
          classCode: '1031301',
          className: '信息1301班',
          studentId: 'S001',
          expiresAt: '2026-06-30T12:00:00.000Z',
        },
      },
    });

    await expect(
      publicAuthApi.getStudentRegistrationLinkInfo({
        token: 'consumed-token',
      }),
    ).resolves.toEqual({
      status: 'failure',
      reason: 'LINK_NOT_ACTIVE',
      message: '学生注册链接不可用',
      info: {
        canProceed: false,
        status: 'CONSUMED',
        scope: 'STUDENT',
        classCode: '1031301',
        className: '信息1301班',
        studentId: 'S001',
        expiresAt: '2026-06-30T12:00:00.000Z',
      },
    });
  });

  it('consumes student registration link with normalized input and pending email fields', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      consumeStudentRegistrationLink: {
        success: true,
        message: '学生注册成功',
        accountId: 1001,
        loginEmail: 'student@example.com',
        accountStatus: 'PENDING',
        emailVerificationRequired: true,
        emailVerificationSent: false,
      },
    });

    await expect(
      publicAuthApi.consumeStudentRegistrationLink({
        token: ' token-001 ',
        studentId: ' S001 ',
        name: ' 张三 ',
        idCardLastSix: ' A12345 ',
        loginEmail: ' student@example.com ',
        loginPassword: 'abc12345',
        loginName: ' ',
        nickname: ' 小张 ',
      }),
    ).resolves.toEqual({
      status: 'success',
      accountId: 1001,
      loginEmail: 'student@example.com',
      accountStatus: 'PENDING',
      emailVerificationRequired: true,
      emailVerificationSent: false,
      message: '学生注册成功',
    });

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    const variables = executeGraphQLMock.mock.calls[0]?.[1];

    expect(query).toContain('ConsumeStudentRegistrationLink');
    expect(query).toContain('consumeStudentRegistrationLink');
    expect(variables).toEqual({
      input: {
        token: 'token-001',
        studentId: 'S001',
        name: '张三',
        idCardLastSix: 'A12345',
        loginEmail: 'student@example.com',
        loginPassword: 'abc12345',
        loginName: undefined,
        nickname: '小张',
      },
    });
  });

  it('verifies student registration identity without consuming the link', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      verifyStudentRegistrationIdentity: {
        success: true,
        canProceed: true,
        reason: 'AVAILABLE',
        message: null,
      },
    });

    await expect(
      publicAuthApi.verifyStudentRegistrationIdentity({
        token: ' token-001 ',
        studentId: ' S001 ',
        name: ' 张三 ',
        idCardLastSix: ' A12345 ',
      }),
    ).resolves.toEqual({
      canProceed: true,
      message: null,
      status: 'success',
    });

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    const variables = executeGraphQLMock.mock.calls[0]?.[1];

    expect(query).toContain('VerifyStudentRegistrationIdentity');
    expect(query).toContain('verifyStudentRegistrationIdentity');
    expect(variables).toEqual({
      input: {
        token: 'token-001',
        studentId: 'S001',
        name: '张三',
        idCardLastSix: 'A12345',
      },
    });
  });

  it('maps student registration identity verification mismatch as a generic failure', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      verifyStudentRegistrationIdentity: {
        success: false,
        canProceed: false,
        reason: 'IDENTITY_MISMATCH',
        message: '身份信息不匹配',
      },
    });

    await expect(
      publicAuthApi.verifyStudentRegistrationIdentity({
        token: 'token-001',
        studentId: 'S001',
        name: '张三',
        idCardLastSix: 'A12345',
      }),
    ).resolves.toEqual({
      canProceed: false,
      reason: 'IDENTITY_MISMATCH',
      message: '身份信息不匹配，请核对后重试。',
      status: 'failure',
    });
  });

  it('maps student registration identity top-level link errors as link failures', async () => {
    const error = new Error('学生注册链接已过期');

    hasGraphQLDetailCodeMock.mockImplementation(
      (_error: unknown, code: string) => code === 'STUDENT_REGISTRATION_LINK_EXPIRED',
    );
    executeGraphQLMock.mockRejectedValueOnce(error);

    await expect(
      publicAuthApi.verifyStudentRegistrationIdentity({
        token: 'token-001',
        studentId: 'S001',
        name: '张三',
        idCardLastSix: 'A12345',
      }),
    ).resolves.toEqual({
      canProceed: false,
      reason: 'LINK_EXPIRED',
      message: '这个学生注册链接已经过期，请联系班主任或管理员重新获取链接。',
      status: 'failure',
    });
  });

  it('maps student registration identity top-level inactive link errors as link failures', async () => {
    const error = new Error('学生注册链接不可用');

    hasGraphQLDetailCodeMock.mockImplementation(
      (_error: unknown, code: string) => code === 'STUDENT_REGISTRATION_LINK_NOT_ACTIVE',
    );
    executeGraphQLMock.mockRejectedValueOnce(error);

    await expect(
      publicAuthApi.verifyStudentRegistrationIdentity({
        token: 'token-001',
        studentId: 'S001',
        name: '张三',
        idCardLastSix: 'A12345',
      }),
    ).resolves.toEqual({
      canProceed: false,
      reason: 'LINK_NOT_ACTIVE',
      message: '这个学生注册链接暂时不可用，请联系班主任或管理员确认链接状态。',
      status: 'failure',
    });
  });

  it('verifies student registration account fields before final consume', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      verifyStudentRegistrationAccount: {
        success: true,
        canProceed: true,
        reason: 'AVAILABLE',
        message: null,
      },
    });

    await expect(
      publicAuthApi.verifyStudentRegistrationAccount({
        token: ' token-001 ',
        loginName: ' stu001 ',
        loginPassword: 'abc12345!',
        nickname: ' 小张 ',
      }),
    ).resolves.toEqual({
      canProceed: true,
      message: null,
      status: 'success',
    });

    const query = executeGraphQLMock.mock.calls[0]?.[0] as string;
    const variables = executeGraphQLMock.mock.calls[0]?.[1];

    expect(query).toContain('VerifyStudentRegistrationAccount');
    expect(query).toContain('verifyStudentRegistrationAccount');
    expect(variables).toEqual({
      input: {
        token: 'token-001',
        loginName: 'stu001',
        loginPassword: 'abc12345!',
        nickname: '小张',
      },
    });
  });

  it('maps student registration account login name conflicts with stable copy', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      verifyStudentRegistrationAccount: {
        success: false,
        canProceed: false,
        reason: 'LOGIN_NAME_TAKEN',
        message: 'login name already exists',
      },
    });

    await expect(
      publicAuthApi.verifyStudentRegistrationAccount({
        token: 'token-001',
        loginName: 'stu001',
        loginPassword: 'abc12345!',
        nickname: '小张',
      }),
    ).resolves.toEqual({
      canProceed: false,
      reason: 'LOGIN_NAME_TAKEN',
      message: '这个登录名已被使用，请换一个。',
      status: 'failure',
    });
  });

  it('maps student registration account top-level link errors as link failures', async () => {
    const error = new Error('学生注册链接不可用');

    hasGraphQLDetailCodeMock.mockImplementation(
      (_error: unknown, code: string) => code === 'STUDENT_REGISTRATION_LINK_NOT_ACTIVE',
    );
    executeGraphQLMock.mockRejectedValueOnce(error);

    await expect(
      publicAuthApi.verifyStudentRegistrationAccount({
        token: 'token-001',
        loginName: 'stu001',
        loginPassword: 'abc12345!',
        nickname: '小张',
      }),
    ).resolves.toEqual({
      canProceed: false,
      reason: 'LINK_NOT_ACTIVE',
      message: '这个学生注册链接暂时不可用，请联系班主任或管理员确认链接状态。',
      status: 'failure',
    });
  });

  it('maps student registration identity mismatch as a form failure result', async () => {
    const error = new Error('身份信息不匹配');

    hasGraphQLDetailCodeMock.mockReturnValue(true);
    executeGraphQLMock.mockRejectedValueOnce(error);

    await expect(
      publicAuthApi.consumeStudentRegistrationLink({
        token: 'token-001',
        studentId: 'S001',
        name: '张三',
        idCardLastSix: 'A12345',
        loginEmail: 'student@example.com',
        loginPassword: 'abc12345',
      }),
    ).resolves.toEqual({
      status: 'identity-mismatch',
      message: '身份信息不匹配，请核对后重试。',
    });
  });

  it('maps final student registration link errors as link failures', async () => {
    const error = new Error('学生注册链接不可用');

    hasGraphQLDetailCodeMock.mockImplementation(
      (_error: unknown, code: string) => code === 'STUDENT_REGISTRATION_LINK_NOT_ACTIVE',
    );
    executeGraphQLMock.mockRejectedValueOnce(error);

    await expect(
      publicAuthApi.consumeStudentRegistrationLink({
        token: 'token-001',
        studentId: 'S001',
        name: '张三',
        idCardLastSix: 'A12345',
        loginEmail: 'student@example.com',
        loginPassword: 'abc12345',
      }),
    ).resolves.toEqual({
      status: 'link-failure',
      reason: 'LINK_NOT_ACTIVE',
      message: '这个学生注册链接暂时不可用，请联系班主任或管理员确认链接状态。',
    });
  });

  it('verifies login email by token and maps stable failure reasons', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      verifyLoginEmail: {
        success: false,
        message: null,
        reason: 'EXPIRED',
        accountId: null,
        loginEmail: 'student@example.com',
      },
    });

    await expect(
      publicAuthApi.verifyLoginEmail({
        token: ' verify-token-001 ',
      }),
    ).resolves.toEqual({
      status: 'failure',
      reason: 'EXPIRED',
      loginEmail: 'student@example.com',
      message: '这个登录邮箱验证链接已经过期，请重新发送验证邮件。',
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('VerifyLoginEmail'),
      {
        input: {
          token: 'verify-token-001',
        },
      },
      {
        accessToken: undefined,
        allowAuthRetry: undefined,
        authMode: 'none',
      },
    );
  });

  it('treats resend login email verification as a generic accepted request', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      resendLoginEmailVerification: {
        success: true,
        message: null,
      },
    });

    await expect(
      publicAuthApi.resendLoginEmailVerification({
        loginEmail: ' student@example.com ',
      }),
    ).resolves.toEqual({
      status: 'success',
      message: null,
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('ResendLoginEmailVerification'),
      {
        input: {
          loginEmail: 'student@example.com',
        },
      },
      {
        accessToken: undefined,
        allowAuthRetry: undefined,
        authMode: 'none',
      },
    );
  });
});
