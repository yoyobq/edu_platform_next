import { useEffect, useState } from 'react';
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

import { academicCalendarAdminLabAccess } from './access';
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
  createAcademicCalendarEvent,
  createAcademicSemester,
  deleteAcademicCalendarEvent,
  deleteAcademicSemester,
  listAcademicCalendarEvents,
  listAcademicSemesters,
  updateAcademicCalendarEvent,
  updateAcademicSemester,
} from './api';
import { academicCalendarAdminLabMeta } from './meta';

type SemesterFormValues = {
  endDate: string;
  examStartDate: string;
  firstTeachingDate: string;
  isCurrent: boolean;
  name: string;
  schoolYear: number;
  startDate: string;
  termNumber: number;
};

type CalendarEventFormValues = {
  dayPeriod: AcademicCalendarEventDayPeriod;
  eventDate: string;
  eventType: AcademicCalendarEventType;
  originalDate?: string;
  recordStatus: AcademicCalendarEventRecordStatus;
  ruleNote?: string;
  semesterId: number;
  teachingCalcEffect: AcademicCalendarTeachingCalcEffect;
  topic: string;
  version: number;
};

type EventFilters = {
  eventDate?: string;
  eventType?: AcademicCalendarEventType;
  recordStatus?: AcademicCalendarEventRecordStatus;
};

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
  'success' | 'default' | 'warning'
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

function normalizeRequiredText(value: string, label: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(`请输入${label}。`);
  }

  return normalizedValue;
}

function normalizeOptionalText(value?: string) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function normalizeOptionalDate(value?: string) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function formatDateTime(value: string) {
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

function getSemesterDisplayName(record: AcademicSemesterRecord) {
  return `${record.name} · ${record.schoolYear}-${record.termNumber}`;
}

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

function getDayPeriodOrder(value: AcademicCalendarEventDayPeriod) {
  switch (value) {
    case 'MORNING':
      return 0;
    case 'AFTERNOON':
      return 1;
    case 'ALL_DAY':
      return 2;
    default:
      return 99;
  }
}

function sortCalendarEvents(records: AcademicCalendarEventRecord[]) {
  return [...records].sort((left, right) => {
    if (left.eventDate !== right.eventDate) {
      return left.eventDate.localeCompare(right.eventDate);
    }

    if (left.dayPeriod !== right.dayPeriod) {
      return getDayPeriodOrder(left.dayPeriod) - getDayPeriodOrder(right.dayPeriod);
    }

    return left.id - right.id;
  });
}

function pickNextSemesterId(
  records: AcademicSemesterRecord[],
  currentSelection: number | null,
  preferredSelection?: number | null,
) {
  if (preferredSelection && records.some((record) => record.id === preferredSelection)) {
    return preferredSelection;
  }

  if (currentSelection && records.some((record) => record.id === currentSelection)) {
    return currentSelection;
  }

  return records[0]?.id ?? null;
}

export function AcademicCalendarAdminLabPage() {
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
  const [eventFilters, setEventFilters] = useState<EventFilters>({});
  const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false);
  const [semesterModalMode, setSemesterModalMode] = useState<'create' | 'edit'>('create');
  const [editingSemester, setEditingSemester] = useState<AcademicSemesterRecord | null>(null);
  const [semesterSubmitting, setSemesterSubmitting] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventModalMode, setEventModalMode] = useState<'create' | 'edit'>('create');
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

  async function loadSemesters(options?: { preferredSemesterId?: number | null }) {
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
  }

  async function loadEvents(semesterId: number, filters: EventFilters) {
    setEventsLoading(true);
    setEventsError(null);

    try {
      const result = sortCalendarEvents(
        await listAcademicCalendarEvents({
          eventDate: normalizeOptionalDate(filters.eventDate),
          eventType: filters.eventType,
          limit: 500,
          recordStatus: filters.recordStatus,
          semesterId,
        }),
      );

      setEvents(result);
    } catch (error) {
      setEventsError(error instanceof Error ? error.message : '暂时无法加载校历事件列表。');
    } finally {
      setEventsLoading(false);
    }
  }

  useEffect(() => {
    void loadSemesters();
  }, []);

  useEffect(() => {
    if (selectedSemesterId === null) {
      setEvents([]);
      setEventsError(null);
      return;
    }

    void loadEvents(selectedSemesterId, eventFilters);
  }, [selectedSemesterId, eventFilters]);

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
              <Tag color="green" bordered={false}>
                当前学期
              </Tag>
            ) : null}
          </Space>
        </div>
      ),
    },
    {
      dataIndex: 'schoolYear',
      key: 'schoolYear',
      title: '学年',
      width: 100,
      align: 'right',
    },
    {
      dataIndex: 'termNumber',
      key: 'termNumber',
      title: '学期号',
      width: 100,
      align: 'right',
      render: (value: number) => `第 ${value} 学期`,
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
      title: '更新时间',
      width: 180,
      render: (value: string) => formatDateTime(value),
    },
    {
      key: 'actions',
      title: '操作',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space size={8}>
          <Button
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setSemesterModalMode('edit');
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
              setIsSemesterModalOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="删除学期"
            description={`确认删除 ${record.name} 吗？`}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={async (e) => {
              e?.stopPropagation();
              try {
                await deleteAcademicSemester({ id: record.id });
                messageApi.success('学期已删除。');
                await loadSemesters();
              } catch (error) {
                messageApi.error(error instanceof Error ? error.message : '暂时无法删除学期。');
              }
            }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <Button size="small" danger onClick={(e) => e.stopPropagation()}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const eventColumns: ColumnsType<AcademicCalendarEventRecord> = [
    {
      dataIndex: 'topic',
      key: 'topic',
      title: '事件标题',
      width: 240,
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
      title: '状态',
      width: 100,
      render: (value: AcademicCalendarEventRecordStatus) => (
        <Badge status={RECORD_STATUS_BADGE[value]} text={RECORD_STATUS_LABELS[value]} />
      ),
    },
    {
      dataIndex: 'teachingCalcEffect',
      key: 'teachingCalcEffect',
      title: '教学影响',
      width: 100,
      render: (value: AcademicCalendarTeachingCalcEffect) => (
        <Tag color={TEACHING_CALC_EFFECT_TAG_COLORS[value]} bordered={false}>
          {TEACHING_CALC_EFFECT_LABELS[value]}
        </Tag>
      ),
    },
    {
      dataIndex: 'originalDate',
      key: 'originalDate',
      title: '原始日期',
      width: 120,
      render: (value: string | null) => value || '—',
    },
    {
      dataIndex: 'ruleNote',
      key: 'ruleNote',
      title: '规则说明',
      width: 200,
      render: (value: string | null) =>
        value ? (
          <div className="max-w-full text-gray-500">
            <Typography.Text ellipsis={{ tooltip: value }}>{value}</Typography.Text>
          </div>
        ) : (
          '—'
        ),
    },
    {
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      title: '更新时间',
      width: 180,
      render: (value: string) => formatDateTime(value),
    },
    {
      key: 'actions',
      title: '操作',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space size={8}>
          <Button
            size="small"
            onClick={() => {
              setEventModalMode('edit');
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
              setIsEventModalOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="删除校历事件"
            description={`确认删除“${record.topic}”吗？`}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
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
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
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
              {academicCalendarAdminLabMeta.purpose}
            </Typography.Paragraph>
          </div>

          <div className="flex flex-wrap gap-2">
            <Tag color="blue">负责人：{academicCalendarAdminLabMeta.owner}</Tag>
            <Tag color="purple">复核时间：{academicCalendarAdminLabMeta.reviewAt}</Tag>
            <Tag color="green">环境：{academicCalendarAdminLabAccess.env.join(', ')}</Tag>
            <Tag color="gold">访问级别：admin / staff + ACADEMIC_OFFICER</Tag>
          </div>

          <Alert
            type="info"
            showIcon
            title="使用说明"
            description="本页按 semester 组织 calendar event。上方列表为学期管理，点击选中某一学期后，即可在下方列表中管理该学期下的校历事件。"
          />
        </div>
      </Card>

      <Card
        title="学期管理"
        extra={
          <Button
            type="primary"
            onClick={() => {
              setSemesterModalMode('create');
              setEditingSemester(null);
              semesterForm.setFieldsValue({
                endDate: '',
                examStartDate: '',
                firstTeachingDate: '',
                isCurrent: false,
                name: '',
                schoolYear: new Date().getFullYear(),
                startDate: '',
                termNumber: 1,
              });
              setIsSemesterModalOpen(true);
            }}
          >
            新增学期
          </Button>
        }
      >
        {semesterError ? (
          <Alert
            style={{ marginBottom: 16 }}
            type="error"
            showIcon
            title={semesterError}
            action={
              <Button size="small" type="primary" onClick={() => void loadSemesters()}>
                重试
              </Button>
            }
          />
        ) : null}

        <Table<AcademicSemesterRecord>
          rowKey="id"
          size="middle"
          columns={semesterColumns}
          dataSource={semesters}
          loading={semestersLoading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 1120 }}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: selectedSemesterId !== null ? [selectedSemesterId] : [],
            onChange: (selectedRowKeys) => setSelectedSemesterId(selectedRowKeys[0] as number),
          }}
          onRow={(record) => ({
            onClick: () => setSelectedSemesterId(record.id),
            className: 'cursor-pointer',
          })}
        />
      </Card>

      <Card
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
        extra={
          <Button
            type="primary"
            disabled={selectedSemesterId === null}
            onClick={() => {
              setEventModalMode('create');
              setEditingEvent(null);
              eventForm.setFieldsValue({
                dayPeriod: 'ALL_DAY',
                eventDate: '',
                eventType: 'ACTIVITY',
                originalDate: undefined,
                recordStatus: 'ACTIVE',
                ruleNote: undefined,
                semesterId: selectedSemesterId ?? undefined,
                teachingCalcEffect: 'NO_CHANGE',
                topic: '',
                version: 1,
              });
              setIsEventModalOpen(true);
            }}
          >
            新增事件
          </Button>
        }
      >
        <div className="mb-4 flex flex-col gap-4">
          <div className="grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
            <Input
              type="date"
              placeholder="筛选事件日期"
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
              placeholder="筛选事件类型"
              options={EVENT_TYPE_OPTIONS}
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
              placeholder="筛选记录状态"
              options={RECORD_STATUS_OPTIONS}
              value={eventFilters.recordStatus}
              onChange={(value) =>
                setEventFilters((current) => ({
                  ...current,
                  recordStatus: value,
                }))
              }
            />
            <Button
              onClick={() =>
                setEventFilters({
                  eventDate: undefined,
                  eventType: undefined,
                  recordStatus: undefined,
                })
              }
            >
              重置筛选
            </Button>
          </div>
        </div>

        {eventsError ? (
          <Alert
            style={{ marginBottom: 16 }}
            type="error"
            showIcon
            title={eventsError}
            action={
              <Button
                size="small"
                type="primary"
                disabled={selectedSemesterId === null}
                onClick={() => {
                  if (selectedSemesterId !== null) {
                    void loadEvents(selectedSemesterId, eventFilters);
                  }
                }}
              >
                重试
              </Button>
            }
          />
        ) : null}

        <Table<AcademicCalendarEventRecord>
          rowKey="id"
          size="middle"
          columns={eventColumns}
          dataSource={selectedSemesterId === null ? [] : events}
          loading={eventsLoading}
          pagination={{ pageSize: 12, showSizeChanger: false }}
          scroll={{ x: 1180 }}
          locale={{
            emptyText:
              selectedSemesterId === null
                ? '请在上方选择学期以查看校历事件'
                : '当前筛选条件下暂无校历事件',
          }}
        />
      </Card>

      <Drawer
        destroyOnClose
        open={isSemesterModalOpen}
        title={semesterModalMode === 'create' ? '新增学期' : '编辑学期'}
        width={480}
        onClose={() => {
          setIsSemesterModalOpen(false);
          setEditingSemester(null);
          semesterForm.resetFields();
        }}
        extra={
          <Space>
            <Button
              onClick={() => {
                setIsSemesterModalOpen(false);
                setEditingSemester(null);
                semesterForm.resetFields();
              }}
            >
              取消
            </Button>
            <Button
              type="primary"
              loading={semesterSubmitting}
              onClick={() => {
                void semesterForm.submit();
              }}
            >
              {semesterModalMode === 'create' ? '创建' : '保存'}
            </Button>
          </Space>
        }
      >
        <Form<SemesterFormValues>
          form={semesterForm}
          layout="vertical"
          requiredMark={false}
          onFinish={async (values) => {
            setSemesterSubmitting(true);

            try {
              const normalizedValues = {
                endDate: values.endDate,
                examStartDate: values.examStartDate,
                firstTeachingDate: values.firstTeachingDate,
                isCurrent: values.isCurrent,
                name: normalizeRequiredText(values.name, '学期名称'),
                schoolYear: values.schoolYear,
                startDate: values.startDate,
                termNumber: values.termNumber,
              };

              const result =
                semesterModalMode === 'create'
                  ? await createAcademicSemester(normalizedValues)
                  : await updateAcademicSemester({
                      id: editingSemester?.id ?? 0,
                      ...normalizedValues,
                    });

              messageApi.success(semesterModalMode === 'create' ? '学期已创建。' : '学期已更新。');
              setIsSemesterModalOpen(false);
              setEditingSemester(null);
              semesterForm.resetFields();
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
            rules={[{ required: true, message: '请输入学期名称。' }]}
          >
            <Input placeholder="例如：2025-2026 学年第二学期" />
          </Form.Item>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item
              label="学年"
              name="schoolYear"
              rules={[{ required: true, message: '请输入学年。' }]}
            >
              <InputNumber min={2000} max={2100} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="学期号"
              name="termNumber"
              rules={[{ required: true, message: '请选择学期号。' }]}
            >
              <Select options={TERM_NUMBER_OPTIONS} />
            </Form.Item>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item
              label="开始日期"
              name="startDate"
              rules={[{ required: true, message: '请选择开始日期。' }]}
            >
              <Input type="date" />
            </Form.Item>
            <Form.Item
              label="结束日期"
              name="endDate"
              rules={[{ required: true, message: '请选择结束日期。' }]}
            >
              <Input type="date" />
            </Form.Item>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item
              label="教学开始日期"
              name="firstTeachingDate"
              rules={[{ required: true, message: '请选择教学开始日期。' }]}
            >
              <Input type="date" />
            </Form.Item>
            <Form.Item
              label="考试周开始日期"
              name="examStartDate"
              rules={[{ required: true, message: '请选择考试周开始日期。' }]}
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
        open={isEventModalOpen}
        title={eventModalMode === 'create' ? '新增校历事件' : '编辑校历事件'}
        width={480}
        onClose={() => {
          setIsEventModalOpen(false);
          setEditingEvent(null);
          eventForm.resetFields();
        }}
        extra={
          <Space>
            <Button
              onClick={() => {
                setIsEventModalOpen(false);
                setEditingEvent(null);
                eventForm.resetFields();
              }}
            >
              取消
            </Button>
            <Button
              type="primary"
              loading={eventSubmitting}
              onClick={() => {
                void eventForm.submit();
              }}
            >
              {eventModalMode === 'create' ? '创建' : '保存'}
            </Button>
          </Space>
        }
      >
        <Form<CalendarEventFormValues>
          form={eventForm}
          layout="vertical"
          requiredMark={false}
          onFinish={async (values) => {
            setEventSubmitting(true);

            try {
              const normalizedValues = {
                dayPeriod: values.dayPeriod,
                eventDate: values.eventDate,
                eventType: values.eventType,
                originalDate: normalizeOptionalDate(values.originalDate),
                recordStatus: values.recordStatus,
                ruleNote: normalizeOptionalText(values.ruleNote),
                semesterId: values.semesterId,
                teachingCalcEffect: values.teachingCalcEffect,
                topic: normalizeRequiredText(values.topic, '事件标题'),
                version: values.version,
              };

              const result =
                eventModalMode === 'create'
                  ? await createAcademicCalendarEvent(normalizedValues)
                  : await updateAcademicCalendarEvent({
                      id: editingEvent?.id ?? 0,
                      ...normalizedValues,
                    });

              messageApi.success(
                eventModalMode === 'create' ? '校历事件已创建。' : '校历事件已更新。',
              );
              setIsEventModalOpen(false);
              setEditingEvent(null);
              eventForm.resetFields();

              if (selectedSemesterId !== result.semesterId) {
                setSelectedSemesterId(result.semesterId);
              } else {
                await loadEvents(result.semesterId, eventFilters);
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
            rules={[{ required: true, message: '请选择归属学期。' }]}
          >
            <Select showSearch optionFilterProp="label" options={semesterOptions} />
          </Form.Item>
          <Form.Item
            label="事件标题"
            name="topic"
            rules={[{ required: true, message: '请输入事件标题。' }]}
          >
            <Input placeholder="请输入事件标题" />
          </Form.Item>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item
              label="事件日期"
              name="eventDate"
              rules={[{ required: true, message: '请选择事件日期。' }]}
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
              rules={[{ required: true, message: '请选择时间段。' }]}
            >
              <Select options={DAY_PERIOD_OPTIONS} />
            </Form.Item>
            <Form.Item
              label="事件类型"
              name="eventType"
              rules={[{ required: true, message: '请选择事件类型。' }]}
            >
              <Select options={EVENT_TYPE_OPTIONS} />
            </Form.Item>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item
              label="记录状态"
              name="recordStatus"
              rules={[{ required: true, message: '请选择记录状态。' }]}
            >
              <Select options={RECORD_STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item
              label="教学影响"
              name="teachingCalcEffect"
              rules={[{ required: true, message: '请选择教学影响。' }]}
            >
              <Select options={TEACHING_CALC_EFFECT_OPTIONS} />
            </Form.Item>
          </div>
          <Form.Item
            label="版本号"
            name="version"
            rules={[{ required: true, message: '请输入版本号。' }]}
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="规则说明" name="ruleNote">
            <Input.TextArea rows={4} placeholder="可选，填写规则说明" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
