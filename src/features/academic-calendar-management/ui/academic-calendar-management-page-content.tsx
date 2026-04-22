import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
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
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  buildAcademicCalendarEventQueryInput,
  buildDefaultEventFormValues,
  buildDefaultSemesterFormValues,
  buildEventMutationRefreshPlan,
  createEmptyEventFilters,
  formatDateTime,
  getSemesterDisplayName,
  normalizeCalendarEventFormValues,
  normalizeSemesterFormValues,
  pickNextSemesterId,
  sortCalendarEvents,
  sortSemesters,
} from '../application/academic-calendar-management';
import {
  ACADEMIC_CALENDAR_EVENT_DAY_PERIODS,
  ACADEMIC_CALENDAR_EVENT_RECORD_STATUSES,
  ACADEMIC_CALENDAR_EVENT_TYPES,
  ACADEMIC_CALENDAR_TEACHING_CALC_EFFECTS,
  type AcademicCalendarEventDayPeriod,
  type AcademicCalendarEventRecord,
  type AcademicCalendarEventRecordStatus,
  type AcademicCalendarEventType,
  type AcademicCalendarTeachingCalcEffect,
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
  SPORTS_MEET: '运动会',
  WEEKDAY_SWAP: '工作日对调',
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
  SWAP: '对调',
};

const TEACHING_CALC_EFFECT_TAG_COLORS: Record<AcademicCalendarTeachingCalcEffect, string> = {
  CANCEL: 'red',
  MAKEUP: 'blue',
  NO_CHANGE: 'default',
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
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [semestersLoading, setSemestersLoading] = useState(true);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [events, setEvents] = useState<AcademicCalendarEventRecord[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventFilters, setEventFilters] = useState<EventFilters>(createEmptyEventFilters);
  const [isSemesterDrawerOpen, setIsSemesterDrawerOpen] = useState(false);
  const [semesterDrawerMode, setSemesterDrawerMode] = useState<'create' | 'edit'>('create');
  const [editingSemester, setEditingSemester] = useState<AcademicSemesterRecord | null>(null);
  const [semesterSubmitting, setSemesterSubmitting] = useState(false);
  const [isEventDrawerOpen, setIsEventDrawerOpen] = useState(false);
  const [eventDrawerMode, setEventDrawerMode] = useState<'create' | 'edit'>('create');
  const [editingEvent, setEditingEvent] = useState<AcademicCalendarEventRecord | null>(null);
  const [eventSubmitting, setEventSubmitting] = useState(false);

  const semesterOptions = semesters.map((record) => ({
    label: getSemesterDisplayName(record),
    value: record.id,
  }));

  const selectedSemester =
    selectedSemesterId === null
      ? null
      : (semesters.find((record) => record.id === selectedSemesterId) ?? null);

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
      setEventsLoading(true);
      setEventsError(null);

      try {
        const result = sortCalendarEvents(
          await listAcademicCalendarEvents(
            buildAcademicCalendarEventQueryInput(semesterId, filters),
          ),
        );

        setEvents(result);
      } catch (error) {
        setEventsError(error instanceof Error ? error.message : '暂时无法加载校历事件列表。');
      } finally {
        setEventsLoading(false);
      }
    },
    [listAcademicCalendarEvents],
  );

  useEffect(() => {
    void loadSemesters();
  }, [loadSemesters]);

  useEffect(() => {
    if (selectedSemesterId === null) {
      setEvents([]);
      setEventsError(null);
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
      name: record.name,
      schoolYear: record.schoolYear,
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
      title: '原始日期',
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

  return (
    <div className="flex flex-col gap-6">
      {messageContextHolder}

      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              学期与校历事件管理
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              本页用于维护学期与校历事件。上方管理学期，下方按当前选中学期维护对应校历事件。
            </Typography.Paragraph>
          </div>

          <Alert
            description="先在上方选择学期，再在下方查看、筛选与编辑该学期下的校历事件。"
            showIcon
            title="使用说明"
            type="info"
          />
        </div>
      </Card>

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
          rowSelection={{
            onChange: (selectedRowKeys) => setSelectedSemesterId(selectedRowKeys[0] as number),
            selectedRowKeys: selectedSemesterId !== null ? [selectedSemesterId] : [],
            type: 'radio',
          }}
          scroll={{ x: 1120 }}
          size="middle"
          onRow={(record) => ({
            className: 'cursor-pointer',
            onClick: () => setSelectedSemesterId(record.id),
          })}
        />
      </Card>

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
            {selectedSemester ? (
              <div className="mt-1 text-sm font-normal">
                <Typography.Text type="secondary">
                  当前选中学期：{getSemesterDisplayName(selectedSemester)}
                </Typography.Text>
              </div>
            ) : null}
          </div>
        }
      >
        <div className="mb-4 flex flex-col gap-4">
          <div className="grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
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
          </div>
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
                ? '请在上方选择学期以查看校历事件'
                : '当前筛选条件下暂无校历事件',
          }}
          pagination={{ pageSize: 12, showSizeChanger: false }}
          rowKey="id"
          scroll={{ x: 1180 }}
          size="middle"
        />
      </Card>

      <Drawer
        destroyOnClose
        extra={
          <Space>
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
        size={480}
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
          <div className="grid gap-4 md:grid-cols-2">
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
          </div>
          <div className="grid gap-4 md:grid-cols-2">
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
          </div>
          <div className="grid gap-4 md:grid-cols-2">
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
          </div>
          <Form.Item label="当前学期" name="isCurrent" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        destroyOnClose
        extra={
          <Space>
            <Button onClick={closeEventDrawer}>取消</Button>
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
        size={480}
        title={eventDrawerMode === 'create' ? '新增校历事件' : '编辑校历事件'}
        onClose={closeEventDrawer}
      >
        <Form<CalendarEventFormValues>
          form={eventForm}
          layout="vertical"
          requiredMark={false}
          onFinish={async (values) => {
            setEventSubmitting(true);

            try {
              const normalizedValues = normalizeCalendarEventFormValues(values);
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
          <Form.Item
            label="归属学期"
            name="semesterId"
            rules={[{ message: '请选择归属学期。', required: true }]}
          >
            <Select showSearch optionFilterProp="label" options={semesterOptions} />
          </Form.Item>
          <Form.Item
            label="事件标题"
            name="topic"
            rules={[{ message: '请输入事件标题。', required: true }]}
          >
            <Input placeholder="请输入事件标题" />
          </Form.Item>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item
              label="事件日期"
              name="eventDate"
              rules={[{ message: '请选择事件日期。', required: true }]}
            >
              <Input type="date" />
            </Form.Item>
            <Form.Item label="原始日期" name="originalDate">
              <Input type="date" />
            </Form.Item>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item
              label="时间段"
              name="dayPeriod"
              rules={[{ message: '请选择时间段。', required: true }]}
            >
              <Select options={DAY_PERIOD_OPTIONS} />
            </Form.Item>
            <Form.Item
              label="事件类型"
              name="eventType"
              rules={[{ message: '请选择事件类型。', required: true }]}
            >
              <Select options={EVENT_TYPE_OPTIONS} />
            </Form.Item>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
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
              rules={[{ message: '请选择教学影响。', required: true }]}
            >
              <Select options={TEACHING_CALC_EFFECT_OPTIONS} />
            </Form.Item>
          </div>
          <Form.Item
            label="版本号"
            name="version"
            rules={[{ message: '请输入版本号。', required: true }]}
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="规则说明" name="ruleNote">
            <Input.TextArea placeholder="可选，填写规则说明" rows={4} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
