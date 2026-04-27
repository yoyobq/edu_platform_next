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
  requestAcademicTeacherSemesterScheduleItems,
  requestAcademicWeeklyTimetableItems,
} from './api';

describe('academic-timetable api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    isGraphQLIngressErrorMock.mockReset();
    isGraphQLIngressErrorMock.mockReturnValue(false);
  });

  it('maps weekly timetable items with physical day and raw period range', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      listAcademicWeeklyPlannedTimetable: {
        invalidReason: null,
        isComplete: true,
        isValid: true,
        items: [
          {
            calcEffect: 'NORMAL',
            classroomName: 'B-301',
            coefficient: '1',
            courseCategory: 'THEORY',
            courseName: ' 机器学习 ',
            date: '2026-04-21',
            isEffective: true,
            logicalDayOfWeek: 3,
            periodEnd: 7,
            periodStart: 3,
            physicalDayOfWeek: 5,
            scheduleId: 2001,
            semesterId: 202601,
            slotId: 3001,
            staffId: 'STAFF-001',
            staffName: '张老师',
            teachingClassName: '机学 1 班',
            weekIndex: 9,
          },
        ],
        truncationReason: null,
      },
    });

    await expect(
      requestAcademicWeeklyTimetableItems({
        semesterId: 202601,
        staffId: ' STAFF-001 ',
        weekIndex: 9,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        courseName: '机器学习',
        dayOfWeek: 5,
        periodEnd: 7,
        periodStart: 3,
      }),
    ]);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('listAcademicWeeklyPlannedTimetable'),
      {
        semesterId: 202601,
        staffId: 'STAFF-001',
        sstsCourseId: undefined,
        sstsTeachingClassId: undefined,
        weekIndex: 9,
      },
    );
  });

  it('preserves semester schedule day and period range from graphql', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      listAcademicTeacherSemesterScheduleItems: {
        items: [
          {
            classroomId: 10,
            classroomName: 'A-502',
            coefficient: '1.5',
            courseCategory: '实践课',
            courseName: ' 软件测试 ',
            dayOfWeek: 4,
            periodEnd: 7,
            periodStart: 3,
            scheduleId: 5001,
            semesterId: 202601,
            slotId: 88,
            staffId: 'STAFF-002',
            staffName: '李老师',
            sstsCourseId: 'COURSE-001',
            sstsTeachingClassId: 'CLASS-001',
            teachingClassName: '软测 2 班',
            weekPattern: '1-16',
            weekRanges: '1-16',
            weekType: 'ALL',
          },
        ],
      },
    });

    await expect(
      requestAcademicTeacherSemesterScheduleItems({
        semesterId: 202601,
        staffId: ' STAFF-002 ',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        courseName: '软件测试',
        dayOfWeek: 4,
        periodEnd: 7,
        periodStart: 3,
      }),
    ]);
  });
});
