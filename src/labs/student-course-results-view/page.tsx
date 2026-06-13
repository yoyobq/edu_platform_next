// src/labs/student-course-results-view/page.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DatabaseOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Select,
  Spin,
  Table,
  Tabs,
  Tag,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  buildDepartmentSelectOptions,
  DepartmentFormItem,
  type DepartmentSelectOption,
} from '@/entities/department';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';
import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

import {
  fetchClassStudentCourseResults,
  listLocalClassOptions,
  listLocalDepartmentOptions,
  type LocalClassOption,
  resolveUpstreamErrorMessage,
  type StudentCourseResultsFailure,
  type StudentCourseResultsResult,
  type StudentCourseResultsSource,
} from './api';
import { studentCourseResultsViewLabMeta } from './meta';

type SearchFormValues = {
  classCode: string;
  departmentId: string;
  schoolYear: string;
  semester: string;
  studentSearch?: string;
};

type QuerySnapshot = {
  classCode: string;
  className: string | null;
  schoolYear: string;
  semester: string;
};

type ResultState = {
  data: StudentCourseResultsResult;
  query: QuerySnapshot;
};

type DisplayRow = {
  attendExamType: string | null;
  courseDivide: string | null;
  courseId: string | null;
  courseName: string | null;
  courseNature: string | null;
  fetchedAt: string | null;
  isPass: number | null;
  periodicFinalTotalScore: string | null;
  schoolYear: string | null;
  semester: string | null;
  source: StudentCourseResultsSource;
  studentName: string | null;
  studentNumber: string;
  teacherName: string | null;
  totalScore: string | null;
};

type TermTab = {
  key: string;
  label: string;
  schoolYear: string | null;
  semester: string | null;
};

const ALL_VALUE = 'ALL';
const COMPACT_VIEWPORT_QUERY = '(max-width: 1120px)';

const SOURCE_LABELS: Record<StudentCourseResultsSource, string> = {
  CACHE: '本地快照',
  STALE_CACHE: '旧快照',
  UPSTREAM: '本次上游',
};

const SOURCE_COLORS: Record<StudentCourseResultsSource, string> = {
  CACHE: 'blue',
  STALE_CACHE: 'orange',
  UPSTREAM: 'green',
};

const SEMESTER_OPTIONS = [
  {
    label: '全部学期',
    value: ALL_VALUE,
  },
  {
    label: '第一学期',
    value: '1',
  },
  {
    label: '第二学期',
    value: '2',
  },
];

function useCompactViewport() {
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(COMPACT_VIEWPORT_QUERY).matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(COMPACT_VIEWPORT_QUERY);
    const handleChange = () => {
      setIsCompactViewport(mediaQuery.matches);
    };

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return isCompactViewport;
}

function getCurrentSchoolYear() {
  const now = new Date();
  const currentYear = now.getFullYear();

  return now.getMonth() >= 7 ? currentYear : currentYear - 1;
}

function buildSchoolYearOptions() {
  const currentSchoolYear = getCurrentSchoolYear();
  const options = [
    {
      label: '全部学年',
      value: ALL_VALUE,
    },
  ];

  for (let year = currentSchoolYear + 1; year >= currentSchoolYear - 10; year -= 1) {
    options.push({
      label: `${year} 学年`,
      value: String(year),
    });
  }

  return options;
}

function buildClassSelectOptions(classes: LocalClassOption[]) {
  return classes
    .filter((item) => item.classCode?.trim())
    .map((item) => ({
      label: `${item.className || item.classCode}（${item.classCode}）`,
      value: item.classCode,
    }));
}

function formatNullableValue(value: boolean | number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-text-secondary">-</span>;
  }

  return String(value);
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
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatSchoolYear(value: string | null) {
  return value?.trim() ? `${value} 学年` : '未返回学年';
}

function formatSemester(value: string | null) {
  if (value === '1') {
    return '第一学期';
  }

  if (value === '2') {
    return '第二学期';
  }

  return value?.trim() ? `第 ${value} 学期` : '未返回学期';
}

function renderSourceTag(source: StudentCourseResultsSource) {
  return <Tag color={SOURCE_COLORS[source]}>{SOURCE_LABELS[source]}</Tag>;
}

function renderPassTag(value: number | null) {
  if (value === 1) {
    return <Tag color="green">通过</Tag>;
  }

  if (value === 0) {
    return <Tag color="red">未通过</Tag>;
  }

  return <Tag>未返回</Tag>;
}

function buildTermKey(schoolYear: string | null, semester: string | null) {
  return `${schoolYear ?? 'NULL'}::${semester ?? 'NULL'}`;
}

function compareTextValue(a: string | null, b: string | null) {
  return (a ?? '').localeCompare(b ?? '', 'zh-CN', {
    numeric: true,
    sensitivity: 'base',
  });
}

function compareRows(a: DisplayRow, b: DisplayRow) {
  return (
    compareTextValue(a.studentNumber, b.studentNumber) ||
    compareTextValue(b.schoolYear, a.schoolYear) ||
    compareTextValue(a.semester, b.semester) ||
    compareTextValue(a.courseName, b.courseName)
  );
}

function flattenRows(result: StudentCourseResultsResult | null): DisplayRow[] {
  if (!result) {
    return [];
  }

  return result.items
    .flatMap((student) =>
      student.results.map((record) => ({
        ...record,
        fetchedAt: student.fetchedAt,
        source: student.source,
        studentName: student.studentName,
        studentNumber: student.studentNumber,
      })),
    )
    .sort(compareRows);
}

function buildTermTabs(rows: readonly DisplayRow[]): TermTab[] {
  const tabByKey = new Map<string, TermTab>();

  for (const row of rows) {
    const key = buildTermKey(row.schoolYear, row.semester);

    if (tabByKey.has(key)) {
      continue;
    }

    tabByKey.set(key, {
      key,
      label: `${formatSchoolYear(row.schoolYear)} · ${formatSemester(row.semester)}`,
      schoolYear: row.schoolYear,
      semester: row.semester,
    });
  }

  return [
    {
      key: ALL_VALUE,
      label: '全部',
      schoolYear: null,
      semester: null,
    },
    ...[...tabByKey.values()].sort(
      (a, b) =>
        compareTextValue(b.schoolYear, a.schoolYear) || compareTextValue(a.semester, b.semester),
    ),
  ];
}

function filterRowsBySearch(rows: readonly DisplayRow[], keyword: string | undefined) {
  const normalizedKeyword = keyword?.trim().toLowerCase();

  if (!normalizedKeyword) {
    return [...rows];
  }

  return rows.filter((row) => {
    const studentNumber = row.studentNumber.toLowerCase();
    const studentName = row.studentName?.toLowerCase() ?? '';

    return studentNumber.includes(normalizedKeyword) || studentName.includes(normalizedKeyword);
  });
}

function filterRowsByTerm(rows: readonly DisplayRow[], activeTermKey: string) {
  if (activeTermKey === ALL_VALUE) {
    return [...rows];
  }

  return rows.filter((row) => buildTermKey(row.schoolYear, row.semester) === activeTermKey);
}

function resolveQuerySchoolYear(value: string) {
  return value === ALL_VALUE ? undefined : value;
}

function resolveQuerySemester(value: string) {
  return value === ALL_VALUE ? undefined : value;
}

const failureColumns: ColumnsType<StudentCourseResultsFailure> = [
  {
    dataIndex: 'studentNumber',
    key: 'studentNumber',
    title: '学号',
    width: 160,
  },
  {
    dataIndex: 'studentName',
    key: 'studentName',
    render: (studentName: string | null) => formatNullableValue(studentName),
    title: '姓名',
    width: 140,
  },
  {
    dataIndex: 'code',
    key: 'code',
    render: (code: string) => <Tag color="red">{code}</Tag>,
    title: '错误码',
    width: 180,
  },
  {
    dataIndex: 'message',
    key: 'message',
    title: '失败原因',
  },
];

export function StudentCourseResultsViewLabPage() {
  const { token } = theme.useToken();
  const [form] = Form.useForm<SearchFormValues>();
  const isCompactViewport = useCompactViewport();
  const [activeTermKey, setActiveTermKey] = useState(ALL_VALUE);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [classOptionsError, setClassOptionsError] = useState<string | null>(null);
  const [departmentOptionsError, setDepartmentOptionsError] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [classes, setClasses] = useState<LocalClassOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentSelectOption[]>([]);
  const [resultState, setResultState] = useState<ResultState | null>(null);
  const selectedDepartmentId = Form.useWatch('departmentId', form);
  const selectedClassCode = Form.useWatch('classCode', form);
  const studentSearch = Form.useWatch('studentSearch', form);
  const classOptions = useMemo(() => buildClassSelectOptions(classes), [classes]);
  const schoolYearOptions = useMemo(() => buildSchoolYearOptions(), []);
  const selectedDepartment = useMemo(
    () => departmentOptions.find((item) => item.value === selectedDepartmentId) ?? null,
    [departmentOptions, selectedDepartmentId],
  );
  const selectedClass = useMemo(
    () => classes.find((item) => item.classCode === selectedClassCode) ?? null,
    [classes, selectedClassCode],
  );
  const allRows = useMemo(() => flattenRows(resultState?.data ?? null), [resultState]);
  const searchedRows = useMemo(
    () => filterRowsBySearch(allRows, studentSearch),
    [allRows, studentSearch],
  );
  const termTabs = useMemo(() => buildTermTabs(searchedRows), [searchedRows]);
  const effectiveActiveTermKey = termTabs.some((item) => item.key === activeTermKey)
    ? activeTermKey
    : ALL_VALUE;
  const visibleRows = useMemo(
    () => filterRowsByTerm(searchedRows, effectiveActiveTermKey),
    [effectiveActiveTermKey, searchedRows],
  );
  const result = resultState?.data ?? null;

  const resultColumns = useMemo<ColumnsType<DisplayRow>>(
    () => [
      {
        dataIndex: 'studentNumber',
        fixed: isCompactViewport ? undefined : 'left',
        key: 'studentNumber',
        title: '学号',
        width: 150,
      },
      {
        dataIndex: 'studentName',
        key: 'studentName',
        render: (studentName: string | null) => formatNullableValue(studentName),
        title: '姓名',
        width: 120,
      },
      {
        dataIndex: 'schoolYear',
        key: 'schoolYear',
        render: (schoolYear: string | null) => formatNullableValue(schoolYear),
        title: '学年',
        width: 100,
      },
      {
        dataIndex: 'semester',
        key: 'semester',
        render: (semester: string | null) => formatNullableValue(semester),
        title: '学期',
        width: 90,
      },
      {
        dataIndex: 'courseName',
        ellipsis: true,
        key: 'courseName',
        render: (courseName: string | null) => formatNullableValue(courseName),
        title: '课程名称',
        width: 240,
      },
      {
        dataIndex: 'teacherName',
        key: 'teacherName',
        render: (teacherName: string | null) => formatNullableValue(teacherName),
        title: '任课教师',
        width: 140,
      },
      {
        dataIndex: 'totalScore',
        key: 'totalScore',
        render: (totalScore: string | null) => formatNullableValue(totalScore),
        title: '总评成绩',
        width: 110,
      },
      {
        dataIndex: 'isPass',
        key: 'isPass',
        render: (isPass: number | null) => renderPassTag(isPass),
        title: '是否通过',
        width: 110,
      },
      {
        dataIndex: 'periodicFinalTotalScore',
        key: 'periodicFinalTotalScore',
        render: (score: string | null) => formatNullableValue(score),
        title: '阶段/期末',
        width: 120,
      },
      {
        dataIndex: 'courseNature',
        key: 'courseNature',
        render: (courseNature: string | null) => formatNullableValue(courseNature),
        title: '课程性质',
        width: 130,
      },
      {
        dataIndex: 'courseDivide',
        key: 'courseDivide',
        render: (courseDivide: string | null) => formatNullableValue(courseDivide),
        title: '课程分类',
        width: 130,
      },
      {
        dataIndex: 'attendExamType',
        key: 'attendExamType',
        render: (attendExamType: string | null) => formatNullableValue(attendExamType),
        title: '考试类型',
        width: 130,
      },
      {
        dataIndex: 'source',
        key: 'source',
        render: (source: StudentCourseResultsSource) => renderSourceTag(source),
        title: '来源',
        width: 120,
      },
      {
        dataIndex: 'fetchedAt',
        key: 'fetchedAt',
        render: (fetchedAt: string | null) => formatDateTime(fetchedAt),
        title: '更新时间',
        width: 170,
      },
    ],
    [isCompactViewport],
  );

  const loadDepartments = useCallback(async () => {
    setIsLoadingDepartments(true);
    setDepartmentOptionsError(null);

    try {
      const departments = await listLocalDepartmentOptions();
      const nextDepartmentOptions = buildDepartmentSelectOptions(departments);
      const currentDepartmentId = form.getFieldValue('departmentId') as string | undefined;
      const nextDepartmentId = nextDepartmentOptions.some(
        (item) => item.value === currentDepartmentId,
      )
        ? currentDepartmentId
        : nextDepartmentOptions[0]?.value;

      setDepartmentOptions(nextDepartmentOptions);
      form.setFieldsValue({
        departmentId: nextDepartmentId,
      });
    } catch (error) {
      setDepartmentOptions([]);
      setClasses([]);
      setDepartmentOptionsError(error instanceof Error ? error.message : '暂时无法加载系部列表。');
    } finally {
      setIsLoadingDepartments(false);
    }
  }, [form]);

  const loadClasses = useCallback(
    async (departmentId: string | undefined) => {
      if (!departmentId) {
        setClasses([]);
        form.setFieldsValue({
          classCode: undefined,
        });
        return;
      }

      setIsLoadingClasses(true);
      setClassOptionsError(null);

      try {
        const nextClasses = await listLocalClassOptions({
          departmentId,
        });

        setClasses(nextClasses);

        const currentClassCode = form.getFieldValue('classCode') as string | undefined;
        const nextClassCode = nextClasses.some((item) => item.classCode === currentClassCode)
          ? currentClassCode
          : nextClasses.find((item) => item.classCode?.trim())?.classCode;

        form.setFieldsValue({
          classCode: nextClassCode,
        });
      } catch (error) {
        setClasses([]);
        setClassOptionsError(error instanceof Error ? error.message : '暂时无法加载本地班级列表。');
      } finally {
        setIsLoadingClasses(false);
      }
    },
    [form],
  );

  const handleReadCache = useCallback(
    async (values: SearchFormValues) => {
      setIsLoadingResults(true);
      setResultError(null);

      try {
        const nextResult = await fetchClassStudentCourseResults({
          classCode: values.classCode,
          refreshMode: 'CACHE_FIRST',
          schoolYear: resolveQuerySchoolYear(values.schoolYear),
          semester: resolveQuerySemester(values.semester),
        });

        setActiveTermKey(ALL_VALUE);
        setResultState({
          data: nextResult,
          query: {
            classCode: values.classCode,
            className: selectedClass?.className ?? nextResult.className,
            schoolYear: values.schoolYear,
            semester: values.semester,
          },
        });
      } catch (error) {
        setResultState(null);
        setResultError(resolveUpstreamErrorMessage(error, '暂时无法读取本地成绩快照。'));
      } finally {
        setIsLoadingResults(false);
      }
    },
    [selectedClass],
  );

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    if (isLoadingDepartments) {
      return;
    }

    void loadClasses(selectedDepartmentId);
  }, [isLoadingDepartments, loadClasses, selectedDepartmentId]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <DecoratedPageHeader
        badge={<Tag>{studentCourseResultsViewLabMeta.name}</Tag>}
        description="按本地班级读取学生课程成绩快照；默认 CACHE_FIRST 且不携带 upstream token。"
        icon={<FileSearchOutlined />}
        title="学生课程成绩查看"
      />

      <Card title="筛选条件">
        <div className="flex flex-col gap-4">
          {departmentOptionsError ? (
            <Alert showIcon type="warning" title={departmentOptionsError} />
          ) : null}
          {classOptionsError ? <Alert showIcon type="warning" title={classOptionsError} /> : null}
          {resultError ? <Alert showIcon type="error" title={resultError} /> : null}

          <Form<SearchFormValues>
            form={form}
            initialValues={{
              schoolYear: ALL_VALUE,
              semester: ALL_VALUE,
            }}
            layout="vertical"
            requiredMark={false}
            onFinish={(values) => {
              void handleReadCache(values);
            }}
          >
            <ResponsiveGrid className="gap-4" columns={{ compact: 1, regular: 2, wide: 3 }}>
              <DepartmentFormItem
                disabled={isLoadingDepartments || isLoadingClasses || isLoadingResults}
                emptyText="当前没有可选系部"
                help={
                  selectedDepartment
                    ? `班级列表只显示 ${selectedDepartment.label} 下的本地班级。`
                    : '先选择系部，再选择本地班级。'
                }
                label="系部"
                loading={isLoadingDepartments}
                name="departmentId"
                options={departmentOptions}
                placeholder="选择系部"
                required
                selectProps={{
                  onChange: () => {
                    form.setFieldsValue({
                      classCode: undefined,
                    });
                    setResultState(null);
                    setClassOptionsError(null);
                  },
                }}
                validateStatus={departmentOptionsError ? 'warning' : undefined}
              />

              <Form.Item
                extra={
                  selectedClass
                    ? `成绩接口传 classCode：${selectedClass.classCode}`
                    : '成绩查询使用 org_class.class_code，不使用本地 id。'
                }
                label="本地班级"
                name="classCode"
                rules={[{ required: true, message: '请选择本地班级' }]}
              >
                <Select
                  disabled={!selectedDepartmentId || isLoadingDepartments || isLoadingResults}
                  loading={isLoadingClasses}
                  optionFilterProp="label"
                  options={classOptions}
                  placeholder="选择班级"
                  showSearch
                  onChange={() => {
                    setResultState(null);
                  }}
                />
              </Form.Item>

              <Form.Item
                extra="选择全部学年时，请求不会传 schoolYear 字段。"
                label="学年"
                name="schoolYear"
                rules={[{ required: true, message: '请选择学年' }]}
              >
                <Select options={schoolYearOptions} />
              </Form.Item>

              <Form.Item
                extra="选择全部学期时，请求不会传 semester 字段。"
                label="学期"
                name="semester"
                rules={[{ required: true, message: '请选择学期' }]}
              >
                <Select options={SEMESTER_OPTIONS} />
              </Form.Item>

              <Form.Item
                extra="本地过滤已返回结果，不作为后端查询参数。"
                label="学生"
                name="studentSearch"
              >
                <Input allowClear placeholder="输入学号或姓名" prefix={<SearchOutlined />} />
              </Form.Item>
            </ResponsiveGrid>

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={isLoadingClasses || isLoadingDepartments}
                htmlType="submit"
                icon={<DatabaseOutlined />}
                loading={isLoadingResults}
                type="primary"
              >
                读取本地快照
              </Button>
              <Button
                disabled={isLoadingClasses || isLoadingDepartments || isLoadingResults}
                icon={<ReloadOutlined />}
                onClick={() => void loadClasses(selectedDepartmentId)}
              >
                重载班级
              </Button>
              <Button
                disabled={isLoadingClasses || isLoadingDepartments || isLoadingResults}
                icon={<ReloadOutlined />}
                onClick={() => void loadDepartments()}
              >
                重载系部
              </Button>
            </div>
          </Form>
        </div>
      </Card>

      <Card title="成绩概览">
        {result ? (
          <div className="flex flex-col gap-4">
            <Descriptions bordered column={isCompactViewport ? 1 : 3} size="small">
              <Descriptions.Item label="班级">
                {resultState?.query.className
                  ? `${resultState.query.className}（${resultState.query.classCode}）`
                  : resultState?.query.classCode}
              </Descriptions.Item>
              <Descriptions.Item label="查询学年">
                {resultState?.query.schoolYear === ALL_VALUE
                  ? '全部学年'
                  : `${resultState?.query.schoolYear} 学年`}
              </Descriptions.Item>
              <Descriptions.Item label="查询学期">
                {resultState?.query.semester === ALL_VALUE
                  ? '全部学期'
                  : formatSemester(resultState?.query.semester ?? null)}
              </Descriptions.Item>
              <Descriptions.Item label="目标学生">{result.studentCount}</Descriptions.Item>
              <Descriptions.Item label="成绩行">{result.rowCount}</Descriptions.Item>
              <Descriptions.Item label="失败学生">{result.failedStudentCount}</Descriptions.Item>
              <Descriptions.Item label="缓存命中">{result.cacheHitStudentCount}</Descriptions.Item>
              <Descriptions.Item label="上游返回">
                {result.upstreamFetchedStudentCount}
              </Descriptions.Item>
              <Descriptions.Item label="当前可见">{visibleRows.length}</Descriptions.Item>
            </Descriptions>

            {result.failures.length > 0 ? (
              <Alert
                action={
                  <Button href="/labs/student-course-results-pull" size="small">
                    去刷新上游
                  </Button>
                }
                description="部分学生暂无本地成绩快照，请先在成绩拉取页刷新上游数据。"
                showIcon
                title="存在缺失或失败学生"
                type="warning"
              />
            ) : null}
          </div>
        ) : (
          <Alert
            showIcon
            description="选择系部、班级、学年和学期后读取本地快照；展示页不会主动登录或刷新 upstream。"
            title="还没有读取成绩"
            type="info"
          />
        )}
      </Card>

      <Card title="成绩明细">
        {isLoadingResults ? (
          <div
            className="flex items-center justify-center"
            style={{ minHeight: isCompactViewport ? 220 : 280 }}
          >
            <Spin size="large" />
          </div>
        ) : result ? (
          <Tabs
            activeKey={effectiveActiveTermKey}
            items={termTabs.map((tab) => {
              const tabRows = filterRowsByTerm(searchedRows, tab.key);

              return {
                key: tab.key,
                label: tab.label,
                children: (
                  <Table<DisplayRow>
                    columns={resultColumns}
                    dataSource={tabRows}
                    locale={{
                      emptyText: (
                        <Empty description="暂无成绩行" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      ),
                    }}
                    pagination={{ pageSize: 30, showSizeChanger: true }}
                    rowKey={(record, index) =>
                      [
                        record.studentNumber,
                        record.schoolYear ?? 'no-year',
                        record.semester ?? 'no-semester',
                        record.courseId ?? record.courseName ?? 'course',
                        index ?? 0,
                      ].join(':')
                    }
                    scroll={{ x: 1740 }}
                    size="small"
                  />
                ),
              };
            })}
            size="small"
            tabBarGutter={token.marginXS}
            tabPosition={isCompactViewport ? 'top' : 'left'}
            onChange={setActiveTermKey}
          />
        ) : (
          <div
            className="flex items-center justify-center"
            style={{
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusLG,
              minHeight: isCompactViewport ? 220 : 280,
            }}
          >
            <Empty description="暂无成绩明细" />
          </div>
        )}
      </Card>

      <Card title="失败学生">
        {result?.failures.length ? (
          <Table<StudentCourseResultsFailure>
            columns={failureColumns}
            dataSource={result.failures}
            pagination={
              result.failures.length > 10 ? { pageSize: 10, showSizeChanger: true } : false
            }
            rowKey={(record, index) => `${record.studentNumber}:${record.code}:${index ?? 0}`}
            scroll={{ x: 760 }}
            size="small"
          />
        ) : (
          <Alert
            showIcon
            type={result ? 'success' : 'info'}
            title={result ? '当前结果没有失败学生' : '读取后这里会展示 failures 明细'}
          />
        )}
      </Card>
    </div>
  );
}
