// src/labs/teaching-inspection/model.ts
export type InspectionKind = 'LESSON_PLAN' | 'PROGRESS' | 'ASSIGNMENT';
export type Target = { semesterId: number; kind: InspectionKind; resourceKey: string };
export type PrepareInput = Target & {
  round: number;
  checkDate: string;
  scheduleVersion: number;
  clientRequestId: string;
  retryOfOperationId?: string;
};
export type Operation = {
  id: string;
  accountId: number;
  requestId: string;
  action: string;
  round: number;
  checkDate: string;
  state: string;
  previewId: string | null;
};
export type HistoryRecord = {
  recordKey: string;
  checkDate: string;
  score: number | null;
  chapter?: string | null;
  updatedBy?: string | null;
  actualProgress?: number | null;
  plannedProgress?: number | null;
  deviation?: number | null;
};
export type Audit = {
  operations: Operation[];
  events: {
    id: number;
    reason: string;
    createdAt: string;
    beforeCount: number | null;
    afterCount: number | null;
    before: Schedule | null;
    after: Schedule | null;
  }[];
};
export type Schedule = {
  records: HistoryRecord[];
  historyState: string;
  version: number;
  dates: string[];
  rounds: {
    round: number;
    date: string;
    actualDate: string | null;
    recordKey: string | null;
    operationId: string | null;
    operationState: string | null;
    savedOperationId: string | null;
  }[];
};
export type RoundStatus = {
  dateEditable: boolean;
  dateBlockers: string[];
  round: number;
  covered: boolean;
  coverageBasis: string[];
  canPrepare: boolean;
  blockers: string[];
  retryAfter: string | null;
  retryWarningOperationId: string | null;
};
export type Status = {
  state: string;
  upstreamCount: number | null;
  observedAt: string | null;
  observationVersion: number;
  effectiveCoveredCount: number;
  rounds: RoundStatus[];
};
export type Resource = {
  resourceKey: string;
  sourceVersion: string;
  courseName: string;
  teacherNames: string[];
  suggestedDates: string[];
  earliestDate: string | null;
  latestDate: string | null;
  blockers: string[];
  schedule: Schedule;
  status: Status;
};
export type Workspace = {
  resources: Resource[];
  teachers: { staffId: string; name: string }[];
  total: number;
  today: string;
};
export type Assignment = {
  assignedBook: string;
  assignmentQuantity: string;
  knowledgeCoverage: string;
  allMarkingStatus: string;
  markingErrors: string;
  markingCorrections: string;
  markingAndDateDetails: string;
  studentCompletionStatus: string;
  studentCorrectionStatus: string;
  checkerOpinion: string;
};
export type Material = {
  lesson: {
    chapter: string;
    scores: number[];
    scoreItems: { name: string; description: string; maximum: number }[];
  } | null;
  progress: { actualProgress: number; plannedProgress: number; deviation: number } | null;
  assignment: Assignment | null;
};
export type Preview = {
  id: string;
  round: number;
  checkDate: string;
  scheduleVersion: number;
  observationVersion: number | null;
  expiresAt: string;
};
export type SessionResult = { upstreamSessionToken: string | null; expiresAt: string | null };
export type Prepared = SessionResult & {
  preview: Preview | null;
  operation: Operation | null;
  material: Material;
  blockers: string[];
};
export type DateChange = {
  expectedObservationVersion: number;
  resourceKey: string;
  expectedVersion: number;
  expectedSourceVersion: string;
  dates: string[];
};
export const kinds: { key: string; kind: InspectionKind; label: string }[] = [
  { key: 'lesson-plan', kind: 'LESSON_PLAN', label: '教案检查' },
  { key: 'progress', kind: 'PROGRESS', label: '教学进度' },
  { key: 'assignment', kind: 'ASSIGNMENT', label: '学生作业' },
];
const blockerLabels: Record<string, string> = {
  STATUS_UNKNOWN: '请先同步上游检查状态',
  NEXT_ROUND_REQUIRED: '请按顺序执行下一轮教学进度',
  SCHEDULE_REQUIRED: '请前往检查时间确认或调整三轮日期',
  FUTURE_DATE: '检查日期尚未到达',
  COMPLETED: '本轮已覆盖',
  STALE_PREVIEW: '依据已变化，请重新准备',
  PENDING_OPERATION: '有操作等待结果确认',
  RETRY_CONFIRMATION_REQUIRED: '继续前须确认重复风险',
  MATERIAL_UNVERIFIED: '当前材料无法核验，暂不能提交',
  NONZERO_PROGRESS: '进度有偏差，暂不能提交',
  MISSING_MAPPING: '缺少教学班映射',
  SHORT_COURSE: '有效授课周不足',
  HISTORY_UNKNOWN: '历史尚未确认',
  HISTORY_CONFLICT: '历史关联有冲突',
};
export const blockerText = (value: string) =>
  blockerLabels[value] ?? '当前条件不满足，请刷新后核对';
export const operationText = (state: string) =>
  ({
    PREPARED: '材料已准备',
    SAVED: '保存成功',
    VERIFIED: '已核实',
    UNKNOWN: '结果未确认',
    DISPATCHING: '等待确认',
    REJECTED: '未执行，已关闭',
  })[state] ?? '待核对';
export const statusText = (status: Status) =>
  status.state === 'UNREAD'
    ? '尚未刷新'
    : status.state === 'UNKNOWN'
      ? '数量暂不可确认'
      : `上游 ${status.upstreamCount} 次`;
export const basisText = (basis: string) =>
  ({ COUNT: '数量推定', RECORD: '记录关联', SAVED: '已知保存成功' })[basis] ?? '待核对';
export const isSaved = (op: Operation | null | undefined) =>
  op?.state === 'SAVED' || op?.state === 'VERIFIED';

export type TimeGroup = 'FULL' | 'FIRST' | 'SECOND' | 'CUSTOM';
export type TimePlan = {
  group?: TimeGroup;
  key: string;
  version: number;
  dates: string[];
  suggestedDates: string[];
  sourceVersion: string;
  confirmed: boolean;
  fullSemester: boolean;
  canEdit: boolean;
  earliestDate: string | null;
  latestDate: string | null;
};
export type TimePlanChange = {
  key: string;
  resourceKey?: string;
  expectedVersion: number;
  expectedSourceVersion: string;
  dates: string[];
};
export type GroupingStatus = {
  counts?: { group: TimeGroup; count: number }[];
  version: number;
  confirmed: boolean;
  canEdit: boolean;
  weeks: number;
  split: number;
  recommendedSplit: number;
  sourceVersion: string;
};
export type CourseGrouping = {
  group: TimeGroup | null;
  suggestedGroup: TimeGroup | null;
  start: number | null;
  end: number | null;
  needsReview: boolean;
  reason: string;
  preserved: boolean;
};
export type GroupingInput = {
  previewToken?: string;
  semesterId: number;
  expectedVersion: number;
  expectedSourceVersion: string;
  split?: number;
  confirmSuggested?: boolean;
  changes?: { resourceKey: string; group: TimeGroup; expectedSourceVersion: string }[];
};
export type GroupingResult = {
  previewToken: string;
  skipped: { resourceKey: string; courseName: string; reason: string }[];
  version: number;
  split: number;
  weeks: number;
  changes: {
    resourceKey: string;
    courseName: string;
    group: TimeGroup;
    beforeDates: string[];
    afterDates: string[];
  }[];
};
export type TimeWorkspace = {
  grouping?: GroupingStatus;
  groupPlans?: TimePlan[];
  semesterTimePlan: TimePlan;
  total: number;
  teachers: { staffId: string; name: string }[];
  resources: {
    resourceKey: string;
    courseName: string;
    teacherNames: string[];
    weeks: number[];
    sourceVersion: string;
    grouping?: CourseGrouping;
    blockers: string[];
    timePlan: TimePlan;
  }[];
};

export const groupNames: Record<TimeGroup, string> = {
  FULL: '全学期',
  FIRST: '前半学期',
  SECOND: '后半学期',
  CUSTOM: '独立例外',
};
