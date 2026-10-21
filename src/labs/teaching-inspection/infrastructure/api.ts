// src/labs/teaching-inspection/infrastructure/api.ts
import type { AcademicSemesterSelectRecord } from '@/entities/academic-semester';
import { executeUpstreamSessionGraphQL } from '@/entities/upstream-session';

import { executeGraphQL } from '@/shared/graphql';

import type {
  Audit,
  DateChange,
  InspectionKind,
  Operation,
  Prepared,
  PrepareInput,
  Schedule,
  SessionResult,
  Status,
  Target,
  Workspace,
} from '../model';
const recordFields = `recordKey checkDate score chapter updatedBy actualProgress plannedProgress deviation`;
const scheduleFields = `version dates historyState records { ${recordFields} } rounds { round date actualDate recordKey operationId operationState savedOperationId }`;
const statusFields = `state upstreamCount observedAt observationVersion effectiveCoveredCount rounds { round dateEditable dateBlockers covered coverageBasis canPrepare blockers retryAfter retryWarningOperationId }`;
const operationFields = `id accountId requestId action round checkDate state previewId`;
const materialFields = `lesson { chapter scores scoreItems { name description maximum } } progress { actualProgress plannedProgress deviation } assignment { assignedBook assignmentQuantity knowledgeCoverage allMarkingStatus markingErrors markingCorrections markingAndDateDetails studentCompletionStatus studentCorrectionStatus checkerOpinion }`;
const prepareFields = `preview { id round checkDate scheduleVersion observationVersion expiresAt } operation { ${operationFields} } material { ${materialFields} } blockers upstreamSessionToken expiresAt`;
const names: Record<InspectionKind, string> = {
  LESSON_PLAN: 'LessonPlan',
  PROGRESS: 'Progress',
  ASSIGNMENT: 'Assignment',
};
const prepareDocuments = Object.fromEntries(
  Object.entries(names).map(([kind, name]) => [
    kind,
    `mutation Prepare${name}Inspection($input: InspectionPrepareInputDTO!) { result: prepare${name}Inspection(input: $input) { ${prepareFields} } }`,
  ]),
) as Record<InspectionKind, string>;
const saveDocuments = Object.fromEntries(
  Object.entries(names).map(([kind, name]) => [
    kind,
    `mutation Save${name}Inspection($input: InspectionSaveInputDTO!) { result: save${name}Inspection(input: $input) { operation { ${operationFields} } syncWarning upstreamSessionToken expiresAt } }`,
  ]),
) as Record<InspectionKind, string>;
export async function loadSemesters() {
  const result = await executeGraphQL<
    { academicSemesters: AcademicSemesterSelectRecord[] },
    Record<string, never>
  >(
    `query InspectionSemesters { academicSemesters(isVisible: true, limit: 100) { id name schoolYear termNumber isCurrent isVisible } }`,
    {},
  );
  return result.academicSemesters;
}
export async function loadWorkspace(input: {
  semesterId: number;
  kind: InspectionKind;
  page: number;
  teacherId?: string;
  keyword?: string;
}) {
  const data = await executeGraphQL<
    { result: Workspace },
    { input: typeof input & { limit: number } }
  >(
    `query TeachingInspectionWorkspace($input: InspectionWorkspaceInput!) { result: teachingInspectionWorkspace(input: $input) { today total teachers { staffId name } resources { resourceKey sourceVersion courseName teacherNames suggestedDates earliestDate latestDate blockers schedule { ${scheduleFields} } status { ${statusFields} } } } }`,
    { input: { ...input, limit: 20 } },
  );
  return data.result;
}
export async function dates(
  input: { semesterId: number; kind: InspectionKind; changes: DateChange[] },
  save: boolean,
) {
  const document = save
    ? `mutation SaveTeachingInspectionSchedule($input: InspectionDatesInput!) { result: saveTeachingInspectionSchedule(input: $input) { ${scheduleFields} } }`
    : `query TeachingInspectionDatePreview($input: InspectionDatesInput!) { result: teachingInspectionDatePreview(input: $input) { ${scheduleFields} } }`;
  return (
    await executeGraphQL<{ result: Schedule[] }, { input: typeof input }>(
      document,
      { input },
      { allowAuthRetry: false },
    )
  ).result;
}
export async function refreshStatus(input: Target, upstreamSessionToken: string) {
  return (
    await executeUpstreamSessionGraphQL<
      { result: SessionResult & { schedule: Schedule; status: Status } },
      { input: Target & { upstreamSessionToken: string } }
    >(
      `mutation RefreshTeachingInspectionStatus($input: InspectionTargetInput!) { result: refreshTeachingInspectionStatus(input: $input) { schedule { ${scheduleFields} } status { ${statusFields} } upstreamSessionToken expiresAt } }`,
      { input: { ...input, upstreamSessionToken } },
      { allowAuthRetry: false },
    )
  ).result;
}
export async function prepare(input: PrepareInput, upstreamSessionToken: string) {
  return (
    await executeUpstreamSessionGraphQL<
      { result: Prepared },
      { input: PrepareInput & { upstreamSessionToken: string } }
    >(
      prepareDocuments[input.kind],
      { input: { ...input, upstreamSessionToken } },
      { allowAuthRetry: false },
    )
  ).result;
}
export async function save(
  input: Target & {
    previewId: string;
    clientRequestId: string;
    scores?: number[];
    retryOfOperationId?: string;
  },
  upstreamSessionToken: string,
) {
  return (
    await executeUpstreamSessionGraphQL<
      { result: SessionResult & { operation: Operation; syncWarning?: string | null } },
      { input: typeof input & { upstreamSessionToken: string } }
    >(
      saveDocuments[input.kind],
      { input: { ...input, upstreamSessionToken } },
      { allowAuthRetry: false },
    )
  ).result;
}
export async function operation(
  input: Target & { operationId?: string; clientRequestId?: string },
) {
  return (
    await executeGraphQL<{ result: Operation }, { input: typeof input }>(
      `query TeachingInspectionOperation($input: InspectionOperationInput!) { result: teachingInspectionOperation(input: $input) { ${operationFields} } }`,
      { input },
    )
  ).result;
}
export async function closeUnstartedRequest(
  input: Target & {
    clientRequestId: string;
    action: 'PREPARE' | 'SAVE';
    round: number;
    checkDate: string;
  },
) {
  return (
    await executeGraphQL<{ result: Operation }, { input: typeof input }>(
      `mutation CloseUnstartedTeachingInspectionRequest($input: InspectionCloseRequestInput!) { result: closeUnstartedTeachingInspectionRequest(input: $input) { ${operationFields} } }`,
      { input },
      { allowAuthRetry: false },
    )
  ).result;
}

export async function audit(input: Target) {
  return (
    await executeGraphQL<{ result: Audit }, { input: Target }>(
      `query TeachingInspectionAudit($input: InspectionAuditInput!) { result: teachingInspectionAudit(input: $input) {
      operations { ${operationFields} } events { id reason createdAt beforeCount afterCount before { ${scheduleFields} } after { ${scheduleFields} } }
    } }`,
      { input },
    )
  ).result;
}
export async function resolveHistory(
  input: Target & {
    expectedVersion: number;
    recordKeys: (string | null)[];
    ignoredRecordKeys: string[];
    reason: string;
  },
  upstreamSessionToken: string,
) {
  return (
    await executeUpstreamSessionGraphQL<
      { result: SessionResult },
      { input: typeof input & { upstreamSessionToken: string } }
    >(
      `mutation ResolveTeachingInspectionHistory($input: InspectionResolveInput!) { result: resolveTeachingInspectionHistory(input: $input) { upstreamSessionToken expiresAt } }`,
      { input: { ...input, upstreamSessionToken } },
      { allowAuthRetry: false },
    )
  ).result;
}
