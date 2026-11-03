// src/labs/teaching-inspection/infrastructure/lesson-api.ts
import { executeUpstreamSessionGraphQL } from '@/entities/upstream-session';

import { executeGraphQL } from '@/shared/graphql';

import type {
  Assignment,
  CourseGrouping,
  Prepared,
  PrepareInput,
  Resource,
  Schedule,
  SessionResult,
  TimePlan,
  Workspace,
} from '../model';

import { prepareFields, scheduleFields, statusFields } from './api';
export type LessonResource = Resource & {
  assignmentSources?: { round: number; checkDate: string; material: Assignment }[];
  lessonPlanSources?:
    | { round: number; checkDate: string; chapter: string; sourceDate: string | null }[]
    | null;
  teacherIds: string[];
  grouping?: CourseGrouping;
  timePlan: TimePlan;
};
export type LessonSummary = Omit<LessonResource, 'schedule'> & {
  schedule: Pick<Schedule, 'version' | 'dates' | 'rounds' | 'records'>;
};
export type LessonOverview = Omit<Workspace, 'resources'> & {
  teachingGroupIds: string[];
  roster: { groupId: string; groupName: string; staffId: string; name: string }[];
  groupPlans: TimePlan[];
  resources: LessonSummary[];
};
const resourceFields = `lessonPlanSources { round checkDate chapter sourceDate } resourceKey sourceVersion courseName teacherIds teacherNames suggestedDates earliestDate latestDate blockers grouping { group suggestedGroup start end needsReview reason preserved } timePlan { group key version dates suggestedDates sourceVersion confirmed fullSemester canEdit earliestDate latestDate } schedule { ${scheduleFields} } status { ${statusFields} }`;
const overviewFields = resourceFields.replace(
  scheduleFields,
  'version dates records { recordKey checkDate chapter score actualProgress plannedProgress deviation } rounds { round date actualDate recordKey operationId operationState savedOperationId }',
);
export async function overview(
  semesterId: number,
  departmentId?: string | null,
  kind: 'LESSON_PLAN' | 'PROGRESS' | 'ASSIGNMENT' = 'LESSON_PLAN',
) {
  return (
    await executeGraphQL<{ result: LessonOverview }, { input: object }>(
      `query ${kind === 'ASSIGNMENT' ? 'AssignmentInspectionOverview' : kind === 'PROGRESS' ? 'ProgressInspectionOverview' : 'LessonPlanInspectionOverview'}($input: InspectionWorkspaceInput!) { result: ${kind === 'ASSIGNMENT' ? 'assignmentInspectionOverview' : kind === 'PROGRESS' ? 'progressInspectionOverview' : 'lessonPlanInspectionOverview'}(input: $input) { today total departmentId canSelectDepartment teachingGroupIds departments { id name } teachers { staffId name } roster { groupId groupName staffId name } groupPlans { group key dates confirmed } resources { ${kind === 'ASSIGNMENT' ? `assignmentSources { round checkDate material { assignedBook assignmentQuantity knowledgeCoverage allMarkingStatus markingErrors markingCorrections markingAndDateDetails studentCompletionStatus studentCorrectionStatus checkerOpinion } }` : ''} ${overviewFields} } } }`,
      { input: { semesterId, departmentId, kind } },
    )
  ).result;
}
export async function detail(
  semesterId: number,
  resourceKey: string,
  kind: 'LESSON_PLAN' | 'PROGRESS' | 'ASSIGNMENT' = 'LESSON_PLAN',
) {
  return (
    await executeGraphQL<{ result: LessonResource }, { input: object }>(
      `query ${kind === 'ASSIGNMENT' ? 'AssignmentInspectionDetail' : kind === 'PROGRESS' ? 'ProgressInspectionDetail' : 'LessonPlanInspectionDetail'}($input: InspectionOperationInput!) { result: ${kind === 'ASSIGNMENT' ? 'assignmentInspectionDetail' : kind === 'PROGRESS' ? 'progressInspectionDetail' : 'lessonPlanInspectionDetail'}(input: $input) { ${resourceFields} } }`,
      { input: { semesterId, resourceKey, kind } },
    )
  ).result;
}
export async function syncCounts(
  semesterId: number,
  departmentId: string | null,
  upstreamSessionToken: string,
) {
  return (
    await executeUpstreamSessionGraphQL<
      {
        result: SessionResult & {
          observedAt: string;
          counts: { resourceKey: string; count: number | null }[];
        };
      },
      { input: object }
    >(
      `mutation SyncLessonPlanInspectionCounts($input: LessonInspectionCountsInput!) { result: syncLessonPlanInspectionCounts(input: $input) { counts { resourceKey count } observedAt upstreamSessionToken expiresAt } }`,
      { input: { semesterId, departmentId, kind: 'LESSON_PLAN', upstreamSessionToken } },
    )
  ).result;
}

export async function prepareBatch(items: PrepareInput[], upstreamSessionToken: string) {
  return (
    await executeUpstreamSessionGraphQL<
      {
        result: SessionResult & {
          items: { resourceKey: string; round: number; failed: boolean; result: Prepared | null }[];
        };
      },
      { input: object }
    >(
      `mutation PrepareLessonPlanInspectionBatch($input: LessonInspectionBatchPrepareInput!) { result: prepareLessonPlanInspectionBatch(input: $input) { items { resourceKey round failed result { ${prepareFields} } } upstreamSessionToken expiresAt } }`,
      { input: { items: items.map((item) => ({ ...item, upstreamSessionToken })) } },
      { allowAuthRetry: false },
    )
  ).result;
}

/** Runtime clock access stays outside rendering and pure presentation policies. */
export function previewHasExpired(expiresAt: string) {
  return Date.parse(expiresAt) <= Date.now();
}
