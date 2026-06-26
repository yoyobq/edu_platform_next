// src/labs/admin-class-adviser-governance/api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock, executeUpstreamSessionGraphQLMock, isGraphQLIngressErrorMock } =
  vi.hoisted(() => ({
    executeGraphQLMock: vi.fn(),
    executeUpstreamSessionGraphQLMock: vi.fn(),
    isGraphQLIngressErrorMock: vi.fn(),
  }));

vi.mock('@/entities/upstream-session', () => ({
  executeUpstreamSessionGraphQL: executeUpstreamSessionGraphQLMock,
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  isGraphQLIngressError: isGraphQLIngressErrorMock,
}));

import {
  assignClassAdviserByStaffId,
  fetchTeacherDirectory,
  listClassAdviserGovernanceClasses,
  listLocalDepartmentOptions,
  normalizeAssignClassAdviserByStaffIdInput,
  normalizeListClassAdviserGovernanceClassesInput,
  resolveClassAdviserGovernanceErrorMessage,
} from './api';

describe('admin-class-adviser-governance api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    executeUpstreamSessionGraphQLMock.mockReset();
    isGraphQLIngressErrorMock.mockReset();
    isGraphQLIngressErrorMock.mockReturnValue(false);
  });

  it('normalizes list input and omits default all-class filter', () => {
    expect(
      normalizeListClassAdviserGovernanceClassesInput({
        departmentId: ' ORG0301 ',
        keyword: ' 机电 ',
        onlyMissing: false,
      }),
    ).toEqual({
      departmentId: 'ORG0301',
      keyword: '机电',
    });
  });

  it('keeps onlyMissing only when enabled', () => {
    expect(
      normalizeListClassAdviserGovernanceClassesInput({
        departmentId: ' ',
        keyword: null,
        onlyMissing: true,
      }),
    ).toEqual({
      onlyMissing: true,
    });
  });

  it('rejects overlong list filters', () => {
    expect(() =>
      normalizeListClassAdviserGovernanceClassesInput({
        departmentId: 'ORG030101',
      }),
    ).toThrow('系部 ID不能超过 8 个字符。');

    expect(() =>
      normalizeListClassAdviserGovernanceClassesInput({
        keyword: 'a'.repeat(101),
      }),
    ).toThrow('关键词不能超过 100 个字符。');
  });

  it('normalizes assign input and omits empty remarks', () => {
    expect(
      normalizeAssignClassAdviserByStaffIdInput({
        classId: ' C001 ',
        remarks: ' ',
        staffId: ' T1001 ',
        staffName: ' 张老师 ',
      }),
    ).toEqual({
      classId: 'C001',
      staffId: 'T1001',
      staffName: '张老师',
    });
  });

  it('rejects invalid staff ids', () => {
    expect(() =>
      normalizeAssignClassAdviserByStaffIdInput({
        classId: 'C001',
        staffId: 'T 1001',
      }),
    ).toThrow('教职工 ID 不能包含空白或单引号。');

    expect(() =>
      normalizeAssignClassAdviserByStaffIdInput({
        classId: 'C001',
        staffId: "T'1001",
      }),
    ).toThrow('教职工 ID 不能包含空白或单引号。');
  });

  it('requests governance classes with normalized input', async () => {
    const payload = [
      {
        activeAdvisers: [],
        canAssign: true,
        classCode: '1021904',
        classId: 'C001',
        className: '19机电一体化4班',
        departmentId: 'ORG0301',
        gradeYear: 2019,
        lastObservedAt: null,
        studentCount: 42,
      },
    ];

    executeGraphQLMock.mockResolvedValueOnce({
      listClassAdviserGovernanceClasses: payload,
    });

    await expect(
      listClassAdviserGovernanceClasses({
        departmentId: ' ORG0301 ',
        onlyMissing: true,
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('AdminClassAdviserGovernance'),
      {
        input: {
          departmentId: 'ORG0301',
          onlyMissing: true,
        },
      },
    );
  });

  it('loads local department options for the filter dropdown', async () => {
    const payload = [
      {
        departmentName: '智能制造学院',
        id: 'ORG0301',
        isEnabled: true,
        shortName: '智造',
      },
    ];

    executeGraphQLMock.mockResolvedValueOnce({
      departments: payload,
    });

    await expect(listLocalDepartmentOptions()).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('AdminClassAdviserGovernanceDepartments'),
      {
        isEnabled: true,
        limit: 500,
      },
    );
  });

  it('fetches upstream teacher directory with session token', async () => {
    const payload = {
      expiresAt: '2026-06-26T08:00:00.000Z',
      teachers: [
        {
          code: 'T1001',
          image: '',
          name: '张老师',
          text: '张老师',
          value: 'T1001',
        },
      ],
      upstreamSessionToken: 'rolling-token-001',
    };

    executeUpstreamSessionGraphQLMock.mockResolvedValueOnce({
      fetchTeacherDirectory: payload,
    });

    await expect(
      fetchTeacherDirectory({
        upstreamSessionToken: ' upstream-token-001 ',
      }),
    ).resolves.toEqual(payload);

    expect(executeUpstreamSessionGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('AdminClassAdviserGovernanceTeacherDirectory'),
      {
        sessionToken: 'upstream-token-001',
      },
    );
  });

  it('assigns class adviser by staff id with normalized input', async () => {
    const payload = {
      bindingStatus: null,
      changed: true,
      classCode: '1021904',
      classId: 'C001',
      className: '19机电一体化4班',
      hasLocalStaff: false,
      postId: 10,
      staffId: 'T1001',
      staffName: '张老师',
    };

    executeGraphQLMock.mockResolvedValueOnce({
      assignClassAdviserByStaffId: payload,
    });

    await expect(
      assignClassAdviserByStaffId({
        classId: ' C001 ',
        remarks: ' admin 指派 ',
        staffId: ' T1001 ',
        staffName: ' 张老师 ',
      }),
    ).resolves.toEqual(payload);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('AssignClassAdviserByStaffId'),
      {
        input: {
          classId: 'C001',
          remarks: 'admin 指派',
          staffId: 'T1001',
          staffName: '张老师',
        },
      },
    );
  });

  it('keeps plain error messages for display', () => {
    expect(resolveClassAdviserGovernanceErrorMessage(new Error('班级已有班主任'), 'fallback')).toBe(
      '班级已有班主任',
    );
  });

  it('uses GraphQL error message without branching on diagnostic errorCode', () => {
    isGraphQLIngressErrorMock.mockReturnValueOnce(true);

    expect(
      resolveClassAdviserGovernanceErrorMessage(
        {
          graphqlErrors: [
            {
              extensions: {
                errorCode: 'CLASS_ADVISER_ALREADY_EXISTS',
              },
              message: '班级已有班主任',
            },
          ],
          userMessage: '请求处理失败，请稍后重试。',
        },
        'fallback',
      ),
    ).toBe('班级已有班主任');
  });
});
