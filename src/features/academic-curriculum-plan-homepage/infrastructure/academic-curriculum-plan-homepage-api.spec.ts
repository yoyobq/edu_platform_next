// src/features/academic-curriculum-plan-homepage/infrastructure/academic-curriculum-plan-homepage-api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeUpstreamSessionGraphQL } from '@/entities/upstream-session';

import { executeGraphQL, hasGraphQLDetailCode } from '@/shared/graphql';

import {
  fetchCurriculumPlanHomepageDepartmentOptions,
  fetchCurriculumPlanHomepageDetail,
  fetchCurriculumPlanHomepageList,
  isCurriculumPlanHomepagePrefillTimeWindowClosedError,
  listAcademicCurriculumPlanHomepages,
  listAcademicCurriculumPlanHomepageTeacherOptions,
  listCurriculumPlanHomepageReferenceCandidates,
  listCurriculumPlanHomepageTeachingEndChapterCandidates,
  previewCurriculumPlanHomepagePrefill,
  resolveCurriculumPlanHomepagePrefillErrorMessage,
  saveAcademicCurriculumPlanHomepage,
} from './academic-curriculum-plan-homepage-api';

const { executeGraphQLMock, executeUpstreamSessionGraphQLMock, hasGraphQLDetailCodeMock } =
  vi.hoisted(() => ({
    executeGraphQLMock: vi.fn(),
    executeUpstreamSessionGraphQLMock: vi.fn(),
    hasGraphQLDetailCodeMock: vi.fn(() => false),
  }));

vi.mock('@/entities/upstream-session', () => ({
  executeUpstreamSessionGraphQL: executeUpstreamSessionGraphQLMock,
  isExpiredUpstreamSessionError: vi.fn(() => false),
  resolveUpstreamErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  hasGraphQLDetailCode: hasGraphQLDetailCodeMock,
}));

const mockedExecuteUpstreamSessionGraphQL = vi.mocked(executeUpstreamSessionGraphQL);
const mockedExecuteGraphQL = vi.mocked(executeGraphQL);
const mockedHasGraphQLDetailCode = vi.mocked(hasGraphQLDetailCode);

describe('academic curriculum plan homepage api', () => {
  beforeEach(() => {
    mockedExecuteUpstreamSessionGraphQL.mockReset();
    mockedExecuteGraphQL.mockReset();
    mockedHasGraphQLDetailCode.mockReset();
    mockedHasGraphQLDetailCode.mockReturnValue(false);
  });

  it('fetches homepage list with trimmed term variables and nullable department', async () => {
    mockedExecuteUpstreamSessionGraphQL.mockResolvedValueOnce({
      fetchCurriculumPlanHomepageList: {
        count: 1,
        expiresAt: '2026-06-01T08:00:00.000Z',
        items: [
          {
            className: '信息2501班',
            courseCategory: '专业课',
            courseName: '网页设计与制作',
            planId: 'plan-001',
            reviewStatus: '待提交',
            schoolYear: '2025',
            semester: '2',
            staffId: 'S001',
            sstsCourseId: 'COURSE-001',
            sstsTeachingClassId: 'CLASS-001',
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
        upstreamSessionToken: 'upstream-token-000',
      }),
    ).resolves.toMatchObject({
      count: 1,
      items: [
        {
          planId: 'plan-001',
          staffId: 'S001',
          sstsCourseId: 'COURSE-001',
          sstsTeachingClassId: 'CLASS-001',
        },
      ],
      upstreamSessionToken: 'upstream-token-001',
    });
    expect(mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[0]).toContain(
      'query FetchCurriculumPlanHomepageList',
    );
    expect(mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[1]).toEqual({
      departmentId: null,
      schoolYear: '2025',
      semester: '2',
      sessionToken: 'upstream-token-000',
    });
  });

  it('lists the current teacher homepage by one semester record', async () => {
    mockedExecuteUpstreamSessionGraphQL.mockResolvedValueOnce({
      listMyAcademicCurriculumPlanHomepages: {
        count: 0,
        expiresAt: '2026-06-01T08:00:00.000Z',
        items: [],
        upstreamSessionToken: 'rolled-token',
      },
    });

    await expect(
      listAcademicCurriculumPlanHomepages({
        mode: 'my',
        semesterId: 7,
        staffId: 'ignored-for-self',
        upstreamSessionToken: 'session-token',
      }),
    ).resolves.toMatchObject({ upstreamSessionToken: 'rolled-token' });
    expect(mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[0]).toContain(
      'query ListMyAcademicCurriculumPlanHomepages',
    );
    const query = mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[0];
    expect(query).toContain('listMyAcademicCurriculumPlanHomepages(');
    expect(query).toContain('teachingClassId');
    expect(query).toContain('sstsTeachingClassId');
    expect(query).not.toContain('rawPlan');
    expect(mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[1]).toEqual({
      semesterId: 7,
      upstreamSessionToken: 'session-token',
    });
  });

  it('lists a managed teacher homepage by semesterId and staffId', async () => {
    mockedExecuteUpstreamSessionGraphQL.mockResolvedValueOnce({
      listManagedAcademicCurriculumPlanHomepages: {
        count: 0,
        expiresAt: '2026-06-01T08:00:00.000Z',
        items: [],
        upstreamSessionToken: 'rolled-token',
      },
    });

    await listAcademicCurriculumPlanHomepages({
      mode: 'managed',
      semesterId: 7,
      staffId: ' S001 ',
      upstreamSessionToken: 'session-token',
    });
    expect(mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[0]).toContain(
      'query ListAcademicCurriculumPlanHomepages',
    );
    const query = mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[0];
    expect(query).toContain('listManagedAcademicCurriculumPlanHomepages(');
    expect(query).toContain('teachingClassId');
    expect(query).toContain('sstsTeachingClassId');
    expect(query).not.toContain('rawPlan');
    expect(mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[1]).toEqual({
      semesterId: 7,
      staffId: 'S001',
      upstreamSessionToken: 'session-token',
    });
  });

  it('loads semester-scoped teacher options for the shared teacher control', async () => {
    mockedExecuteGraphQL.mockResolvedValueOnce({
      listManagedAcademicSemesterPlannedTimetableTeacherOptions: {
        items: [{ staffId: 'S001', staffName: '王老师' }],
      },
    });

    await expect(
      listAcademicCurriculumPlanHomepageTeacherOptions({
        keyword: ' 王 ',
        semesterId: 7,
      }),
    ).resolves.toEqual([{ staffId: 'S001', staffName: '王老师' }]);
    expect(mockedExecuteGraphQL.mock.calls[0]?.[0]).toContain(
      'query AcademicCurriculumPlanHomepageTeacherOptions',
    );
    expect(mockedExecuteGraphQL.mock.calls[0]?.[1]).toEqual({
      keyword: '王',
      limit: 20,
      semesterId: 7,
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
    mockedExecuteUpstreamSessionGraphQL.mockResolvedValueOnce({
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
        upstreamSessionToken: 'upstream-token-001',
      }),
    ).resolves.toMatchObject({
      homepage: {
        course_name: '网页设计与制作',
      },
      planId: 'plan-001',
      upstreamSessionToken: 'upstream-token-002',
    });
    expect(mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[0]).toContain(
      'query FetchCurriculumPlanHomepageDetail',
    );
    expect(mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[1]).toEqual({
      planId: 'plan-001',
      sessionToken: 'upstream-token-001',
    });
  });

  it('saves my homepage with semesterId and without a client-supplied staffId', async () => {
    mockedExecuteUpstreamSessionGraphQL.mockResolvedValueOnce({
      saveMyAcademicCurriculumPlanHomepage: {
        code: 200,
        data: null,
        expiresAt: '2026-06-01T09:00:00.000Z',
        msg: 'ok',
        planId: 'plan-001',
        success: true,
        upstreamSessionToken: 'rolled-token',
      },
    });

    const homepagePatch = {
      compensatedLessons: null,
      completedLessons: null,
      extraLessons: null,
      flexibleLessons: null,
      improvementMeasures: '',
      lectureLessons: null,
      plannedLessons: null,
      reducedLessons: null,
      reviewExamLessons: null,
      teachingEndChapterContent: '',
      teachingObjectives: '',
      teachingWeeks: 16,
      textbookName: '教材',
      totalLessons: null,
      trainingLessons: null,
      weeklyLessons: null,
    };
    await saveAcademicCurriculumPlanHomepage({
      homepagePatch,
      mode: 'my',
      planId: null,
      semesterId: 7,
      staffId: 'ignored-for-self',
      teachingClassId: ' CLASS-001 ',
      upstreamSessionToken: 'session-token',
    });
    expect(mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[0]).toContain(
      'mutation SaveMyAcademicCurriculumPlanHomepage',
    );
    expect(mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[1]).toEqual({
      input: {
        homepagePatch,
        planId: null,
        semesterId: 7,
        teachingClassId: 'CLASS-001',
        upstreamSessionToken: 'session-token',
      },
    });
  });

  it('saves a managed homepage with the same typed patch plus staffId', async () => {
    mockedExecuteUpstreamSessionGraphQL.mockResolvedValueOnce({
      saveManagedAcademicCurriculumPlanHomepage: {
        code: 200,
        data: null,
        expiresAt: '2026-06-01T09:00:00.000Z',
        msg: 'ok',
        planId: 'plan-001',
        success: true,
        upstreamSessionToken: 'rolled-token',
      },
    });

    const homepagePatch = {
      compensatedLessons: 0,
      completedLessons: 32,
      extraLessons: 0,
      flexibleLessons: 2,
      improvementMeasures: '继续改进',
      lectureLessons: 18,
      plannedLessons: 32,
      reducedLessons: 0,
      reviewExamLessons: 2,
      teachingEndChapterContent: '最终完成至：项目发布',
      teachingObjectives: '掌握网页制作',
      teachingWeeks: 16,
      textbookName: '教材',
      totalLessons: 32,
      trainingLessons: 10,
      weeklyLessons: 2,
    };
    await saveAcademicCurriculumPlanHomepage({
      homepagePatch,
      mode: 'managed',
      planId: ' plan-001 ',
      semesterId: 7,
      staffId: ' S001 ',
      teachingClassId: ' CLASS-001 ',
      upstreamSessionToken: 'session-token',
    });

    expect(mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[0]).toContain(
      'mutation SaveAcademicCurriculumPlanHomepage',
    );
    expect(mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[1]).toEqual({
      input: {
        homepagePatch,
        planId: 'plan-001',
        semesterId: 7,
        staffId: 'S001',
        teachingClassId: 'CLASS-001',
        upstreamSessionToken: 'session-token',
      },
    });
  });

  it('previews managed homepage prefill before the plan id is created', async () => {
    mockedExecuteGraphQL.mockResolvedValueOnce({
      previewAcademicCurriculumPlanHomepagePrefill: {
        fieldWriteRules: [
          {
            field: 'teaching_end_chapter_content',
            mode: 'APPEND_UNIQUE_LINE',
            value: '清明放假 2 课时',
          },
        ],
        homepagePatch: {
          teaching_weeks: 15,
          total_lessons: 56,
          weekly_lessons: 4,
        },
        warnings: [],
      },
    });

    await expect(
      previewCurriculumPlanHomepagePrefill({
        context: {
          courseName: '网页设计与制作',
          schoolYear: '2025',
          semester: '2',
          staffId: 'S001',
          sstsCourseId: 'COURSE-001',
          sstsTeachingClassId: 'CLASS-001',
          weekCount: 15,
          weeklyHours: 4,
        },
        mode: 'managed',
        overrideTimeWindow: true,
        phase: 'INITIAL',
        planId: null,
      }),
    ).resolves.toMatchObject({
      homepagePatch: {
        teaching_weeks: 15,
      },
    });
    expect(mockedExecuteGraphQL.mock.calls[0]?.[0]).toContain(
      'query PreviewAcademicCurriculumPlanHomepagePrefill',
    );
    expect(mockedExecuteGraphQL.mock.calls[0]?.[0]).toContain(
      'overrideTimeWindow: $overrideTimeWindow',
    );
    expect(mockedExecuteGraphQL.mock.calls[0]?.[1]).toEqual({
      context: {
        courseName: '网页设计与制作',
        schoolYear: '2025',
        semester: '2',
        staffId: 'S001',
        sstsCourseId: 'COURSE-001',
        sstsTeachingClassId: 'CLASS-001',
        weekCount: 15,
        weeklyHours: 4,
      },
      overrideTimeWindow: true,
      phase: 'INITIAL',
      planId: null,
    });
  });

  it('previews my homepage prefill without staff id', async () => {
    mockedExecuteGraphQL.mockResolvedValueOnce({
      previewMyAcademicCurriculumPlanHomepagePrefill: {
        fieldWriteRules: [],
        homepagePatch: {
          compensated_lessons: 0,
        },
        warnings: ['WEEK_COUNT_OR_WEEKLY_HOURS_MISSING'],
      },
    });

    await previewCurriculumPlanHomepagePrefill({
      context: {
        courseName: null,
        schoolYear: '2025',
        semester: '2',
        sstsCourseId: 'COURSE-001',
        sstsTeachingClassId: 'CLASS-001',
        weekCount: null,
        weeklyHours: null,
      },
      mode: 'my',
      phase: 'FINAL',
      planId: null,
    });
    expect(mockedExecuteGraphQL.mock.calls[0]?.[0]).toContain(
      'query PreviewMyAcademicCurriculumPlanHomepagePrefill',
    );
    expect(mockedExecuteGraphQL.mock.calls[0]?.[0]).toContain(
      'overrideTimeWindow: $overrideTimeWindow',
    );
    expect(mockedExecuteGraphQL.mock.calls[0]?.[1]).toEqual({
      context: {
        courseName: null,
        schoolYear: '2025',
        semester: '2',
        sstsCourseId: 'COURSE-001',
        sstsTeachingClassId: 'CLASS-001',
        weekCount: null,
        weeklyHours: null,
      },
      phase: 'FINAL',
      planId: null,
    });
  });

  it('detects the explicitly stable prefill time-window detail code', () => {
    const error = new Error('graphql');

    mockedHasGraphQLDetailCode.mockImplementation((_error, errorCode) => {
      return (
        errorCode === 'ACADEMIC_COURSE_SCHEDULE_CURRICULUM_PLAN_HOMEPAGE_PREFILL_TIME_WINDOW_CLOSED'
      );
    });

    expect(isCurriculumPlanHomepagePrefillTimeWindowClosedError(error)).toBe(true);
    expect(resolveCurriculumPlanHomepagePrefillErrorMessage(error, 'fallback')).toBe('graphql');
  });

  it('loads managed historical reference candidates and keeps upstream session result', async () => {
    mockedExecuteUpstreamSessionGraphQL.mockResolvedValueOnce({
      listAcademicCurriculumPlanHomepageReferenceCandidates: {
        candidateGroups: [
          {
            applyMode: 'APPLY_HISTORY_HOMEPAGE_PHASE_FIELDS',
            groupKey: 'historicalHomepageBasicInfo',
            items: [
              {
                courseName: '网页设计与制作',
                matchKind: 'EXACT',
                plannedLessons: 32,
                plannedLessonsDiff: 28,
                rank: 1,
                recommended: true,
                schoolYear: '2024',
                semester: '2',
                sourcePlanId: 'old-plan',
                teachingClassName: '信息2401班',
                values: {
                  improvementMeasures: null,
                  teachingObjectives: '历史教学目的',
                  textbookName: '历史教材',
                },
                weekCount: 16,
                weeklyHours: 2,
              },
            ],
            phase: 'INITIAL',
            targetFields: ['textbook_name', 'teaching_objectives'],
            title: '参考历史教学计划',
          },
        ],
        expiresAt: '2026-06-01T10:00:00.000Z',
        upstreamSessionToken: 'upstream-token-004',
        warnings: [],
      },
    });

    await expect(
      listCurriculumPlanHomepageReferenceCandidates({
        context: {
          courseName: '网页设计与制作',
          schoolYear: '2025',
          semester: '2',
          staffId: 'S001',
          weekCount: 15,
          weeklyHours: 4,
        },
        mode: 'managed',
        phase: 'INITIAL',
        planId: null,
        upstreamSessionToken: 'upstream-token-003',
      }),
    ).resolves.toMatchObject({
      upstreamSessionToken: 'upstream-token-004',
    });
    expect(mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[0]).toContain(
      'query ListAcademicCurriculumPlanHomepageReferenceCandidates',
    );
    expect(mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[1]).toMatchObject({
      context: {
        courseName: '网页设计与制作',
        schoolYear: '2025',
        semester: '2',
        staffId: 'S001',
        weekCount: 15,
        weeklyHours: 4,
      },
      phase: 'INITIAL',
      planId: null,
      upstreamSessionToken: 'upstream-token-003',
    });
  });

  it('loads my teaching end chapter candidates with ownership context', async () => {
    mockedExecuteUpstreamSessionGraphQL.mockResolvedValueOnce({
      listMyAcademicCurriculumPlanHomepageTeachingEndChapterCandidates: {
        candidateGroups: [
          {
            applyMode: 'APPLY_TEACHING_END_CHAPTER_PREFIX_LINE',
            groupKey: 'teachingEndChapterContent',
            items: [
              {
                displayText: '第15周 网页发布',
                lecturePlanDetailId: 'detail-001',
                sectionId: null,
                sectionName: null,
                teachingChapterContent: '网页发布',
                topicName: null,
                value: '网页发布',
                weekNumber: '15',
              },
            ],
            phase: 'FINAL',
            targetFields: ['teaching_end_chapter_content'],
            title: '教学截止章节候选',
            writeRule: {
              field: 'teaching_end_chapter_content',
              mode: 'REPLACE_PREFIX_LINE',
              prefix: '最终完成至：',
            },
          },
        ],
        expiresAt: '2026-06-01T10:00:00.000Z',
        upstreamSessionToken: 'upstream-token-005',
        warnings: [],
      },
    });

    await listCurriculumPlanHomepageTeachingEndChapterCandidates({
      context: {
        schoolYear: '2025',
        semester: '2',
      },
      mode: 'my',
      phase: 'FINAL',
      planId: 'plan-001',
      upstreamSessionToken: 'upstream-token-004',
    });
    expect(mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[0]).toContain(
      'query ListMyAcademicCurriculumPlanHomepageTeachingEndChapterCandidates',
    );
    expect(mockedExecuteUpstreamSessionGraphQL.mock.calls[0]?.[1]).toEqual({
      context: {
        schoolYear: '2025',
        semester: '2',
      },
      phase: 'FINAL',
      planId: 'plan-001',
      upstreamSessionToken: 'upstream-token-004',
    });
  });
});
