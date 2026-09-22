import { type ReactNode, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { CalendarOutlined } from '@ant-design/icons';
import {
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { AcademicSemesterFormItem, AcademicSemesterSelect } from '@/entities/academic-semester';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';
import { ResponsiveGrid, useWidthBand } from '@/shared/ui/responsive-layout';

import {
  buildAcademicCalendarEventQueryInput,
  buildDefaultEventFormValues,
  buildDefaultSemesterFormValues,
  buildEventMutationRefreshPlan,
  changeCalendarEventType,
  createEmptyEventFilters,
  formatDateTime,
  normalizeCalendarEventFormValues,
  normalizeSemesterFormValues,
  pickNextSemesterId,
  requiresCalendarSourceDate,
  sortCalendarEvents,
  sortSemesters,
} from '../application/academic-calendar-management';
import {
  calendarEventQueryReducer,
  initialCalendarEventQueryState,
} from '../application/calendar-event-query-state';
import {
  ACADEMIC_CALENDAR_EVENT_DAY_PERIODS,
  ACADEMIC_CALENDAR_EVENT_RECORD_STATUSES,
  ACADEMIC_CALENDAR_EVENT_TYPES,
  ACADEMIC_CALENDAR_TEACHING_CALC_EFFECTS,
  ACADEMIC_MILITARY_TRAINING_TARGETS,
  type AcademicCalendarEventDayPeriod,
  type AcademicCalendarEventRecord,
  type AcademicCalendarEventRecordStatus,
  type AcademicCalendarEventType,
  type AcademicCalendarTeachingCalcEffect,
  type AcademicMilitaryTrainingTarget,
  type AcademicSemesterRecord,
  type CalendarEventFormValues,
  type CreateAcademicCalendarEventInput,
  type CreateAcademicSemesterInput,
  type EventFilters,
  type ListAcademicCalendarEventsInput,
  type ListAcademicSemestersInput,
  type SemesterFormValues,
  type UpdateAcademicCalendarEventInput,
  type UpdateAcademicSemesterInput,
} from '../application/types';

const DAY_PERIOD_LABELS: Record<AcademicCalendarEventDayPeriod, string> = {
  AFTERNOON: '下午',
  ALL_DAY: '全天',
  MORNING: '上午',
};

const EVENT_TYPE_LABELS: Record<AcademicCalendarEventType, string> = {
  ACTIVITY: '活动',
  EXAM: '考试',
  HOLIDAY: '放假',
  HOLIDAY_MAKEUP: '调休补班',
  MILITARY_TRAINING: '军训',
  REPEATED_TEACHING_DAY: '重复教学日',
  SPORTS_MEET: '运动会',
  WEEKDAY_SWAP: '工作日对调',
};

const ADMISSION_CATEGORY_LABELS: Record<AcademicMilitaryTrainingTarget, string> = {
  ALL_FRESHMEN: '全部新生',
  HIGH_SCHOOL_ORIGIN: '高中起点',
  JUNIOR_HIGH_ORIGIN: '初中起点',
};

const RECORD_STATUS_LABELS: Record<AcademicCalendarEventRecordStatus, string> = {
  ACTIVE: '生效',
  EXPIRED: '失效',
  TENTATIVE: '暂定',
};

const RECORD_STATUS_BADGE: Record<
  AcademicCalendarEventRecordStatus,
  'default' | 'success' | 'warning'
> = {
  ACTIVE: 'success',
  EXPIRED: 'default',
  TENTATIVE: 'warning',
};

const TEACHING_CALC_EFFECT_LABELS: Record<AcademicCalendarTeachingCalcEffect, string> = {
  CANCEL: '停课',
  MAKEUP: '补课',
  NO_CHANGE: '不影响',
  REPEAT: '重复课表',
  SWAP: '对调',
};

const TEACHING_CALC_EFFECT_TAG_COLORS: Record<AcademicCalendarTeachingCalcEffect, string> = {
  CANCEL: 'red',
  MAKEUP: 'blue',
  NO_CHANGE: 'default',
  REPEAT: 'cyan',
  SWAP: 'orange',
};

const DAY_PERIOD_OPTIONS = ACADEMIC_CALENDAR_EVENT_DAY_PERIODS.map((value) => ({
  label: DAY_PERIOD_LABELS[value],
  value,
}));
const EVENT_TYPE_OPTIONS = ACADEMIC_CALENDAR_EVENT_TYPES.map((value) => ({
  label: EVENT_TYPE_LABELS[value],
  value,
}));
const RECORD_STATUS_OPTIONS = ACADEMIC_CALENDAR_EVENT_RECORD_STATUSES.map((value) => ({
  label: RECORD_STATUS_LABELS[value],
  value,
}));
const TEACHING_CALC_EFFECT_OPTIONS = ACADEMIC_CALENDAR_TEACHING_CALC_EFFECTS.map((value) => ({
  label: TEACHING_CALC_EFFECT_LABELS[value],
  value,
}));
const ADMISSION_CATEGORY_OPTIONS = ACADEMIC_MILITARY_TRAINING_TARGETS.map((value) => ({
  label: ADMISSION_CATEGORY_LABELS[value],
  value,
}));
const TERM_NUMBER_OPTIONS = [
  { label: '第 1 学期', value: 1 },
  { label: '第 2 学期', value: 2 },
];

type AcademicCalendarManagementPageContentProps = {
  createAcademicCalendarEvent: (
    input: CreateAcademicCalendarEventInput,
  ) => Promise<AcademicCalendarEventRecord>;
  createAcademicSemester: (input: CreateAcademicSemesterInput) => Promise<AcademicSemesterRecord>;
  deleteAcademicCalendarEvent: (input: { id: number }) => Promise<{ id: number; success: boolean }>;
  deleteAcademicSemester: (input: { id: number }) => Promise<{ id: number; success: boolean }>;
  listAcademicCalendarEvents: (
    input: ListAcademicCalendarEventsInput,
  ) => Promise<AcademicCalendarEventRecord[]>;
  listAcademicSemesters: (input: ListAcademicSemestersInput) => Promise<AcademicSemesterRecord[]>;
  updateAcademicCalendarEvent: (
    input: UpdateAcademicCalendarEventInput,
  ) => Promise<AcademicCalendarEventRecord>;
  updateAcademicSemester: (input: UpdateAcademicSemesterInput) => Promise<AcademicSemesterRecord>;
};

function CalendarFormGrid({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { band } = useWidthBand(ref, [{ max: 439, value: 'single' }], 'double');
  return (
    <div
      ref={ref}
      className="grid gap-x-4"
      style={{
        gridTemplateColumns: band === 'single' ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
      }}
    >
      {children}
    </div>
  );
}

export function AcademicCalendarManagementPageContent({
  createAcademicCalendarEvent,
  createAcademicSemester,
  deleteAcademicCalendarEvent,
  deleteAcademicSemester,
  listAcademicCalendarEvents,
  listAcademicSemesters,
  updateAcademicCalendarEvent,
  updateAcademicSemester,
}: AcademicCalendarManagementPageContentProps) {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [semesterForm] = Form.useForm<SemesterFormValues>();
  const [eventForm] = Form.useForm<CalendarEventFormValues>();
  const selectedEventType = Form.useWatch('eventType', eventForm);
  const selectedTeachingCalcEffect = Form.useWatch('teachingCalcEffect', eventForm);
  const formSemesterId = Form.useWatch('semesterId', eventForm);
  const [activeTab, setActiveTab] = useState('events');
  const eventRequestId = useRef(0);
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [semestersLoading, setSemestersLoading] = useState(true);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [eventQuery, dispatchEventQuery] = useReducer(
    calendarEventQueryReducer,
    initialCalendarEventQueryState,
  );
  const events = eventQuery.records;
  const eventsLoading = eventQuery.status === 'loading';
  const eventsError = eventQuery.error;
  const [eventFilters, setEventFilters] = useState<EventFilters>(createEmptyEventFilters);
  const [isSemesterDrawerOpen, setIsSemesterDrawerOpen] = useState(false);
  const [semesterDrawerMode, setSemesterDrawerMode] = useState<'create' | 'edit'>('create');
  const [editingSemester, setEditingSemester] = useState<AcademicSemesterRecord | null>(null);
  const [semesterSubmitting, setSemesterSubmitting] = useState(false);
  const [isEventDrawerOpen, setIsEventDrawerOpen] = useState(false);
  const [eventDrawerMode, setEventDrawerMode] = useState<'create' | 'edit'>('create');
  const [editingEvent, setEditingEvent] = useState<AcademicCalendarEventRecord | null>(null);
  const [eventSubmitting, setEventSubmitting] = useState(false);

  const selectedSemester =
    selectedSemesterId === null
      ? null
      : (semesters.find((record) => record.id === selectedSemesterId) ?? null);
  const formSemester = semesters.find((record) => record.id === formSemesterId);
  const requiresSourceDate = requiresCalendarSourceDate(selectedTeachingCalcEffect);
  const fixedEffect =
    selectedEventType === 'MILITARY_TRAINING' ||
    selectedEventType === 'SPORTS_MEET' ||
    selectedEventType === 'REPEATED_TEACHING_DAY';

  const loadSemesters = useCallback(
    async (options?: { preferredSemesterId?: number | null }) => {
      setSemestersLoading(true);
      setSemesterError(null);

      try {
        const result = sortSemesters(await listAcademicSemesters({ limit: 500 }));

        setSemesters(result);
        setSelectedSemesterId((currentSelection) =>
          pickNextSemesterId(result, currentSelection, options?.preferredSemesterId),
        );
      } catch (error) {
        setSemesterError(error instanceof Error ? error.message : '暂时无法加载学期列表。');
      } finally {
        setSemestersLoading(false);
      }
    },
    [listAcademicSemesters],
  );

  const loadEvents = useCallback(
    async (semesterId: number, filters: EventFilters) => {
      const requestId = ++eventRequestId.current;
      dispatchEventQuery({ type: 'start', requestId });

      try {
        const result = sortCalendarEvents(
          await listAcademicCalendarEvents(
            buildAcademicCalendarEventQueryInput(semesterId, filters),
          ),
        );

        dispatchEventQuery({ type: 'success', requestId, records: result });
      } catch (error) {
        dispatchEventQuery({
          type: 'failure',
          requestId,
          error: error instanceof Error ? error.message : '暂时无法加载校历事件列表。',
        });
      }
    },
    [listAcademicCalendarEvents],
  );

  useEffect(() => {
    void loadSemesters();
  }, [loadSemesters]);

  useEffect(() => {
    if (selectedSemesterId === null) {
      dispatchEventQuery({ type: 'clear', requestId: ++eventRequestId.current });
      return;
    }

    void loadEvents(selectedSemesterId, eventFilters);
  }, [eventFilters, loadEvents, selectedSemesterId]);

  function openCreateSemesterDrawer() {
    setSemesterDrawerMode('create');
    setEditingSemester(null);
    semesterForm.setFieldsValue(buildDefaultSemesterFormValues());
    setIsSemesterDrawerOpen(true);
  }

  function openEditSemesterDrawer(record: AcademicSemesterRecord) {
    setSemesterDrawerMode('edit');
    setEditingSemester(record);
    semesterForm.setFieldsValue({
      endDate: record.endDate,
      examStartDate: record.examStartDate,
      firstTeachingDate: record.firstTeachingDate,
      isCurrent: record.isCurrent,
      isVisible: record.isVisible,
      name: record.name,
      schoolYear: record.schoolYear,
      sortOrder: record.sortOrder,
      startDate: record.startDate,
      termNumber: record.termNumber,
    });
    setIsSemesterDrawerOpen(true);
  }

  function closeSemesterDrawer() {
    setIsSemesterDrawerOpen(false);
    setEditingSemester(null);
    semesterForm.resetFields();
  }

  function openCreateEventDrawer() {
    setEventDrawerMode('create');
    setEditingEvent(null);
    eventForm.setFieldsValue(buildDefaultEventFormValues(selectedSemesterId));
    setIsEventDrawerOpen(true);
  }

  function openEditEventDrawer(record: AcademicCalendarEventRecord) {
    setEventDrawerMode('edit');
    setEditingEvent(record);
    eventForm.setFieldsValue({
      dayPeriod: record.dayPeriod,
      eventDate: record.eventDate,
      eventType: record.eventType,
      originalDate: record.originalDate || undefined,
      recordStatus: record.recordStatus,
      ruleNote: record.ruleNote || undefined,
      semesterId: record.semesterId,
      targetAdmissionCategory: record.targetAdmissionCategory,
      teachingCalcEffect: record.teachingCalcEffect,
      topic: record.topic,
      version: record.version,
    });
    setIsEventDrawerOpen(true);
  }

  function closeEventDrawer() {
    setIsEventDrawerOpen(false);
    setEditingEvent(null);
    eventForm.resetFields();
  }

  const semesterColumns: ColumnsType<AcademicSemesterRecord> = [
    {
      dataIndex: 'name',
      key: 'name',
      title: '学期名称',
      width: 240,
      render: (_, record) => (
        <div className="max-w-full">
          <Space size={8}>
            <Typography.Text ellipsis={{ tooltip: record.name }}>{record.name}</Typography.Text>
            {record.isCurrent ? (
              <Tag color="green" variant="filled">
                当前学期
              </Tag>
            ) : null}
            {record.isVisible ? null : (
              <Tag color="default" variant="filled">
                隐藏
              </Tag>
            )}
          </Space>
        </div>
      ),
    },
    {
      align: 'right',
      dataIndex: 'schoolYear',
      key: 'schoolYear',
      title: '学年',
      width: 100,
    },
    {
      align: 'right',
      dataIndex: 'termNumber',
      key: 'termNumber',
      render: (value: number) => `第 ${value} 学期`,
      title: '学期号',
      width: 100,
    },
    {
      align: 'right',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      title: '展示排序',
      width: 100,
    },
    {
      dataIndex: 'startDate',
      key: 'startDate',
      title: '开始日期',
      width: 120,
    },
    {
      dataIndex: 'endDate',
      key: 'endDate',
      title: '结束日期',
      width: 120,
    },
    {
      dataIndex: 'firstTeachingDate',
      key: 'firstTeachingDate',
      title: '教学开始',
      width: 120,
    },
    {
      dataIndex: 'examStartDate',
      key: 'examStartDate',
      title: '考试周开始',
      width: 120,
    },
    {
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (value: string) => formatDateTime(value),
      title: '更新时间',
      width: 180,
    },
    {
      fixed: 'right',
      key: 'actions',
      render: (_, record) => (
        <Space size={8}>
          <Button
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              openEditSemesterDrawer(record);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            cancelText="取消"
            description={`确认删除 ${record.name} 吗？`}
            okButtonProps={{ danger: true }}
            okText="删除"
            title="删除学期"
            onCancel={(event) => event?.stopPropagation()}
            onConfirm={async (event) => {
              event?.stopPropagation();

              try {
                await deleteAcademicSemester({ id: record.id });
                messageApi.success('学期已删除。');
                await loadSemesters();
              } catch (error) {
                messageApi.error(error instanceof Error ? error.message : '暂时无法删除学期。');
              }
            }}
          >
            <Button danger size="small" onClick={(event) => event.stopPropagation()}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
      title: '操作',
      width: 140,
    },
  ];

  const eventColumns: ColumnsType<AcademicCalendarEventRecord> = [
    {
      dataIndex: 'topic',
      key: 'topic',
      render: (value: string, record) => (
        <div className="flex flex-col">
          <div className="max-w-full">
            <Typography.Text ellipsis={{ tooltip: value }}>{value}</Typography.Text>
          </div>
          <div className="mt-0.5 text-xs">
            <Typography.Text type="secondary">
              {EVENT_TYPE_LABELS[record.eventType]} · {DAY_PERIOD_LABELS[record.dayPeriod]}
              {record.targetAdmissionCategory
                ? ` · ${ADMISSION_CATEGORY_LABELS[record.targetAdmissionCategory]}`
                : ''}
            </Typography.Text>
          </div>
        </div>
      ),
      title: '事件标题',
      width: 240,
    },
    {
      dataIndex: 'eventDate',
      key: 'eventDate',
      title: '事件日期',
      width: 120,
    },
    {
      dataIndex: 'recordStatus',
      key: 'recordStatus',
      render: (value: AcademicCalendarEventRecordStatus) => (
        <Badge status={RECORD_STATUS_BADGE[value]} text={RECORD_STATUS_LABELS[value]} />
      ),
      title: '状态',
      width: 100,
    },
    {
      dataIndex: 'teachingCalcEffect',
      key: 'teachingCalcEffect',
      render: (value: AcademicCalendarTeachingCalcEffect) => (
        <Tag color={TEACHING_CALC_EFFECT_TAG_COLORS[value]} variant="filled">
          {TEACHING_CALC_EFFECT_LABELS[value]}
        </Tag>
      ),
      title: '教学影响',
      width: 100,
    },
    {
      dataIndex: 'originalDate',
      key: 'originalDate',
      render: (value: string | null) => value || '—',
      title: '课表来源日期',
      width: 120,
    },
    {
      dataIndex: 'ruleNote',
      key: 'ruleNote',
      render: (value: string | null) =>
        value ? (
          <div className="max-w-full text-gray-500">
            <Typography.Text ellipsis={{ tooltip: value }}>{value}</Typography.Text>
          </div>
        ) : (
          '—'
        ),
      title: '规则说明',
      width: 200,
    },
    {
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (value: string) => formatDateTime(value),
      title: '更新时间',
      width: 180,
    },
    {
      fixed: 'right',
      key: 'actions',
      render: (_, record) => (
        <Space size={8}>
          <Button size="small" onClick={() => openEditEventDrawer(record)}>
            编辑
          </Button>
          <Popconfirm
            cancelText="取消"
            description={`确认删除“${record.topic}”吗？`}
            okButtonProps={{ danger: true }}
            okText="删除"
            title="删除校历事件"
            onConfirm={async () => {
              try {
                await deleteAcademicCalendarEvent({ id: record.id });
                messageApi.success('校历事件已删除。');

                if (selectedSemesterId !== null) {
                  await loadEvents(selectedSemesterId, eventFilters);
                }
              } catch (error) {
                messageApi.error(error instanceof Error ? error.message : '暂时无法删除校历事件。');
              }
            }}
          >
            <Button danger size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
      title: '操作',
      width: 140,
    },
  ];

  const semesterPanel = (
    <Card
      extra={
        <Button type="primary" onClick={openCreateSemesterDrawer}>
          新增学期
        </Button>
      }
      title="学期管理"
    >
      {semesterError ? (
        <Alert
          action={
            <Button size="small" type="primary" onClick={() => void loadSemesters()}>
              重试
            </Button>
          }
          showIcon
          style={{ marginBottom: 16 }}
          title={semesterError}
          type="error"
        />
      ) : null}

      <Table<AcademicSemesterRecord>
        columns={semesterColumns}
        dataSource={semesters}
        loading={semestersLoading}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        rowKey="id"
        scroll={{ x: 1120 }}
        size="medium"
      />
    </Card>
  );
  const eventPanel = (
    <Card
      extra={
        <Button
          disabled={selectedSemesterId === null}
          type="primary"
          onClick={openCreateEventDrawer}
        >
          新增事件
        </Button>
      }
      title={
        <div className="flex flex-col">
          <span>校历事件管理</span>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <AcademicSemesterSelect
          aria-label="选择学期"
          placeholder="请选择学期"
          records={semesters}
          loading={semestersLoading}
          showHiddenState
          style={{ width: 320, maxWidth: '100%' }}
          value={selectedSemesterId}
          onChange={(value) => {
            setSelectedSemesterId(value);
            setEventFilters(createEmptyEventFilters());
          }}
        />
        {selectedSemester ? (
          <Typography.Text type="secondary">
            {selectedSemester.startDate} 至 {selectedSemester.endDate}
          </Typography.Text>
        ) : null}
        {semesterError ? <Button onClick={() => void loadSemesters()}>重新加载学期</Button> : null}
      </div>
      {semesterError ? <Alert type="error" showIcon title={semesterError} /> : null}
      <div className="mb-4 flex flex-col gap-4">
        <ResponsiveGrid className="gap-3" columns={{ compact: 1, wide: 4 }}>
          <Input
            placeholder="筛选事件日期"
            type="date"
            value={eventFilters.eventDate || ''}
            onChange={(event) =>
              setEventFilters((current) => ({
                ...current,
                eventDate: event.target.value || undefined,
              }))
            }
          />
          <Select
            allowClear
            options={EVENT_TYPE_OPTIONS}
            placeholder="筛选事件类型"
            value={eventFilters.eventType}
            onChange={(value) =>
              setEventFilters((current) => ({
                ...current,
                eventType: value,
              }))
            }
          />
          <Select
            allowClear
            options={RECORD_STATUS_OPTIONS}
            placeholder="筛选记录状态"
            value={eventFilters.recordStatus}
            onChange={(value) =>
              setEventFilters((current) => ({
                ...current,
                recordStatus: value,
              }))
            }
          />
          <Button onClick={() => setEventFilters(createEmptyEventFilters())}>重置筛选</Button>
        </ResponsiveGrid>
      </div>

      {eventsError ? (
        <Alert
          action={
            <Button
              disabled={selectedSemesterId === null}
              size="small"
              type="primary"
              onClick={() => {
                if (selectedSemesterId !== null) {
                  void loadEvents(selectedSemesterId, eventFilters);
                }
              }}
            >
              重试
            </Button>
          }
          showIcon
          style={{ marginBottom: 16 }}
          title={eventsError}
          type="error"
        />
      ) : null}

      <Table<AcademicCalendarEventRecord>
        columns={eventColumns}
        dataSource={selectedSemesterId === null ? [] : events}
        loading={eventsLoading}
        locale={{
          emptyText:
            selectedSemesterId === null
              ? '请选择学期；如无可选学期，请先到“学期管理”新增'
              : '当前筛选条件下暂无校历事件',
        }}
        pagination={{ pageSize: 12, showSizeChanger: false }}
        rowKey="id"
        scroll={{ x: 1180 }}
        size="medium"
      />
    </Card>
  );
  return (
    <div className="flex flex-col gap-6">
      {messageContextHolder}
      <DecoratedPageHeader
        icon={<CalendarOutlined />}
        title="学期与校历事件管理"
        description="选择学期维护校历事件，或前往学期管理设置学期日期。"
      />
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'events', label: '校历事件', children: eventPanel },
          { key: 'semesters', label: '学期管理', children: semesterPanel },
        ]}
      />
      <Drawer
        destroyOnHidden
        footer={
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={closeSemesterDrawer}>取消</Button>
            <Button
              loading={semesterSubmitting}
              type="primary"
              onClick={() => {
                void semesterForm.submit();
              }}
            >
              {semesterDrawerMode === 'create' ? '创建' : '保存'}
            </Button>
          </Space>
        }
        open={isSemesterDrawerOpen}
        size={600}
        title={semesterDrawerMode === 'create' ? '新增学期' : '编辑学期'}
        onClose={closeSemesterDrawer}
      >
        <Form<SemesterFormValues>
          form={semesterForm}
          layout="vertical"
          requiredMark={false}
          onFinish={async (values) => {
            setSemesterSubmitting(true);

            try {
              const normalizedValues = normalizeSemesterFormValues(values);
              const result =
                semesterDrawerMode === 'create'
                  ? await createAcademicSemester(normalizedValues)
                  : await updateAcademicSemester({
                      id: editingSemester?.id ?? 0,
                      ...normalizedValues,
                    });

              messageApi.success(semesterDrawerMode === 'create' ? '学期已创建。' : '学期已更新。');
              closeSemesterDrawer();
              await loadSemesters({ preferredSemesterId: result.id });
            } catch (error) {
              messageApi.error(error instanceof Error ? error.message : '暂时无法保存学期。');
            } finally {
              setSemesterSubmitting(false);
            }
          }}
        >
          <Form.Item
            label="学期名称"
            name="name"
            rules={[{ message: '请输入学期名称。', required: true }]}
          >
            <Input placeholder="例如：2025-2026 学年第二学期" />
          </Form.Item>
          <CalendarFormGrid>
            <Form.Item
              label="学年"
              name="schoolYear"
              rules={[{ message: '请输入学年。', required: true }]}
            >
              <InputNumber max={2100} min={2000} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="学期号"
              name="termNumber"
              rules={[{ message: '请选择学期号。', required: true }]}
            >
              <Select options={TERM_NUMBER_OPTIONS} />
            </Form.Item>
          </CalendarFormGrid>
          <CalendarFormGrid>
            <Form.Item
              label="开始日期"
              name="startDate"
              rules={[{ message: '请选择开始日期。', required: true }]}
            >
              <Input type="date" />
            </Form.Item>
            <Form.Item
              label="结束日期"
              name="endDate"
              rules={[{ message: '请选择结束日期。', required: true }]}
            >
              <Input type="date" />
            </Form.Item>
          </CalendarFormGrid>
          <CalendarFormGrid>
            <Form.Item
              label="教学开始日期"
              name="firstTeachingDate"
              rules={[{ message: '请选择教学开始日期。', required: true }]}
            >
              <Input type="date" />
            </Form.Item>
            <Form.Item
              label="考试周开始日期"
              name="examStartDate"
              rules={[{ message: '请选择考试周开始日期。', required: true }]}
            >
              <Input type="date" />
            </Form.Item>
          </CalendarFormGrid>
          <Form.Item label="当前学期" name="isCurrent" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <CalendarFormGrid>
            <Form.Item label="普通选择器展示" name="isVisible" valuePropName="checked">
              <Switch checkedChildren="展示" unCheckedChildren="隐藏" />
            </Form.Item>
            <Form.Item
              label="展示排序"
              name="sortOrder"
              rules={[{ message: '请输入展示排序值。', required: true }]}
            >
              <InputNumber precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </CalendarFormGrid>
        </Form>
      </Drawer>

      <Drawer
        destroyOnHidden
        footer={
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button disabled={eventSubmitting} onClick={closeEventDrawer}>
              取消
            </Button>
            <Button
              loading={eventSubmitting}
              type="primary"
              onClick={() => {
                void eventForm.submit();
              }}
            >
              {eventDrawerMode === 'create' ? '创建' : '保存'}
            </Button>
          </Space>
        }
        open={isEventDrawerOpen}
        size={600}
        title={eventDrawerMode === 'create' ? '新增校历事件' : '编辑校历事件'}
        mask={{ closable: false }}
        keyboard={!eventSubmitting}
        onClose={() => {
          if (!eventSubmitting) closeEventDrawer();
        }}
      >
        <Form<CalendarEventFormValues>
          form={eventForm}
          layout="vertical"
          scrollToFirstError
          disabled={eventSubmitting}
          requiredMark={false}
          onValuesChange={(changedValues) => {
            if (changedValues.eventType) {
              eventForm.setFieldsValue(
                changeCalendarEventType(
                  { ...eventForm.getFieldsValue(true), eventType: selectedEventType },
                  changedValues.eventType,
                ),
              );
            } else if (
              changedValues.teachingCalcEffect &&
              !requiresCalendarSourceDate(changedValues.teachingCalcEffect)
            ) {
              eventForm.setFieldValue('originalDate', null);
            }
          }}
          onFinish={async (values) => {
            setEventSubmitting(true);

            try {
              const normalizedValues = normalizeCalendarEventFormValues(values, formSemester);
              const result =
                eventDrawerMode === 'create'
                  ? await createAcademicCalendarEvent(normalizedValues)
                  : await updateAcademicCalendarEvent({
                      id: editingEvent?.id ?? 0,
                      ...normalizedValues,
                    });
              const refreshPlan = buildEventMutationRefreshPlan(
                selectedSemesterId,
                result.semesterId,
              );

              messageApi.success(
                eventDrawerMode === 'create' ? '校历事件已创建。' : '校历事件已更新。',
              );
              closeEventDrawer();

              if (refreshPlan.nextSelectedSemesterId !== selectedSemesterId) {
                setSelectedSemesterId(refreshPlan.nextSelectedSemesterId);
              } else if (refreshPlan.reloadSemesterId !== null) {
                await loadEvents(refreshPlan.reloadSemesterId, eventFilters);
              }
            } catch (error) {
              messageApi.error(error instanceof Error ? error.message : '暂时无法保存校历事件。');
            } finally {
              setEventSubmitting(false);
            }
          }}
        >
          <AcademicSemesterFormItem
            label="归属学期"
            name="semesterId"
            placeholder="请选择归属学期"
            records={semesters}
            required
            selectProps={{ showHiddenState: true }}
          />
          <Form.Item
            label="事件类型"
            name="eventType"
            rules={[{ message: '请选择事件类型。', required: true }]}
          >
            <Select options={EVENT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            label="事件标题"
            name="topic"
            rules={[{ message: '请输入事件标题。', required: true }]}
          >
            <Input
              maxLength={100}
              placeholder={
                selectedEventType === 'MILITARY_TRAINING' ? '例如：新生军训' : '例如：国庆节放假'
              }
            />
          </Form.Item>
          <CalendarFormGrid>
            <Form.Item
              label="事件日期"
              name="eventDate"
              rules={[{ message: '请选择事件日期。', required: true }]}
            >
              <Input type="date" min={formSemester?.startDate} max={formSemester?.endDate} />
            </Form.Item>
            <Form.Item
              label="时间段"
              name="dayPeriod"
              rules={[{ message: '请选择时间段。', required: true }]}
            >
              <Select disabled={selectedEventType === 'SPORTS_MEET'} options={DAY_PERIOD_OPTIONS} />
            </Form.Item>
          </CalendarFormGrid>
          {selectedEventType === 'MILITARY_TRAINING' ? (
            <Form.Item
              label="作用范围"
              name="targetAdmissionCategory"
              rules={[{ message: '请选择作用范围。', required: true }]}
            >
              <Select placeholder="请选择作用范围" options={ADMISSION_CATEGORY_OPTIONS} />
            </Form.Item>
          ) : null}
          <CalendarFormGrid>
            <Form.Item
              label="记录状态"
              name="recordStatus"
              rules={[{ message: '请选择记录状态。', required: true }]}
            >
              <Select options={RECORD_STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item
              label="教学影响"
              name="teachingCalcEffect"
              hidden={fixedEffect}
              rules={[{ message: '请选择教学影响。', required: true }]}
            >
              <Select
                disabled={
                  selectedEventType === 'MILITARY_TRAINING' ||
                  selectedEventType === 'REPEATED_TEACHING_DAY'
                }
                options={
                  selectedEventType === 'MILITARY_TRAINING'
                    ? TEACHING_CALC_EFFECT_OPTIONS.filter((option) => option.value === 'CANCEL')
                    : selectedEventType === 'REPEATED_TEACHING_DAY'
                      ? TEACHING_CALC_EFFECT_OPTIONS.filter((option) => option.value === 'REPEAT')
                      : TEACHING_CALC_EFFECT_OPTIONS.filter((option) => option.value !== 'REPEAT')
                }
              />
            </Form.Item>
          </CalendarFormGrid>
          {fixedEffect ? (
            <div className="mb-4">
              <Alert
                showIcon
                type="info"
                title={
                  selectedEventType === 'MILITARY_TRAINING'
                    ? '所选范围的新生在该时段停课，其他年级不受影响。'
                    : selectedEventType === 'SPORTS_MEET'
                      ? '运动会当天全天停课。'
                      : '在事件日期重复来源日期的课表，来源日期照常上课。'
                }
              />
            </div>
          ) : null}
          <Form.Item
            label="课表来源日期"
            name="originalDate"
            hidden={!requiresSourceDate}
            rules={[{ message: '请选择课表来源日期。', required: requiresSourceDate }]}
          >
            <Input type="date" min={formSemester?.startDate} max={formSemester?.endDate} />
          </Form.Item>
          <Collapse
            ghost
            items={[
              {
                key: 'more',
                label: '更多设置',
                forceRender: true,
                children: (
                  <>
                    <Form.Item
                      label="版本号"
                      name="version"
                      rules={[{ message: '请输入版本号。', required: true }]}
                    >
                      <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item label="规则说明" name="ruleNote">
                      <Input.TextArea maxLength={255} placeholder="可选，填写规则说明" rows={3} />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Drawer>
    </div>
  );
}
