import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock, isGraphQLIngressErrorMock, requestAcademicSemestersMock } = vi.hoisted(
  () => ({
    executeGraphQLMock: vi.fn(),
    isGraphQLIngressErrorMock: vi.fn(() => false),
    requestAcademicSemestersMock: vi.fn(),
  }),
);

vi.mock('@/entities/academic-semester', () => ({
  requestAcademicSemesters: requestAcademicSemestersMock,
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  isGraphQLIngressError: isGraphQLIngressErrorMock,
}));

import {
  requestAcademicCalendarEvents,
  requestAcademicSemesterDelete,
  requestAcademicSemesters,
} from './academic-calendar-management-api';

describe('academic-calendar-management api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    isGraphQLIngressErrorMock.mockReset();
    requestAcademicSemestersMock.mockReset();
    isGraphQLIngressErrorMock.mockReturnValue(false);
  });

  it('maps semester and event queries into feature records', async () => {
    requestAcademicSemestersMock.mockResolvedValueOnce([
      {
        createdAt: '2026-04-01T00:00:00.000Z',
        endDate: '2026-07-10',
        examStartDate: '2026-06-22',
        firstTeachingDate: '2026-02-20',
        id: 3,
        isCurrent: true,
        name: '2025-2026 第二学期',
        schoolYear: 2025,
        startDate: '2026-02-17',
        termNumber: 2,
        updatedAt: '2026-04-02T00:00:00.000Z',
      },
    ]);
    executeGraphQLMock.mockResolvedValueOnce({
      academicCalendarEvents: [
        {
          createdAt: '2026-04-01T00:00:00.000Z',
          dayPeriod: 'ALL_DAY',
          eventDate: '2026-05-01',
          eventType: 'HOLIDAY',
          id: 9,
          originalDate: null,
          recordStatus: 'ACTIVE',
          ruleNote: '劳动节',
          semesterId: 3,
          teachingCalcEffect: 'CANCEL',
          topic: '五一劳动节',
          updatedAt: '2026-04-02T00:00:00.000Z',
          updatedByAccountId: 9527,
          version: 2,
        },
      ],
    });

    await expect(requestAcademicSemesters({ limit: 500 })).resolves.toEqual([
      expect.objectContaining({
        id: 3,
        isCurrent: true,
        name: '2025-2026 第二学期',
      }),
    ]);

    await expect(requestAcademicCalendarEvents({ semesterId: 3 })).resolves.toEqual([
      expect.objectContaining({
        id: 9,
        topic: '五一劳动节',
      }),
    ]);
  });

  it('prefers GraphQL ingress error messages for delete failures', async () => {
    const ingressError = {
      graphqlErrors: [
        {
          extensions: {
            errorMessage: '该学期下仍存在校历事件，无法删除。',
          },
        },
      ],
      userMessage: '统一错误提示',
    };

    executeGraphQLMock.mockRejectedValueOnce(ingressError);
    isGraphQLIngressErrorMock.mockReturnValueOnce(true);

    await expect(requestAcademicSemesterDelete({ id: 7 })).rejects.toThrow(
      '该学期下仍存在校历事件，无法删除。',
    );
  });
});
