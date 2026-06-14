// src/features/academic-curriculum-plan-homepage/infrastructure/academic-curriculum-plan-homepage-api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeGraphQL, hasGraphQLErrorCode } from '@/shared/graphql';

import {
  fetchCurriculumPlanHomepageDepartmentOptions,
  fetchCurriculumPlanHomepageDetail,
  fetchCurriculumPlanHomepageList,
  isCurriculumPlanHomepagePrefillTimeWindowClosedError,
  isCurriculumPlanHomepageSemesterInvalidDateError,
  listCurriculumPlanHomepageReferenceCandidates,
  listCurriculumPlanHomepageTeachingEndChapterCandidates,
  previewCurriculumPlanHomepagePrefill,
  resolveCurriculumPlanHomepagePrefillErrorMessage,
  saveCurriculumPlanHomepage,
} from './academic-curriculum-plan-homepage-api';

const { executeGraphQLMock, hasGraphQLErrorCodeMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  hasGraphQLErrorCodeMock: vi.fn(() => false),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  hasGraphQLErrorCode: hasGraphQLErrorCodeMock,
}));

const mockedExecuteGraphQL = vi.mocked(executeGraphQL);
const mockedHasGraphQLErrorCode = vi.mocked(hasGraphQLErrorCode);

describe('academic curriculum plan homepage api', () => {
  beforeEach(() => {
    mockedExecuteGraphQL.mockReset();
    mockedHasGraphQLErrorCode.mockReset();
    mockedHasGraphQLErrorCode.mockReturnValue(false);
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
        sessionToken: 'upstream-token-000',
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
    expect(mockedExecuteGraphQL.mock.calls[0]?.[0]).toContain(
      'query FetchCurriculumPlanHomepageList',
    );
    expect(mockedExecuteGraphQL.mock.calls[0]?.[1]).toEqual({
      departmentId: null,
      schoolYear: '2025',
      semester: '2',
      sessionToken: 'upstream-token-000',
    });
    expect(mockedExecuteGraphQL.mock.calls[0]?.[2]).toEqual({
      logoutOnRetryAuthFailure: false,
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
    expect(mockedExecuteGraphQL.mock.calls[0]?.[2]).toEqual({
      logoutOnRetryAuthFailure: false,
    });
  });

  it('saves the full upstream-style homepage object without remapping keys', async () => {
    mockedExecuteGraphQL.mockResolvedValueOnce({
      saveCurriculumPlanHomepage: {
        code: '0',
        data: { saved: true },
        expiresAt: '2026-06-01T09:00:00.000Z',
        msg: 'ok',
        success: true,
        upstreamSessionToken: 'upstream-token-003',
      },
    });

    const homepage = {
      lecture_plan_id: 'plan-001',
      course_name: '网页设计与制作',
      textbook_name: 'HTML5+CSS3网页设计与制作',
      untouched_upstream_field: 'keep-me',
    };

    await expect(
      saveCurriculumPlanHomepage({
        homepage,
        sessionToken: 'upstream-token-002',
      }),
    ).resolves.toMatchObject({
      success: true,
      upstreamSessionToken: 'upstream-token-003',
    });
    expect(mockedExecuteGraphQL.mock.calls[0]?.[0]).toContain(
      'mutation SaveCurriculumPlanHomepage',
    );
    expect(mockedExecuteGraphQL.mock.calls[0]?.[1]).toEqual({
      input: {
        homepage,
        sessionToken: 'upstream-token-002',
      },
    });
    expect(mockedExecuteGraphQL.mock.calls[0]?.[2]).toEqual({
      logoutOnRetryAuthFailure: false,
    });
  });

  it('previews managed homepage prefill with typed context', async () => {
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
        planId: ' plan-001 ',
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
      planId: 'plan-001',
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
      planId: 'plan-001',
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
      planId: 'plan-001',
    });
  });

  it('detects prefill time window and invalid semester date errors', () => {
    const error = new Error('graphql');

    mockedHasGraphQLErrorCode.mockImplementation((_error, errorCode) => {
      return (
        errorCode === 'ACADEMIC_COURSE_SCHEDULE_CURRICULUM_PLAN_HOMEPAGE_PREFILL_TIME_WINDOW_CLOSED'
      );
    });

    expect(isCurriculumPlanHomepagePrefillTimeWindowClosedError(error)).toBe(true);
    expect(isCurriculumPlanHomepageSemesterInvalidDateError(error)).toBe(false);

    mockedHasGraphQLErrorCode.mockImplementation((_error, errorCode) => {
      return errorCode === 'ACADEMIC_SEMESTER_INVALID_DATE';
    });

    expect(resolveCurriculumPlanHomepagePrefillErrorMessage(error, 'fallback')).toBe(
      '学期日期数据异常，暂时无法生成预填建议。请联系管理员核对学期日期配置。',
    );
  });

  it('loads managed historical reference candidates and keeps upstream session result', async () => {
    mockedExecuteGraphQL.mockResolvedValueOnce({
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
        planId: 'plan-001',
        upstreamSessionToken: 'upstream-token-003',
      }),
    ).resolves.toMatchObject({
      upstreamSessionToken: 'upstream-token-004',
    });
    expect(mockedExecuteGraphQL.mock.calls[0]?.[0]).toContain(
      'query ListAcademicCurriculumPlanHomepageReferenceCandidates',
    );
    expect(mockedExecuteGraphQL.mock.calls[0]?.[1]).toMatchObject({
      context: {
        courseName: '网页设计与制作',
        schoolYear: '2025',
        semester: '2',
        staffId: 'S001',
        weekCount: 15,
        weeklyHours: 4,
      },
      phase: 'INITIAL',
      planId: 'plan-001',
      upstreamSessionToken: 'upstream-token-003',
    });
    expect(mockedExecuteGraphQL.mock.calls[0]?.[2]).toEqual({
      logoutOnRetryAuthFailure: false,
    });
  });

  it('loads my teaching end chapter candidates with ownership context', async () => {
    mockedExecuteGraphQL.mockResolvedValueOnce({
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
    expect(mockedExecuteGraphQL.mock.calls[0]?.[0]).toContain(
      'query ListMyAcademicCurriculumPlanHomepageTeachingEndChapterCandidates',
    );
    expect(mockedExecuteGraphQL.mock.calls[0]?.[1]).toEqual({
      context: {
        schoolYear: '2025',
        semester: '2',
      },
      phase: 'FINAL',
      planId: 'plan-001',
      upstreamSessionToken: 'upstream-token-004',
    });
    expect(mockedExecuteGraphQL.mock.calls[0]?.[2]).toEqual({
      logoutOnRetryAuthFailure: false,
    });
  });
});
