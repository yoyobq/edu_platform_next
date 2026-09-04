// src/features/academic-timetable/infrastructure/academic-timetable-api.spec.ts
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
  requestAcademicSemesterTimetableItems,
  requestAcademicTeacherSemesterScheduleItems,
} from './academic-timetable-api';

describe('academic timetable api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    isGraphQLIngressErrorMock.mockReset();
    isGraphQLIngressErrorMock.mockReturnValue(false);
  });

  it('loads teacher deliveries and preserves a multi-class delivery as one timetable item', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      listAcademicSemesterTeachingDeliveries: {
        invalidReason: null,
        isComplete: true,
        isValid: true,
        truncationReason: null,
        items: [
          {
            calcEffect: 'NORMAL',
            classroomName: '机房1',
            coefficient: '1.60',
            courseCategory: 'THEORY',
            courseName: '信息技术1',
            date: '2026-03-02',
            deliveryKey: 'delivery:semantic:1',
            isEffective: true,
            logicalDayOfWeek: 1,
            periodEnd: 6,
            periodStart: 5,
            physicalDayOfWeek: 1,
            semesterId: 1,
            staffId: '2236',
            staffName: '杨燕',
            sstsCourseId: 'COURSE-1',
            teachingClassName: '机电2601，机电2602',
            teachingClasses: [
              { sstsTeachingClassId: 'CLASS-1', teachingClassName: '机电2601' },
              { sstsTeachingClassId: 'CLASS-2', teachingClassName: '机电2602' },
            ],
            weekIndex: 2,
          },
        ],
      },
    });

    const result = await requestAcademicSemesterTimetableItems({
      semesterId: 1,
      staffId: '2236',
    });

    expect(result).toEqual([
      expect.objectContaining({
        scheduleId: 'delivery:semantic:1',
        slotId: 'delivery:semantic:1',
        teachingClassName: '机电2601，机电2602',
        sstsTeachingClassId: null,
        coefficient: 1.6,
      }),
    ]);
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain(
      'listAcademicSemesterTeachingDeliveries',
    );
  });

  it('loads semester grid patterns from the same delivery semantics', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      listAcademicTeacherSemesterDeliveryPatterns: {
        invalidReason: null,
        isValid: true,
        items: [
          {
            classroomName: '机房1',
            coefficient: '1.00',
            courseCategory: 'THEORY',
            courseName: '信息技术1',
            dayOfWeek: 1,
            deliveryPatternKey: 'pattern:semantic:1',
            periodEnd: 6,
            periodStart: 5,
            semesterId: 1,
            staffId: '2236',
            staffName: '杨燕',
            sstsCourseId: 'COURSE-1',
            teachingClassName: '机电2601',
            teachingClasses: [{ sstsTeachingClassId: 'CLASS-1', teachingClassName: '机电2601' }],
            weekRanges: '[4]',
          },
        ],
      },
    });

    const result = await requestAcademicTeacherSemesterScheduleItems({
      semesterId: 1,
      staffId: '2236',
    });

    expect(result[0]).toMatchObject({
      scheduleId: 'pattern:semantic:1',
      slotId: 'pattern:semantic:1',
      weekPattern: '[4]',
      weekRanges: '[4]',
    });
    expect(executeGraphQLMock.mock.calls[0]?.[0]).toContain(
      'listAcademicTeacherSemesterDeliveryPatterns',
    );
  });
});
