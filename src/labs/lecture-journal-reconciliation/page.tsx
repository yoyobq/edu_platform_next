import { useCallback, useEffect, useMemo, useState } from 'react';
import { InfoCircleOutlined } from '@ant-design/icons';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Skeleton,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useLoaderData } from 'react-router';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
} from '@/entities/academic-semester';
import { type StoredUpstreamSession, useUpstreamSession } from '@/entities/upstream-session';

import { lectureJournalReconciliationLabAccess } from './access';
import {
  fetchLectureJournalDepartmentOptions,
  fetchLectureJournalReconciliation,
  fetchTeacherDirectory,
  isExpiredUpstreamSessionError,
  type LectureJournalDepartmentOption,
  type LectureJournalReconciliationItem,
  type LectureJournalReconciliationResult,
  type MissingLectureJournalItem,
  resolveUpstreamErrorMessage,
  type TeacherDirectoryEntry,
  type TeacherDirectoryResult,
  type UnmatchedLectureJournalPlanItem,
} from './api';
import { lectureJournalReconciliationLabMeta } from './meta';

import './page.css';

type LectureJournalReconciliationLabLoaderData = {
  defaultDepartmentId?: string | null;
  defaultStaffId?: string | null;
  upstreamAccount?: {
    accountId: number;
    displayName: string;
  } | null;
  viewerKind?: 'authenticated' | 'internal';
} | null;

type UpstreamLoginFormValues = {
  password: string;
  userId: string;
};

type PendingAction = 'directory' | 'query' | null;

const DEFAULT_DEPARTMENT_ID = 'ORG0302';
const DAY_OF_WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const TOPIC_RECORD_OPTIONS = ['优', '良', '中', '差'];

type MetricTone = 'default' | 'success' | 'warning';

type DepartmentOption = {
  id: string;
  label: string;
};

type JournalEditableCardItem = {
  courseContent: string | null;
  courseId: string | null;
  courseName: string | null;
  dayOfWeek: number | null;
  homework: string | null;
  journal: LectureJournalReconciliationItem['journal'];
  key: string;
  lecturePlanDetailId: string | null;
  lecturePlanId: string | null;
  lessonHours: number | null;
  schoolYear: string | null;
  sectionId: string | null;
  sectionName: string | null;
  semester: string | null;
  status: 'FILLED' | 'MISSING';
  teacherId: string | null;
  teacherName: string | null;
  teachingClassId: string | null;
  teachingClassName: string | null;
  teachingDate: string | null;
  weekNumber: number | null;
};

type JournalDraft = {
  courseContent: string;
  homeworkAssignment: string;
  submitStatusText: string;
  topicRecord: string;
};

type JournalDraftMap = Record<string, JournalDraft>;
type FieldTipConfig = {
  fields: string[];
  note?: string;
};

function sortSemesters(records: AcademicSemesterRecord[]) {
  return [...records].sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) {
      return left.isCurrent ? -1 : 1;
    }

    if (left.schoolYear !== right.schoolYear) {
      return right.schoolYear - left.schoolYear;
    }

    if (left.termNumber !== right.termNumber) {
      return right.termNumber - left.termNumber;
    }

    return right.id - left.id;
  });
}

function pickNextSemesterId(records: AcademicSemesterRecord[], currentSelection: number | null) {
  if (currentSelection !== null && records.some((record) => record.id === currentSelection)) {
    return currentSelection;
  }

  return records.find((record) => record.isCurrent)?.id ?? records[0]?.id ?? null;
}

function normalizeOptionalString(value: string) {
  const normalizedValue = value.trim();

  return normalizedValue ? normalizedValue : '';
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '未返回';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatTeachingDate(value: string | null | undefined) {
  if (!value) {
    return '待识别';
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
    weekday: 'short',
  }).format(date);
}

function resolveCampusSubmitStatusTagColor(statusText: string) {
  const normalizedStatus = statusText.trim();

  if (normalizedStatus === '审核中') {
    return 'processing';
  }

  if (normalizedStatus === '待提交') {
    return 'warning';
  }

  if (normalizedStatus === '已审核') {
    return 'success';
  }

  return normalizedStatus ? 'default' : 'default';
}

function resolveCampusSubmitStatusTagLabel(statusText: string) {
  const normalizedStatus = statusText.trim();

  if (normalizedStatus === '审核中') {
    return '校园网审核中';
  }

  if (normalizedStatus === '待提交') {
    return '校园网待提交';
  }

  if (normalizedStatus === '已审核') {
    return '校园网已审核';
  }

  if (!normalizedStatus) {
    return '校园网未提交';
  }

  return `校园网${normalizedStatus}`;
}

function resolveStatusColor(status: LectureJournalReconciliationItem['status']) {
  if (status === 'FILLED') {
    return 'success';
  }

  if (status === 'MISSING') {
    return 'warning';
  }

  return 'default';
}

function resolveStatusLabel(status: LectureJournalReconciliationItem['status']) {
  if (status === 'FILLED') {
    return '已填写';
  }

  if (status === 'MISSING') {
    return '疑似未填';
  }

  return '无法对账';
}

function resolveStatusTone(status: JournalEditableCardItem['status']) {
  return status === 'FILLED' ? 'success' : 'warning';
}

function buildTeacherOptionLabel(teacher: TeacherDirectoryEntry) {
  const normalizedCode = teacher.code.trim();

  return normalizedCode ? `${teacher.name} (${normalizedCode})` : teacher.name;
}

function buildDepartmentOptionLabel(department: LectureJournalDepartmentOption) {
  return `${department.departmentName}${department.shortName ? ` (${department.shortName})` : ''}`;
}

function buildItemKey(item: {
  lecturePlanDetailId: string | null;
  lecturePlanId: string | null;
  matchKey?: string | null;
  reason?: string | null;
}) {
  return [
    item.lecturePlanDetailId || 'detail',
    item.lecturePlanId || 'plan',
    item.matchKey || 'match',
    item.reason || 'reason',
  ].join('-');
}

function buildFieldTipTitle(config: FieldTipConfig) {
  const parts = [`接口字段：${config.fields.join(' / ')}`];

  if (config.note) {
    parts.push(config.note);
  }

  return parts.join('；');
}

function renderFieldLabel(label: string, config: FieldTipConfig) {
  return (
    <span className="lecture-journal-field-label">
      <span>{label}</span>
      <Tooltip placement="topLeft" title={buildFieldTipTitle(config)}>
        <button
          aria-label={`${label} 字段提示`}
          className="lecture-journal-field-tip-trigger"
          type="button"
        >
          <InfoCircleOutlined />
        </button>
      </Tooltip>
    </span>
  );
}

function renderMetricTile({
  detail,
  label,
  tone = 'default',
  value,
}: {
  detail?: string;
  label: string;
  tone?: MetricTone;
  value: number | string;
}) {
  return (
    <div className={`lecture-journal-metric lecture-journal-metric-${tone}`}>
      <div className="lecture-journal-metric-label">
        <Typography.Text type="secondary">{label}</Typography.Text>
      </div>
      <div className="lecture-journal-metric-value">
        <Typography.Title level={3}>{value}</Typography.Title>
      </div>
      {detail ? (
        <div className="lecture-journal-metric-detail">
          <Typography.Text type="secondary">{detail}</Typography.Text>
        </div>
      ) : null}
    </div>
  );
}

async function requestTeacherDirectoryWithSession(session: StoredUpstreamSession) {
  return fetchTeacherDirectory({
    sessionToken: session.upstreamSessionToken,
  });
}

function resolveSectionLabel(sectionName: string | null, sectionId: string | null) {
  return sectionName || sectionId || '节次待识别';
}

function resolveTeacherLabel(teacherName: string | null, teacherId: string | null) {
  return teacherName || teacherId || '教师待识别';
}

function resolveTeachingDateTimestamp(value: string | null) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = new Date(`${value}T00:00:00Z`).getTime();

  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function buildEditableCardItemFromReconciliation(
  item: LectureJournalReconciliationItem,
): JournalEditableCardItem | null {
  if (item.status !== 'FILLED' && item.status !== 'MISSING') {
    return null;
  }

  return {
    courseContent: item.courseContent,
    courseId: item.courseId,
    courseName: item.courseName,
    dayOfWeek: item.dayOfWeek,
    homework: item.homework,
    journal: item.journal,
    key: buildItemKey(item),
    lecturePlanDetailId: item.lecturePlanDetailId,
    lecturePlanId: item.lecturePlanId,
    lessonHours: item.lessonHours,
    schoolYear: item.schoolYear,
    sectionId: item.sectionId,
    sectionName: item.sectionName,
    semester: item.semester,
    status: item.status,
    teacherId: item.teacherId,
    teacherName: item.teacherName,
    teachingClassId: item.teachingClassId,
    teachingClassName: item.teachingClassName,
    teachingDate: item.teachingDate,
    weekNumber: item.weekNumber,
  };
}

function buildEditableCardItemFromMissing(
  item: MissingLectureJournalItem,
): JournalEditableCardItem {
  return {
    courseContent: item.courseContent,
    courseId: item.courseId,
    courseName: item.courseName,
    dayOfWeek: item.dayOfWeek,
    homework: item.homework,
    journal: null,
    key: buildItemKey(item),
    lecturePlanDetailId: item.lecturePlanDetailId,
    lecturePlanId: item.lecturePlanId,
    lessonHours: item.lessonHours,
    schoolYear: item.schoolYear,
    sectionId: item.sectionId,
    sectionName: item.sectionName,
    semester: item.semester,
    status: 'MISSING',
    teacherId: item.teacherId,
    teacherName: item.teacherName,
    teachingClassId: item.teachingClassId,
    teachingClassName: item.teachingClassName,
    teachingDate: item.teachingDate,
    weekNumber: item.weekNumber,
  };
}

function pickNearestFilledJournalTemplate(
  target: JournalEditableCardItem,
  filledItems: JournalEditableCardItem[],
) {
  const candidateGroups = [
    filledItems.filter(
      (item) =>
        Boolean(target.teachingClassId) &&
        item.teachingClassId === target.teachingClassId &&
        item.journal,
    ),
    filledItems.filter(
      (item) => Boolean(target.courseId) && item.courseId === target.courseId && item.journal,
    ),
    filledItems.filter(
      (item) =>
        Boolean(target.courseName) &&
        item.courseName === target.courseName &&
        Boolean(item.journal),
    ),
  ];

  const candidates = candidateGroups.find((group) => group.length > 0) ?? [];

  if (candidates.length === 0) {
    return null;
  }

  const targetTimestamp = resolveTeachingDateTimestamp(target.teachingDate);

  return [...candidates].sort((left, right) => {
    const leftDistance = Math.abs(
      resolveTeachingDateTimestamp(left.teachingDate) - targetTimestamp,
    );
    const rightDistance = Math.abs(
      resolveTeachingDateTimestamp(right.teachingDate) - targetTimestamp,
    );

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return (
      resolveTeachingDateTimestamp(left.teachingDate) -
      resolveTeachingDateTimestamp(right.teachingDate)
    );
  })[0];
}

function buildJournalDrafts(items: JournalEditableCardItem[]): JournalDraftMap {
  const filledItems = items.filter((item) => item.status === 'FILLED' && item.journal);

  return items.reduce<JournalDraftMap>((result, item) => {
    if (item.status === 'FILLED' && item.journal) {
      result[item.key] = {
        courseContent: item.journal.courseContent || '',
        homeworkAssignment: item.journal.homeworkAssignment || '',
        submitStatusText: item.journal.statusName || item.journal.statusCode || '',
        topicRecord: item.journal.topicRecord || '',
      };

      return result;
    }

    const template = pickNearestFilledJournalTemplate(item, filledItems);

    result[item.key] = {
      courseContent: template?.journal?.courseContent || '',
      homeworkAssignment: template?.journal?.homeworkAssignment || '',
      submitStatusText: '',
      topicRecord: template?.journal?.topicRecord || '',
    };

    return result;
  }, {});
}

function buildPlanSnapshot(item: JournalEditableCardItem) {
  return JSON.stringify(
    {
      lecturePlanId: item.lecturePlanId,
      lecturePlanDetailId: item.lecturePlanDetailId,
      schoolYear: item.schoolYear,
      semester: item.semester,
      courseId: item.courseId,
      courseName: item.courseName,
      teachingClassId: item.teachingClassId,
      teachingClassName: item.teachingClassName,
      teacherId: item.teacherId,
      teacherName: item.teacherName,
      teachingDate: item.teachingDate,
      weekNumber: item.weekNumber,
      dayOfWeek: item.dayOfWeek,
      sectionId: item.sectionId,
      sectionName: item.sectionName,
      lessonHours: item.lessonHours,
      courseContent: item.courseContent,
      homework: item.homework,
    },
    null,
    2,
  );
}

function renderMissingPlanSnapshotTrigger(item: JournalEditableCardItem) {
  return (
    <Tooltip
      placement="bottomRight"
      title={
        <div className="lecture-journal-plan-tooltip">
          <div className="lecture-journal-plan-tooltip-title">计划侧返回字段</div>
          <div className="lecture-journal-plan-tooltip-note">
            当前接口未返回 rawPlan /
            rawPlanDetail，这里展示对账结果里的计划侧字段，方便核对未提交项。
          </div>
          <pre>{buildPlanSnapshot(item)}</pre>
        </div>
      }
    >
      <button
        aria-label="查看计划侧原始数据"
        className="lecture-journal-plan-tooltip-trigger"
        type="button"
      >
        !
      </button>
    </Tooltip>
  );
}

export function LectureJournalReconciliationLabPage() {
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const loaderData = useLoaderData() as LectureJournalReconciliationLabLoaderData;
  const {
    clear,
    login: loginUpstream,
    persistRollingSession,
    session: storedSession,
  } = useUpstreamSession({
    account: loaderData?.upstreamAccount ?? null,
  });
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [departmentId, setDepartmentId] = useState(DEFAULT_DEPARTMENT_ID);
  const [staffId, setStaffId] = useState(loaderData?.defaultStaffId ?? '');
  const [directoryResult, setDirectoryResult] = useState<TeacherDirectoryResult | null>(null);
  const [reconciliationResult, setReconciliationResult] =
    useState<LectureJournalReconciliationResult | null>(null);
  const [isLoadingSemesters, setIsLoadingSemesters] = useState(true);
  const [isLoadingDepartmentOptions, setIsLoadingDepartmentOptions] = useState(true);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [isLoadingReconciliation, setIsLoadingReconciliation] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [departmentOptionsError, setDepartmentOptionsError] = useState<string | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [journalDrafts, setJournalDrafts] = useState<JournalDraftMap>({});
  const [queryError, setQueryError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const clearCurrentSession = useCallback(() => {
    clear();
    setDirectoryResult(null);
  }, [clear]);

  const openLoginModal = useCallback(() => {
    setLoginError(null);
    loginForm.setFieldsValue({
      password: '',
      userId: storedSession?.upstreamLoginId ?? '',
    });
    setIsLoginModalOpen(true);
  }, [loginForm, storedSession?.upstreamLoginId]);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      setIsLoadingSemesters(true);
      setIsLoadingDepartmentOptions(true);
      setSemesterError(null);
      setDepartmentOptionsError(null);

      try {
        const [semesterResult, departmentResult] = await Promise.allSettled([
          requestAcademicSemesters({ limit: 500 }),
          fetchLectureJournalDepartmentOptions(),
        ]);

        if (cancelled) {
          return;
        }

        const nextSemesters =
          semesterResult.status === 'fulfilled' ? sortSemesters(semesterResult.value) : [];
        const nextDepartmentOptions =
          departmentResult.status === 'fulfilled'
            ? departmentResult.value
                .filter((department) => department.id !== '')
                .map((department) => ({
                  id: department.id,
                  label: buildDepartmentOptionLabel(department),
                }))
            : [];

        setSemesters(nextSemesters);
        setDepartmentOptions(nextDepartmentOptions);
        setSelectedSemesterId((currentSelection) =>
          pickNextSemesterId(nextSemesters, currentSelection),
        );
        setSemesterError(
          semesterResult.status === 'rejected'
            ? semesterResult.reason instanceof Error
              ? semesterResult.reason.message
              : '暂时无法加载学期列表。'
            : null,
        );
        setDepartmentOptionsError(
          departmentResult.status === 'rejected'
            ? departmentResult.reason instanceof Error
              ? departmentResult.reason.message
              : '暂时无法加载院系列表。'
            : null,
        );
      } catch (error) {
        if (!cancelled) {
          setSemesterError(error instanceof Error ? error.message : '暂时无法加载学期列表。');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSemesters(false);
          setIsLoadingDepartmentOptions(false);
        }
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!departmentId) {
      setDepartmentId(DEFAULT_DEPARTMENT_ID);
    }
  }, [departmentId]);

  useEffect(() => {
    if (!staffId && loaderData?.defaultStaffId) {
      setStaffId(loaderData.defaultStaffId);
    }
  }, [loaderData?.defaultStaffId, staffId]);

  const selectedSemester = semesters.find((record) => record.id === selectedSemesterId) ?? null;
  const normalizedDepartmentId = normalizeOptionalString(departmentId);
  const normalizedStaffId = normalizeOptionalString(staffId);
  const hasFilterPairMismatch = Boolean(normalizedDepartmentId) !== Boolean(normalizedStaffId);
  const hasNoDepartmentOptions =
    !isLoadingDepartmentOptions && !departmentOptionsError && departmentOptions.length === 0;
  const teacherOptions = (directoryResult?.teachers ?? []).map((teacher) => ({
    label: buildTeacherOptionLabel(teacher),
    value: teacher.value,
  }));
  const selectedDepartmentOption = departmentOptions.find(
    (department) => department.id === normalizedDepartmentId,
  );
  const selectedTeacherOption = (directoryResult?.teachers ?? []).find(
    (teacher) => teacher.value === normalizedStaffId,
  );
  const selectedDepartmentLabel =
    selectedDepartmentOption?.label || normalizedDepartmentId || '未指定系部';
  const selectedTeacherLabel = selectedTeacherOption?.name || normalizedStaffId || '全体教师';
  const editableItems = useMemo(
    () =>
      (reconciliationResult?.items ?? [])
        .map((item) => buildEditableCardItemFromReconciliation(item))
        .filter((item): item is JournalEditableCardItem => item !== null),
    [reconciliationResult?.items],
  );
  const missingEditableItems = useMemo(
    () => (reconciliationResult?.missingItems ?? []).map(buildEditableCardItemFromMissing),
    [reconciliationResult?.missingItems],
  );
  const reconciliationBaseCount =
    (reconciliationResult?.filledCount ?? 0) + (reconciliationResult?.missingCount ?? 0);
  const fillRate =
    reconciliationBaseCount > 0
      ? `${Math.round(((reconciliationResult?.filledCount ?? 0) / reconciliationBaseCount) * 100)}%`
      : '无可对账课次';

  useEffect(() => {
    setJournalDrafts(buildJournalDrafts(editableItems));
  }, [editableItems]);

  const updateJournalDraft = useCallback(
    (
      key: string,
      patch: Partial<
        Pick<
          JournalDraft,
          'courseContent' | 'homeworkAssignment' | 'submitStatusText' | 'topicRecord'
        >
      >,
    ) => {
      setJournalDrafts((current) => ({
        ...current,
        [key]: {
          ...(current[key] ?? {
            courseContent: '',
            homeworkAssignment: '',
            submitStatusText: '',
            topicRecord: '',
          }),
          ...patch,
        },
      }));
    },
    [],
  );

  function renderJournalDraftCard(item: JournalEditableCardItem) {
    const draft =
      journalDrafts[item.key] ??
      ({
        courseContent: '',
        homeworkAssignment: '',
        submitStatusText: '',
        topicRecord: '',
      } satisfies JournalDraft);
    const statusTone = resolveStatusTone(item.status);

    return (
      <article
        className={`lecture-journal-record lecture-journal-record-${statusTone}`}
        key={item.key}
      >
        <div className="lecture-journal-record-header">
          <div className="lecture-journal-record-title-group">
            <div className="lecture-journal-record-title-row">
              <span
                aria-label={resolveStatusLabel(item.status)}
                className={`lecture-journal-record-status-dot lecture-journal-record-status-dot-${resolveStatusColor(item.status)}`}
                title={resolveStatusLabel(item.status)}
              />
              <Tooltip placement="topLeft" title="接口字段：courseName / courseId">
                <div className="lecture-journal-record-title">
                  <Typography.Title level={5}>{item.courseName || '未命名课程'}</Typography.Title>
                </div>
              </Tooltip>
              <Tooltip placement="top" title="接口字段：sectionName / sectionId">
                <Tag bordered={false}>{resolveSectionLabel(item.sectionName, item.sectionId)}</Tag>
              </Tooltip>
              <Tooltip placement="top" title="接口字段：teachingClassName / teachingClassId">
                <Tag bordered={false}>{item.teachingClassName || '教学班待识别'}</Tag>
              </Tooltip>
              <Tooltip placement="top" title="接口字段：teachingDate">
                <Tag bordered={false}>{formatTeachingDate(item.teachingDate)}</Tag>
              </Tooltip>
              <Tooltip placement="top" title="接口字段：weekNumber">
                <Tag bordered={false}>
                  {item.weekNumber ? `第 ${item.weekNumber} 周` : '周次待识别'}
                </Tag>
              </Tooltip>
              <Tooltip placement="top" title="接口字段：dayOfWeek">
                <Tag bordered={false}>
                  {item.dayOfWeek
                    ? DAY_OF_WEEK_LABELS[item.dayOfWeek - 1] || `周${item.dayOfWeek}`
                    : '星期待识别'}
                </Tag>
              </Tooltip>
              <Tooltip placement="top" title="接口字段：teacherName / teacherId">
                <Tag bordered={false}>{resolveTeacherLabel(item.teacherName, item.teacherId)}</Tag>
              </Tooltip>
            </div>
          </div>

          <div className="lecture-journal-record-status">
            <Tooltip placement="topRight" title="接口字段：journal.statusName / journal.statusCode">
              <Tag color={resolveCampusSubmitStatusTagColor(draft.submitStatusText)}>
                {resolveCampusSubmitStatusTagLabel(draft.submitStatusText)}
              </Tag>
            </Tooltip>
            {item.status === 'MISSING' ? renderMissingPlanSnapshotTrigger(item) : null}
          </div>
        </div>

        <div className="lecture-journal-editor">
          <div className="lecture-journal-editor-grid">
            <label className="lecture-journal-inline-field lecture-journal-inline-field-topic">
              {renderFieldLabel('课堂记录', {
                fields: ['journal.topicRecord'],
              })}
              <Select
                allowClear
                options={TOPIC_RECORD_OPTIONS.map((value) => ({ label: value, value }))}
                placeholder="选择"
                size="small"
                value={draft.topicRecord || undefined}
                onChange={(value) => {
                  updateJournalDraft(item.key, { topicRecord: value || '' });
                }}
              />
            </label>

            <label className="lecture-journal-inline-field">
              {renderFieldLabel('课程内容', {
                fields: ['journal.courseContent', 'courseContent'],
                note: '前者为日志侧，后者为计划侧参考',
              })}
              <Input
                placeholder="使用日志侧内容预填，可继续调整"
                size="small"
                value={draft.courseContent}
                onChange={(event) => {
                  updateJournalDraft(item.key, { courseContent: event.target.value });
                }}
              />
            </label>

            <label className="lecture-journal-inline-field">
              {renderFieldLabel('作业', {
                fields: ['journal.homeworkAssignment', 'homework'],
                note: '前者为日志侧，后者为计划侧参考',
              })}
              <Input
                placeholder="使用日志侧作业预填，可继续调整"
                size="small"
                value={draft.homeworkAssignment}
                onChange={(event) => {
                  updateJournalDraft(item.key, { homeworkAssignment: event.target.value });
                }}
              />
            </label>
          </div>
        </div>
      </article>
    );
  }

  function renderUnmatchedCard(item: UnmatchedLectureJournalPlanItem) {
    return (
      <article className="lecture-journal-unmatched" key={buildItemKey(item)}>
        <div className="lecture-journal-unmatched-heading">
          <Tag color="default">无法对账</Tag>
          <Typography.Text strong>{item.reason}</Typography.Text>
        </div>
        <div className="lecture-journal-unmatched-grid">
          <Typography.Text type="secondary">计划：{item.lecturePlanId || '缺失'}</Typography.Text>
          <Typography.Text type="secondary">
            详情：{item.lecturePlanDetailId || '缺失'}
          </Typography.Text>
          <Typography.Text type="secondary">
            教学班：{item.teachingClassId || '缺失'}
          </Typography.Text>
        </div>
      </article>
    );
  }

  async function runDirectoryAction(sessionOverride?: StoredUpstreamSession) {
    const session = sessionOverride ?? storedSession;

    if (!session) {
      setPendingAction('directory');
      setLoginError(null);
      setIsLoginModalOpen(true);
      return;
    }

    setIsLoadingDirectory(true);
    setDirectoryError(null);

    try {
      const result = await requestTeacherDirectoryWithSession(session);

      persistRollingSession(session, {
        expiresAt: result.expiresAt,
        upstreamSessionToken: result.upstreamSessionToken,
      });
      setDirectoryResult(result);
    } catch (error) {
      if (isExpiredUpstreamSessionError(error)) {
        clearCurrentSession();
        setPendingAction('directory');
        setLoginError('upstream 会话已失效，请重新登录后继续。');
        openLoginModal();
        return;
      }

      setDirectoryError(resolveUpstreamErrorMessage(error, '暂时无法加载教师字典。'));
    } finally {
      setIsLoadingDirectory(false);
    }
  }

  async function runQueryAction(sessionOverride?: StoredUpstreamSession) {
    const session = sessionOverride ?? storedSession;

    if (!session) {
      setPendingAction('query');
      setLoginError(null);
      setIsLoginModalOpen(true);
      return;
    }

    if (!selectedSemester) {
      return;
    }

    setIsLoadingReconciliation(true);
    setQueryError(null);

    try {
      const result = await fetchLectureJournalReconciliation({
        departmentId: normalizedDepartmentId || undefined,
        schoolYear: String(selectedSemester.schoolYear),
        semester: String(selectedSemester.termNumber),
        sessionToken: session.upstreamSessionToken,
        staffId: normalizedStaffId || undefined,
      });

      persistRollingSession(session, {
        expiresAt: result.expiresAt,
        upstreamSessionToken: result.upstreamSessionToken,
      });
      setReconciliationResult(result);
    } catch (error) {
      if (isExpiredUpstreamSessionError(error)) {
        clearCurrentSession();
        setPendingAction('query');
        setLoginError('upstream 会话已失效，请重新登录后继续。');
        openLoginModal();
        return;
      }

      setQueryError(resolveUpstreamErrorMessage(error, '暂时无法加载教学日志对账结果。'));
    } finally {
      setIsLoadingReconciliation(false);
    }
  }

  async function handleLogin(values: UpstreamLoginFormValues) {
    if (!loaderData?.upstreamAccount) {
      setLoginError('当前登录账号尚未就绪，请稍后再试。');
      return;
    }

    setIsSubmittingLogin(true);
    setLoginError(null);

    try {
      const nextSession = await loginUpstream(values);

      setIsLoginModalOpen(false);
      const nextPendingAction = pendingAction;

      setPendingAction(null);
      loginForm.resetFields();

      if (nextPendingAction === 'directory') {
        await runDirectoryAction(nextSession);
      }

      if (nextPendingAction === 'query') {
        await runQueryAction(nextSession);
      }
    } catch (error) {
      setLoginError(resolveUpstreamErrorMessage(error, '暂时无法建立 upstream 会话。'));
    } finally {
      setIsSubmittingLogin(false);
    }
  }

  return (
    <div className="lecture-journal-page flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Typography.Title level={3} style={{ margin: 0 }}>
          教学日志填写对账
        </Typography.Title>
        <Typography.Paragraph style={{ margin: 0 }} type="secondary">
          基于上游教学计划详情和教学日志，统计指定学年学期内每个课次的填写状态。优先用于查看某位教师在某学期的已填、疑似未填和无法对账课次。
        </Typography.Paragraph>
      </div>

      <Alert
        description="查询时只要求学期。若要按教师过滤，departmentId 和 staffId 必须同时传入；两者都留空则按整学期全量对账。"
        message="接口口径"
        showIcon
        type="info"
      />

      <div className="lecture-journal-control-card">
        <Card>
          <div className="flex flex-col gap-4">
            {!storedSession ? (
              <Alert
                action={
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => {
                      setPendingAction(null);
                      openLoginModal();
                    }}
                  >
                    登录上游
                  </Button>
                }
                description="当前页面依赖上游 sessionToken。可以直接在此登录，或复用同账号已有的上游会话。"
                message="尚未建立 upstream 会话"
                showIcon
                type="warning"
              />
            ) : (
              <Descriptions column={3} size="small">
                <Descriptions.Item label="上游登录 ID">
                  {storedSession.upstreamLoginId || '未记录'}
                </Descriptions.Item>
                <Descriptions.Item label="会话过期时间">
                  {formatDateTime(storedSession.expiresAt)}
                </Descriptions.Item>
                <Descriptions.Item label="当前视图身份">
                  {loaderData?.viewerKind ?? 'unknown'}
                </Descriptions.Item>
              </Descriptions>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="flex flex-col gap-2">
                <Typography.Text strong>学期</Typography.Text>
                {isLoadingSemesters ? (
                  <Skeleton.Button active block />
                ) : (
                  <Select
                    options={semesters.map((semester) => ({
                      label: `${semester.name}${semester.isCurrent ? ' · 当前' : ''}`,
                      value: semester.id,
                    }))}
                    placeholder="请选择学期"
                    value={selectedSemesterId ?? undefined}
                    onChange={(value) => setSelectedSemesterId(value)}
                  />
                )}
              </label>

              <label className="flex flex-col gap-2">
                <Typography.Text strong>departmentId</Typography.Text>
                <Select
                  loading={isLoadingDepartmentOptions}
                  disabled={isLoadingDepartmentOptions || departmentOptions.length === 0}
                  notFoundContent={hasNoDepartmentOptions ? '当前未返回可选院系' : undefined}
                  optionFilterProp="label"
                  options={departmentOptions.map((option) => ({
                    label: option.label,
                    value: option.id,
                  }))}
                  placeholder="请选择院系"
                  showSearch
                  value={departmentId}
                  onChange={(value) => setDepartmentId(value)}
                />
              </label>

              <label className="flex flex-col gap-2">
                <Typography.Text strong>教师 staffId</Typography.Text>
                <AutoComplete
                  options={teacherOptions}
                  placeholder={loaderData?.defaultStaffId || '先加载教师字典，或直接输入 staffId'}
                  value={staffId}
                  onChange={setStaffId}
                  filterOption={(inputValue, option) =>
                    String(option?.label || '')
                      .toLowerCase()
                      .includes(inputValue.trim().toLowerCase()) ||
                    String(option?.value || '')
                      .toLowerCase()
                      .includes(inputValue.trim().toLowerCase())
                  }
                />
              </label>

              <div className="flex flex-col gap-2">
                <Typography.Text strong>当前筛选</Typography.Text>
                <div className="lecture-journal-filter-summary">
                  <Typography.Text strong>{selectedSemester?.name || '未选择学期'}</Typography.Text>
                  <Typography.Text type="secondary">{selectedTeacherLabel}</Typography.Text>
                  <Typography.Text type="secondary">{selectedDepartmentLabel}</Typography.Text>
                </div>
              </div>
            </div>

            {semesterError ? <Alert message={semesterError} showIcon type="error" /> : null}
            {departmentOptionsError ? (
              <Alert message={departmentOptionsError} showIcon type="error" />
            ) : null}
            {directoryError ? <Alert message={directoryError} showIcon type="error" /> : null}
            {hasFilterPairMismatch ? (
              <Alert
                message="按教师过滤时，departmentId 和 staffId 需要同时填写。"
                showIcon
                type="warning"
              />
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button
                loading={isLoadingDirectory}
                onClick={() => {
                  void runDirectoryAction();
                }}
              >
                加载教师字典
              </Button>
              <Button
                type="primary"
                disabled={!selectedSemester || hasFilterPairMismatch}
                loading={isLoadingReconciliation}
                onClick={() => {
                  void runQueryAction();
                }}
              >
                查询对账
              </Button>
              <Button
                disabled={!normalizedDepartmentId && !normalizedStaffId}
                onClick={() => {
                  setDepartmentId(DEFAULT_DEPARTMENT_ID);
                  setStaffId(loaderData?.defaultStaffId ?? '');
                }}
              >
                恢复默认筛选
              </Button>
              <Button
                disabled={!storedSession}
                onClick={() => {
                  clearCurrentSession();
                }}
              >
                清除 upstream 会话
              </Button>
              <Button
                disabled={!storedSession}
                onClick={() => {
                  setPendingAction(null);
                  openLoginModal();
                }}
              >
                重新登录 upstream
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {queryError ? <Alert message={queryError} showIcon type="error" /> : null}

      {isLoadingReconciliation ? <Skeleton active paragraph={{ rows: 8 }} /> : null}

      {!isLoadingReconciliation && reconciliationResult ? (
        <div className="flex flex-col gap-6">
          <div className="lecture-journal-metric-grid">
            {renderMetricTile({
              label: '已填写',
              tone: 'success',
              value: reconciliationResult.filledCount,
            })}
            {renderMetricTile({
              label: '疑似未填',
              tone: 'warning',
              value: reconciliationResult.missingCount,
            })}
            {renderMetricTile({
              label: '无法对账',
              value: reconciliationResult.unmatchedPlanItemCount,
            })}
            {renderMetricTile({
              detail: `详情 ${reconciliationResult.planDetailCount}`,
              label: '计划',
              value: reconciliationResult.planCount,
            })}
            {renderMetricTile({
              label: '教学日志',
              value: reconciliationResult.journalCount,
            })}
            {renderMetricTile({
              detail: '不含无法对账项',
              label: '填写率',
              value: fillRate,
            })}
          </div>

          <section className="lecture-journal-result-summary">
            <Descriptions column={3} size="small">
              <Descriptions.Item label="学期">
                {selectedSemester?.name || '未选择'}
              </Descriptions.Item>
              <Descriptions.Item label="教师">{selectedTeacherLabel}</Descriptions.Item>
              <Descriptions.Item label="departmentId">{selectedDepartmentLabel}</Descriptions.Item>
              <Descriptions.Item label="返回条数">
                完整 {reconciliationResult.items.length} / 未填{' '}
                {reconciliationResult.missingItems.length}
              </Descriptions.Item>
              <Descriptions.Item label="会话续期">
                {formatDateTime(reconciliationResult.expiresAt)}
              </Descriptions.Item>
              <Descriptions.Item label="对账顺序">按时间升序</Descriptions.Item>
            </Descriptions>
          </section>

          <div className="lecture-journal-tabs">
            <Tabs
              items={[
                {
                  key: 'items',
                  label: `完整对账 (${reconciliationResult.items.length})`,
                  children:
                    editableItems.length === 0 ? (
                      <Empty
                        description="当前查询没有返回任何可展示课次。"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    ) : (
                      <div className="flex flex-col gap-4">
                        {editableItems.map((item) => renderJournalDraftCard(item))}
                      </div>
                    ),
                },
                {
                  key: 'missing',
                  label: `疑似未填 (${reconciliationResult.missingItems.length})`,
                  children:
                    missingEditableItems.length === 0 ? (
                      <Empty
                        description="当前查询没有疑似未填课次。"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    ) : (
                      <div className="flex flex-col gap-4">
                        {missingEditableItems.map((item) => renderJournalDraftCard(item))}
                      </div>
                    ),
                },
                {
                  key: 'unmatched',
                  label: `无法对账 (${reconciliationResult.unmatchedPlanItems.length})`,
                  children:
                    reconciliationResult.unmatchedPlanItems.length === 0 ? (
                      <Empty
                        description="当前查询没有无法对账的计划项。"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    ) : (
                      <div className="flex flex-col gap-4">
                        {reconciliationResult.unmatchedPlanItems.map((item) =>
                          renderUnmatchedCard(item),
                        )}
                      </div>
                    ),
                },
              ]}
            />
          </div>
        </div>
      ) : null}

      {!isLoadingReconciliation && !reconciliationResult && selectedSemester ? (
        <Alert
          description="完成学期和教师筛选后点击“查询对账”，页面会返回完整课次列表、疑似未填列表和无法对账计划项。"
          message="准备完成"
          showIcon
          type="success"
        />
      ) : null}

      <section className="lecture-journal-lab-meta">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Lab meta">
            {lectureJournalReconciliationLabMeta.purpose}
          </Descriptions.Item>
          <Descriptions.Item label="访问范围">
            {lectureJournalReconciliationLabAccess.allowedAccessLevels.join(' / ')}
          </Descriptions.Item>
        </Descriptions>
      </section>

      <Modal
        destroyOnHidden
        footer={null}
        open={isLoginModalOpen}
        title="登录 upstream"
        onCancel={() => {
          setIsLoginModalOpen(false);
          setPendingAction(null);
          setLoginError(null);
        }}
      >
        <div className="flex flex-col gap-4">
          {loginError ? <Alert message={loginError} showIcon type="error" /> : null}
          <Form<UpstreamLoginFormValues>
            form={loginForm}
            layout="vertical"
            onFinish={(values) => {
              void handleLogin(values);
            }}
          >
            <Form.Item
              label="上游账号"
              name="userId"
              rules={[{ required: true, message: '请输入上游账号' }]}
            >
              <Input autoComplete="username" placeholder="请输入上游账号" />
            </Form.Item>
            <Form.Item
              label="上游密码"
              name="password"
              rules={[{ required: true, message: '请输入上游密码' }]}
            >
              <Input.Password autoComplete="current-password" placeholder="请输入上游密码" />
            </Form.Item>

            <div className="flex justify-end gap-3">
              <Button
                onClick={() => {
                  setIsLoginModalOpen(false);
                }}
              >
                取消
              </Button>
              <Button htmlType="submit" loading={isSubmittingLogin} type="primary">
                登录并继续
              </Button>
            </div>
          </Form>
        </div>
      </Modal>
    </div>
  );
}
