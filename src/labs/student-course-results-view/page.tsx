// src/labs/student-course-results-view/page.tsx

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
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
  Typography,
} from 'antd';
import type { ColumnsType, ColumnType } from 'antd/es/table';

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
  type StudentCourseResultsItem,
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

type PivotCourseColumn = {
  courseId: string | null;
  courseName: string | null;
  key: string;
  schoolYear: string | null;
  semester: string | null;
  teacherName: string | null;
  title: string;
};

type PivotScoreCell = {
  isPass: number | null;
  periodicFinalTotalScore: string | null;
  totalScore: string | null;
};

type PivotStudentRow = {
  fetchedAt: string | null;
  resultCount: number;
  scores: Record<string, PivotScoreCell[]>;
  source: StudentCourseResultsSource;
  studentName: string | null;
  studentNumber: string;
};

type PivotTableData = {
  courseColumns: PivotCourseColumn[];
  studentRows: PivotStudentRow[];
};

type TermTab = {
  key: string;
  primaryLabel: string;
  secondaryLabel: string;
  semesterOrdinal: number | null;
  schoolYear: string | null;
  semester: string | null;
};

const ALL_VALUE = 'ALL';
const AUTO_TERM_VALUE = '__AUTO_TERM__';
const COMPACT_VIEWPORT_QUERY = '(max-width: 1120px)';
const STUDENT_NUMBER_COLUMN_WIDTH = 98;
const STUDENT_NAME_COLUMN_WIDTH = 82;
const FETCHED_AT_COLUMN_WIDTH = 76;
const SOURCE_COLUMN_WIDTH = 60;
const PIVOT_COURSE_COLUMN_WIDTH = 72;
const PIVOT_BASE_SCROLL_X =
  STUDENT_NUMBER_COLUMN_WIDTH +
  STUDENT_NAME_COLUMN_WIDTH +
  FETCHED_AT_COLUMN_WIDTH +
  SOURCE_COLUMN_WIDTH;
const SOURCE_TAG_WIDTH = 34;

const SOURCE_LABELS: Record<StudentCourseResultsSource, string> = {
  CACHE: '本地',
  STALE_CACHE: '旧',
  UPSTREAM: '上游',
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

function buildStableColumnStyle(width: number): CSSProperties {
  return {
    maxWidth: width,
    minWidth: width,
    width,
  };
}

function buildStableColumnSizing<TRecord>(
  width: number,
): Pick<ColumnType<TRecord>, 'onCell' | 'onHeaderCell' | 'width'> {
  return {
    onCell: () => ({
      style: buildStableColumnStyle(width),
    }),
    onHeaderCell: () => ({
      style: {
        ...buildStableColumnStyle(width),
        textAlign: 'center',
      },
    }),
    width,
  };
}

function formatDateTimeParts(value: string | null | undefined) {
  if (!value) {
    return {
      date: '未返回',
      time: null,
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: value,
      time: null,
    };
  }

  return {
    date: date.toLocaleDateString('zh-CN', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }),
    time: date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
    }),
  };
}

function renderFetchedAt(value: string | null) {
  const parts = formatDateTimeParts(value);
  const dateFontSize = 10;
  const timeFontSize = 9;

  return (
    <span
      style={{
        display: 'block',
        overflow: 'hidden',
        textAlign: 'center',
        textOverflow: 'ellipsis',
        width: '100%',
      }}
    >
      <span
        style={{
          display: 'block',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.05,
          width: '100%',
        }}
      >
        <span
          style={{
            display: 'block',
            fontSize: dateFontSize,
            lineHeight: 1.05,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {parts.date}
        </span>
        <span
          className="text-text-secondary"
          style={{
            display: 'block',
            fontSize: timeFontSize,
            lineHeight: 1.05,
            whiteSpace: 'nowrap',
          }}
        >
          {parts.time ?? '\u00A0'}
        </span>
      </span>
    </span>
  );
}

function renderStableTextCell(value: string | null | undefined) {
  if (!value) {
    return <span className="text-text-secondary">-</span>;
  }

  return (
    <span
      title={value}
      style={{
        display: 'block',
        fontVariantNumeric: 'tabular-nums',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '100%',
      }}
    >
      {value}
    </span>
  );
}

function formatSchoolYear(value: string | null) {
  const schoolYear = value?.trim();

  if (!schoolYear) {
    return '未返回学年';
  }

  if (/^\d{4}$/.test(schoolYear)) {
    const startYear = Number(schoolYear);
    const endYearSuffix = String((startYear + 1) % 100).padStart(2, '0');

    return `${schoolYear.slice(-2)}-${endYearSuffix}学年`;
  }

  return `${schoolYear} 学年`;
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
    compareTextValue(b.semester, a.semester) ||
    compareTextValue(a.courseName, b.courseName)
  );
}

function flattenStudentItems(items: readonly StudentCourseResultsItem[]): DisplayRow[] {
  return items
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
  const termRows = [...rows]
    .sort(
      (a, b) =>
        compareTextValue(a.schoolYear, b.schoolYear) || compareTextValue(a.semester, b.semester),
    )
    .filter((row, index, source) => {
      const currentKey = buildTermKey(row.schoolYear, row.semester);
      const previousKey =
        index > 0 ? buildTermKey(source[index - 1].schoolYear, source[index - 1].semester) : null;

      return currentKey !== previousKey;
    });
  const ordinalByKey = new Map(
    termRows.map((row, index) => [buildTermKey(row.schoolYear, row.semester), index + 1] as const),
  );
  const tabByKey = new Map<string, TermTab>();

  for (const row of rows) {
    const key = buildTermKey(row.schoolYear, row.semester);

    if (tabByKey.has(key)) {
      continue;
    }

    tabByKey.set(key, {
      key,
      primaryLabel: formatSchoolYear(row.schoolYear),
      secondaryLabel: formatSemester(row.semester),
      semesterOrdinal: ordinalByKey.get(key) ?? null,
      schoolYear: row.schoolYear,
      semester: row.semester,
    });
  }

  return [...tabByKey.values()].sort(
    (a, b) =>
      compareTextValue(b.schoolYear, a.schoolYear) || compareTextValue(b.semester, a.semester),
  );
}

function filterStudentItemsBySearch(
  items: readonly StudentCourseResultsItem[],
  keyword: string | undefined,
) {
  const normalizedKeyword = keyword?.trim().toLowerCase();

  if (!normalizedKeyword) {
    return [...items];
  }

  return items.filter((item) => {
    const studentNumber = item.studentNumber.toLowerCase();
    const studentName = item.studentName?.toLowerCase() ?? '';

    return studentNumber.includes(normalizedKeyword) || studentName.includes(normalizedKeyword);
  });
}

function filterRowsByTerm(rows: readonly DisplayRow[], activeTermKey: string) {
  if (activeTermKey === ALL_VALUE) {
    return [...rows];
  }

  return rows.filter((row) => buildTermKey(row.schoolYear, row.semester) === activeTermKey);
}

function shouldIncludeResultInTerm(input: {
  activeTermKey: string;
  schoolYear: string | null;
  semester: string | null;
}) {
  return (
    input.activeTermKey === ALL_VALUE ||
    buildTermKey(input.schoolYear, input.semester) === input.activeTermKey
  );
}

function resolveEffectiveActiveTermKey(activeTermKey: string, termTabs: readonly TermTab[]) {
  if (activeTermKey === AUTO_TERM_VALUE) {
    return termTabs[0]?.key ?? ALL_VALUE;
  }

  if (termTabs.some((tab) => tab.key === activeTermKey)) {
    return activeTermKey;
  }

  return termTabs[0]?.key ?? ALL_VALUE;
}

function buildCourseKey(row: DisplayRow) {
  return [
    row.schoolYear ?? 'no-year',
    row.semester ?? 'no-semester',
    row.courseId?.trim() || row.courseName?.trim() || 'no-course',
    row.teacherName?.trim() || 'no-teacher',
  ].join('::');
}

function resolveCourseName(row: DisplayRow) {
  return row.courseName?.trim() || row.courseId?.trim() || '未返回课程';
}

function buildCourseTitle(row: DisplayRow, activeTermKey: string) {
  const courseName = resolveCourseName(row);

  if (activeTermKey === ALL_VALUE) {
    return `${formatSchoolYear(row.schoolYear)} ${formatSemester(row.semester)} ${courseName}`;
  }

  return courseName;
}

function compareCourseColumns(a: PivotCourseColumn, b: PivotCourseColumn) {
  return (
    compareTextValue(b.schoolYear, a.schoolYear) ||
    compareTextValue(b.semester, a.semester) ||
    compareTextValue(a.courseName, b.courseName) ||
    compareTextValue(a.teacherName, b.teacherName)
  );
}

function buildScoreParts(cell: PivotScoreCell) {
  const totalScore = cell.totalScore?.trim();
  const periodicScore = cell.periodicFinalTotalScore?.trim();

  if (totalScore && periodicScore && totalScore !== periodicScore) {
    return [totalScore, periodicScore];
  }

  return [totalScore || periodicScore || '-'];
}

function isFailingScoreText(value: string) {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) {
    return false;
  }

  return Number(value) < 60;
}

function renderScorePart(value: string, index: number) {
  const content = isFailingScoreText(value) ? (
    <span style={{ color: 'var(--ant-color-error)' }}>{value}</span>
  ) : (
    value
  );

  if (index === 0) {
    return <span key={`${value}:${index}`}>{content}</span>;
  }

  return (
    <span key={`${value}:${index}`}>
      <span className="text-text-tertiary"> / </span>
      {content}
    </span>
  );
}

function renderScoreCells(cells: readonly PivotScoreCell[] | undefined) {
  if (!cells?.length) {
    return <span className="text-text-secondary">-</span>;
  }

  const scoreParts = cells.flatMap(buildScoreParts);

  return <span>{scoreParts.map(renderScorePart)}</span>;
}

function buildPivotTableData(
  items: readonly StudentCourseResultsItem[],
  activeTermKey: string,
): PivotTableData {
  const courseColumnByKey = new Map<string, PivotCourseColumn>();
  const studentRows = items
    .map<PivotStudentRow>((item) => {
      const scores: Record<string, PivotScoreCell[]> = {};
      let resultCount = 0;

      for (const record of item.results) {
        if (
          !shouldIncludeResultInTerm({
            activeTermKey,
            schoolYear: record.schoolYear,
            semester: record.semester,
          })
        ) {
          continue;
        }

        resultCount += 1;
        const row: DisplayRow = {
          ...record,
          fetchedAt: item.fetchedAt,
          source: item.source,
          studentName: item.studentName,
          studentNumber: item.studentNumber,
        };
        const courseKey = buildCourseKey(row);

        if (!courseColumnByKey.has(courseKey)) {
          courseColumnByKey.set(courseKey, {
            courseId: row.courseId,
            courseName: row.courseName,
            key: courseKey,
            schoolYear: row.schoolYear,
            semester: row.semester,
            teacherName: row.teacherName,
            title: buildCourseTitle(row, activeTermKey),
          });
        }

        scores[courseKey] = [
          ...(scores[courseKey] ?? []),
          {
            isPass: row.isPass,
            periodicFinalTotalScore: row.periodicFinalTotalScore,
            totalScore: row.totalScore,
          },
        ];
      }

      return {
        fetchedAt: item.fetchedAt,
        resultCount,
        scores,
        source: item.source,
        studentName: item.studentName,
        studentNumber: item.studentNumber,
      };
    })
    .sort((a, b) => compareTextValue(a.studentNumber, b.studentNumber));

  return {
    courseColumns: [...courseColumnByKey.values()].sort(compareCourseColumns),
    studentRows,
  };
}

function buildPivotColumns(
  courseColumns: readonly PivotCourseColumn[],
  isCompactViewport: boolean,
  token: ReturnType<typeof theme.useToken>['token'],
): ColumnsType<PivotStudentRow> {
  return [
    {
      ...buildStableColumnSizing<PivotStudentRow>(STUDENT_NUMBER_COLUMN_WIDTH),
      align: 'center' as const,
      dataIndex: 'studentNumber',
      fixed: isCompactViewport ? undefined : 'left',
      key: 'studentNumber',
      render: (studentNumber: string) => renderStableTextCell(studentNumber),
      title: '学号',
    },
    {
      ...buildStableColumnSizing<PivotStudentRow>(STUDENT_NAME_COLUMN_WIDTH),
      dataIndex: 'studentName',
      fixed: isCompactViewport ? undefined : 'left',
      key: 'studentName',
      render: (studentName: string | null) => renderStableTextCell(studentName),
      title: '姓名',
    },
    ...courseColumns.map((course) => ({
      ...buildStableColumnSizing<PivotStudentRow>(PIVOT_COURSE_COLUMN_WIDTH),
      align: 'center' as const,
      key: course.key,
      render: (_: unknown, record: PivotStudentRow) => renderScoreCells(record.scores[course.key]),
      title: (
        <span
          style={{
            color: token.colorText,
            display: 'block',
            fontSize: token.fontSizeSM,
            lineHeight: token.lineHeightSM,
            marginInline: 'auto',
            maxWidth: '4em',
            textAlign: 'center',
            whiteSpace: 'normal',
            wordBreak: 'break-all',
          }}
        >
          {course.title}
        </span>
      ),
    })),
    {
      ...buildStableColumnSizing<PivotStudentRow>(FETCHED_AT_COLUMN_WIDTH),
      align: 'center' as const,
      dataIndex: 'fetchedAt',
      fixed: isCompactViewport ? undefined : 'right',
      key: 'fetchedAt',
      render: (fetchedAt: string | null) => renderFetchedAt(fetchedAt),
      title: <span style={{ fontSize: token.fontSizeXS, lineHeight: 1.15 }}>更新时间</span>,
    },
    {
      ...buildStableColumnSizing<PivotStudentRow>(SOURCE_COLUMN_WIDTH),
      align: 'center' as const,
      dataIndex: 'source',
      fixed: isCompactViewport ? undefined : 'right',
      key: 'source',
      render: (source: StudentCourseResultsSource) => (
        <Tag
          color={SOURCE_COLORS[source]}
          style={{
            alignItems: 'center',
            boxSizing: 'border-box',
            display: 'inline-flex',
            fontSize: token.fontSizeXS,
            height: token.controlHeightXS,
            justifyContent: 'center',
            lineHeight: 1,
            marginInlineEnd: 0,
            paddingInline: 0,
            verticalAlign: 'middle',
            width: SOURCE_TAG_WIDTH,
          }}
        >
          {SOURCE_LABELS[source]}
        </Tag>
      ),
      title: <span style={{ fontSize: token.fontSizeXS, lineHeight: 1.15 }}>来源</span>,
    },
  ];
}

function resolvePivotScrollX(courseColumnCount: number) {
  return PIVOT_BASE_SCROLL_X + courseColumnCount * PIVOT_COURSE_COLUMN_WIDTH;
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
  const [activeTermKey, setActiveTermKey] = useState(AUTO_TERM_VALUE);
  const [selectedStudentNumber, setSelectedStudentNumber] = useState<string | null>(null);
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
  const resultItems = useMemo(() => resultState?.data.items ?? [], [resultState]);
  const searchedItems = useMemo(
    () => filterStudentItemsBySearch(resultItems, studentSearch),
    [resultItems, studentSearch],
  );
  const searchedRows = useMemo(() => flattenStudentItems(searchedItems), [searchedItems]);
  const termTabs = useMemo(() => buildTermTabs(searchedRows), [searchedRows]);
  const effectiveActiveTermKey = resolveEffectiveActiveTermKey(activeTermKey, termTabs);
  const visibleRows = useMemo(
    () => filterRowsByTerm(searchedRows, effectiveActiveTermKey),
    [effectiveActiveTermKey, searchedRows],
  );
  const activePivotData = useMemo(
    () => buildPivotTableData(searchedItems, effectiveActiveTermKey),
    [effectiveActiveTermKey, searchedItems],
  );
  const activePivotColumns = useMemo(
    () => buildPivotColumns(activePivotData.courseColumns, isCompactViewport, token),
    [activePivotData.courseColumns, isCompactViewport, token],
  );
  const result = resultState?.data ?? null;

  useEffect(() => {
    if (
      selectedStudentNumber &&
      !activePivotData.studentRows.some((row) => row.studentNumber === selectedStudentNumber)
    ) {
      setSelectedStudentNumber(null);
    }
  }, [activePivotData.studentRows, selectedStudentNumber]);

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

        setActiveTermKey(AUTO_TERM_VALUE);
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
                  : formatSchoolYear(resultState?.query.schoolYear ?? null)}
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
              <Descriptions.Item label="当前学生">
                {activePivotData.studentRows.length}
              </Descriptions.Item>
              <Descriptions.Item label="当前课程">
                {activePivotData.courseColumns.length}
              </Descriptions.Item>
              <Descriptions.Item label="当前成绩行">{visibleRows.length}</Descriptions.Item>
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
          <div className="student-course-results-view-table-shell">
            <Tabs
              activeKey={effectiveActiveTermKey}
              items={termTabs.map((tab) => {
                const isActiveTab = tab.key === effectiveActiveTermKey;

                return {
                  key: tab.key,
                  label: (
                    <div style={{ maxWidth: isCompactViewport ? 180 : 200 }}>
                      <div
                        style={{
                          fontWeight: isActiveTab ? token.fontWeightStrong : undefined,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tab.primaryLabel}
                      </div>
                      <Typography.Text
                        style={{
                          fontSize: token.fontSizeSM,
                          display: 'block',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        type="secondary"
                      >
                        <span
                          style={{
                            alignItems: 'center',
                            display: 'inline-flex',
                            gap: token.marginXXS,
                            maxWidth: '100%',
                          }}
                        >
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {tab.secondaryLabel}
                          </span>
                          {tab.semesterOrdinal ? (
                            <span
                              style={{
                                alignItems: 'center',
                                background: token.colorFillTertiary,
                                borderRadius: token.borderRadiusSM * 999,
                                color: token.colorTextSecondary,
                                display: 'inline-flex',
                                flex: 'none',
                                fontSize: token.fontSizeSM,
                                fontVariantNumeric: 'tabular-nums',
                                height: 18,
                                justifyContent: 'center',
                                lineHeight: 1,
                                minWidth: tab.semesterOrdinal >= 10 ? 22 : 18,
                                paddingInline: tab.semesterOrdinal >= 10 ? 4 : 0,
                              }}
                            >
                              {tab.semesterOrdinal}
                            </span>
                          ) : null}
                        </span>
                      </Typography.Text>
                    </div>
                  ),
                  children: isActiveTab ? (
                    <Table<PivotStudentRow>
                      columns={activePivotColumns}
                      dataSource={activePivotData.studentRows}
                      locale={{
                        emptyText: (
                          <Empty description="暂无学生成绩" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        ),
                      }}
                      onRow={(record, index) => ({
                        className: [
                          index !== undefined && index % 2 === 0
                            ? 'student-course-results-view-row-even'
                            : 'student-course-results-view-row-odd',
                          record.studentNumber === selectedStudentNumber
                            ? 'student-course-results-view-row-selected'
                            : null,
                          'cursor-pointer',
                        ]
                          .filter(Boolean)
                          .join(' '),
                        onClick: () => {
                          setSelectedStudentNumber((current) =>
                            current === record.studentNumber ? null : record.studentNumber,
                          );
                        },
                      })}
                      pagination={{
                        defaultPageSize: 60,
                        pageSizeOptions: [30, 60],
                        showSizeChanger: true,
                      }}
                      rowKey={(record) => record.studentNumber}
                      scroll={{ x: resolvePivotScrollX(activePivotData.courseColumns.length) }}
                      size="small"
                      tableLayout="fixed"
                    />
                  ) : null,
                };
              })}
              size="small"
              tabBarGutter={token.marginXS}
              tabPosition={isCompactViewport ? 'top' : 'left'}
              onChange={setActiveTermKey}
            />
          </div>
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

      <style>{`
        .student-course-results-view-table-shell .ant-table-tbody > tr.student-course-results-view-row-even > td,
        .student-course-results-view-table-shell
          .ant-table-tbody
          > tr.student-course-results-view-row-even:hover
          > td {
          background: var(--ant-color-fill-quaternary);
        }
        .student-course-results-view-table-shell .ant-table-tbody > tr.student-course-results-view-row-odd:hover > td {
          background: var(--ant-color-fill-tertiary);
        }
        .student-course-results-view-table-shell .ant-table-tbody > tr.student-course-results-view-row-selected > td,
        .student-course-results-view-table-shell
          .ant-table-tbody
          > tr.student-course-results-view-row-selected:hover
          > td {
          background: var(--ant-color-primary-bg);
        }
        .student-course-results-view-table-shell .ant-table-tbody > tr > td {
          transition: background-color 0.2s ease;
        }
      `}</style>
    </div>
  );
}
