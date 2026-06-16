import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock, isGraphQLIngressErrorMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  isGraphQLIngressErrorMock: vi.fn(() => false),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  isGraphQLIngressError: isGraphQLIngressErrorMock,
}));

import {
  requestAcademicCalendarEvents,
  requestAcademicSemesterDelete,
  requestAcademicSemesters,
  requestStudentAcademicCalendarEvents,
  requestStudentAcademicSemesters,
} from './academic-calendar-management-api';

describe('academic-calendar-management api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    isGraphQLIngressErrorMock.mockReset();
    isGraphQLIngressErrorMock.mockReturnValue(false);
  });

  it('maps semester and event queries into feature records', async () => {
    executeGraphQLMock
      .mockResolvedValueOnce({
        academicSemesters: [
          {
            createdAt: '2026-04-01T00:00:00.000Z',
            endDate: '2026-07-10',
            examStartDate: '2026-06-22',
            firstTeachingDate: '2026-02-20',
            id: 3,
            isCurrent: true,
            isVisible: true,
            name: '2025-2026 第二学期',
            schoolYear: 2025,
            sortOrder: 10,
            startDate: '2026-02-17',
            termNumber: 2,
            updatedAt: '2026-04-02T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
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
        isVisible: true,
        name: '2025-2026 第二学期',
        sortOrder: 10,
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

  it('uses student academic calendar queries without management-only DTO fields', async () => {
    executeGraphQLMock
      .mockResolvedValueOnce({
        studentAcademicSemesters: [
          {
            endDate: '2026-07-10',
            examStartDate: '2026-06-22',
            firstTeachingDate: '2026-02-20',
            id: 3,
            isCurrent: true,
            name: '2025-2026 第二学期',
            schoolYear: 2025,
            startDate: '2026-02-17',
            termNumber: 2,
          },
        ],
      })
      .mockResolvedValueOnce({
        studentAcademicCalendarEvents: [
          {
            dayPeriod: 'ALL_DAY',
            eventDate: '2026-05-01',
            eventType: 'HOLIDAY',
            id: 9,
            originalDate: null,
            ruleNote: '劳动节',
            semesterId: 3,
            teachingCalcEffect: 'CANCEL',
            topic: '五一劳动节',
          },
        ],
      });

    await expect(requestStudentAcademicSemesters({ isCurrent: true, limit: 1 })).resolves.toEqual([
      expect.objectContaining({
        createdAt: '',
        id: 3,
        isCurrent: true,
        isVisible: true,
        name: '2025-2026 第二学期',
        sortOrder: 0,
        updatedAt: '',
      }),
    ]);

    await expect(
      requestStudentAcademicCalendarEvents({ limit: 500, semesterId: 3 }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 9,
        recordStatus: 'ACTIVE',
        topic: '五一劳动节',
        updatedByAccountId: null,
        version: 0,
      }),
    ]);

    const studentSemesterQuery = executeGraphQLMock.mock.calls[0]?.[0] as string;
    const studentCalendarEventQuery = executeGraphQLMock.mock.calls[1]?.[0] as string;

    expect(studentSemesterQuery).toContain('studentAcademicSemesters');
    expect(studentSemesterQuery).not.toContain('createdAt');
    expect(studentSemesterQuery).not.toContain('updatedAt');
    expect(studentCalendarEventQuery).toContain('studentAcademicCalendarEvents');
    expect(studentCalendarEventQuery).not.toContain('recordStatus');
    expect(studentCalendarEventQuery).not.toContain('version');
    expect(studentCalendarEventQuery).not.toContain('createdAt');
    expect(studentCalendarEventQuery).not.toContain('updatedAt');
    expect(studentCalendarEventQuery).not.toContain('updatedByAccountId');
  });
});
