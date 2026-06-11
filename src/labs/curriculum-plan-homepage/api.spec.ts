// src/labs/curriculum-plan-homepage/api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeGraphQL } from '@/shared/graphql';

import {
  fetchCurrentCurriculumPlanHomepageAccount,
  fetchCurriculumPlanHomepageDepartmentOptions,
  fetchCurriculumPlanHomepageDetail,
  fetchCurriculumPlanHomepageList,
} from './api';

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: vi.fn(),
}));

const mockedExecuteGraphQL = vi.mocked(executeGraphQL);

describe('curriculum plan homepage lab api', () => {
  beforeEach(() => {
    mockedExecuteGraphQL.mockReset();
  });

  it('maps the current staff account for upstream session ownership', async () => {
    mockedExecuteGraphQL.mockResolvedValueOnce({
      me: {
        account: {
          id: 1001,
          identityHint: 'STAFF',
        },
        accountId: 1001,
        identity: {
          __typename: 'StaffType',
          departmentId: 'ORG0302',
          id: 'S001',
          name: '卜强',
          slotGroup: [],
        },
        userInfo: {
          accessGroup: ['STAFF'],
          nickname: 'bq',
        },
      },
    });

    await expect(fetchCurrentCurriculumPlanHomepageAccount()).resolves.toEqual({
      accessGroup: ['STAFF'],
      accountId: 1001,
      displayName: '卜强',
      staffId: 'S001',
    });
    expect(mockedExecuteGraphQL.mock.calls[0]?.[0]).toContain('query Me');
  });

  it('fetches homepage list with trimmed term variables and nullable department', async () => {
    mockedExecuteGraphQL.mockResolvedValueOnce({
      fetchCurriculumPlanHomepageList: {
        count: 1,
        expiresAt: '2026-06-01T08:00:00.000Z',
        items: [
          {
            className: '信息2501班',
            courseCategory: '专业课',
            courseName: '网页设计与制作',
            planId: 'plan-001',
            rawPlan: { LECTURE_PLAN_ID: 'plan-001' },
            reviewStatus: '待提交',
            schoolYear: '2025',
            semester: '2',
            teachingClassId: 'tc-001',
            weekCount: 15,
            weekNumberText: '1-15周',
            weeklyHours: 4,
          },
        ],
        upstreamSessionToken: 'upstream-token-001',
      },
    });

    await expect(
      fetchCurriculumPlanHomepageList({
        departmentId: '   ',
        schoolYear: ' 2025 ',
        semester: ' 2 ',
        sessionToken: 'upstream-token-000',
      }),
    ).resolves.toMatchObject({
      count: 1,
      items: [
        {
          planId: 'plan-001',
        },
      ],
      upstreamSessionToken: 'upstream-token-001',
    });
    expect(mockedExecuteGraphQL.mock.calls[0]?.[0]).toContain(
      'query FetchCurriculumPlanHomepageList',
    );
    expect(mockedExecuteGraphQL.mock.calls[0]?.[1]).toEqual({
      departmentId: null,
      schoolYear: '2025',
      semester: '2',
      sessionToken: 'upstream-token-000',
    });
  });

  it('loads enabled department options for the dropdown', async () => {
    mockedExecuteGraphQL.mockResolvedValueOnce({
      departments: [
        {
          departmentName: '后端返回的系部名称',
          id: 'ORG0302',
          isEnabled: true,
          shortName: '系部简称',
        },
        {
          departmentName: '停用系部',
          id: 'ORG9999',
          isEnabled: false,
          shortName: null,
        },
      ],
    });

    await expect(fetchCurriculumPlanHomepageDepartmentOptions()).resolves.toEqual([
      {
        departmentName: '后端返回的系部名称',
        id: 'ORG0302',
        isEnabled: true,
        shortName: '系部简称',
      },
    ]);
    expect(mockedExecuteGraphQL.mock.calls[0]?.[0]).toContain(
      'query CurriculumPlanHomepageDepartments',
    );
    expect(mockedExecuteGraphQL.mock.calls[0]?.[1]).toEqual({
      limit: 500,
    });
  });

  it('fetches homepage detail by trimmed plan id', async () => {
    mockedExecuteGraphQL.mockResolvedValueOnce({
      fetchCurriculumPlanHomepageDetail: {
        expiresAt: '2026-06-01T08:00:00.000Z',
        homepage: {
          course_name: '网页设计与制作',
        },
        planId: 'plan-001',
        upstreamSessionToken: 'upstream-token-002',
      },
    });

    await expect(
      fetchCurriculumPlanHomepageDetail({
        planId: ' plan-001 ',
        sessionToken: 'upstream-token-001',
      }),
    ).resolves.toMatchObject({
      homepage: {
        course_name: '网页设计与制作',
      },
      planId: 'plan-001',
      upstreamSessionToken: 'upstream-token-002',
    });
    expect(mockedExecuteGraphQL.mock.calls[0]?.[0]).toContain(
      'query FetchCurriculumPlanHomepageDetail',
    );
    expect(mockedExecuteGraphQL.mock.calls[0]?.[1]).toEqual({
      planId: 'plan-001',
      sessionToken: 'upstream-token-001',
    });
  });
});
