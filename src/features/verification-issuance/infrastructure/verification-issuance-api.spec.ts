// src/features/verification-issuance/infrastructure/verification-issuance-api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock, isGraphQLIngressErrorMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  isGraphQLIngressErrorMock: vi.fn(),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  isGraphQLIngressError: isGraphQLIngressErrorMock,
}));

import {
  issueVerificationStudentRegistrationLink,
  requestVerificationIssuanceClassOptions,
} from './verification-issuance-api';

describe('verification issuance api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    isGraphQLIngressErrorMock.mockReset();
    isGraphQLIngressErrorMock.mockReturnValue(false);
  });

  it('应该读取本地可用班级作为正式签发页选项', async () => {
    const options = [
      {
        classCode: '1031301',
        className: '信息 1301 班',
        departmentId: '103',
        gradeYear: 2024,
        id: 'class-1',
      },
    ];
    executeGraphQLMock.mockResolvedValueOnce({ listLocalClassOptions: options });

    await expect(requestVerificationIssuanceClassOptions()).resolves.toEqual(options);
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('VerificationIssuanceLocalClassOptions'),
      { input: {} },
    );
  });

  it('应该只传 classCode 签发班级共享注册链接', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      issueStudentRegistrationLink: {
        classCode: '1031301',
        expiresAt: '2026-09-05T00:00:00.000Z',
        link: 'https://example.com/invite/student-registration/token-1',
        recordId: 41,
        studentId: null,
        success: true,
        token: 'token-1',
      },
    });

    await expect(
      issueVerificationStudentRegistrationLink({ classCode: ' 1031301 ' }),
    ).resolves.toEqual({
      classCode: '1031301',
      expiresAt: '2026-09-05T00:00:00.000Z',
      link: 'https://example.com/invite/student-registration/token-1',
      recordId: 41,
      token: 'token-1',
    });
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('VerificationIssuanceStudentRegistrationLink'),
      { input: { classCode: '1031301' } },
    );
  });

  it('后端若返回指定学生链接，正式页面应该拒绝展示', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      issueStudentRegistrationLink: {
        classCode: '1031301',
        expiresAt: '2026-09-05T00:00:00.000Z',
        link: 'https://example.com/invite/student-registration/token-1',
        recordId: 41,
        studentId: '20240001',
        success: true,
        token: 'token-1',
      },
    });

    await expect(
      issueVerificationStudentRegistrationLink({ classCode: '1031301' }),
    ).rejects.toThrow('暂时无法签发班级共享注册链接。');
  });
});
