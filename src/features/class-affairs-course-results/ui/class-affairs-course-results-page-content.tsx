// src/features/class-affairs-course-results/ui/class-affairs-course-results-page-content.tsx

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CloudSyncOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Alert, Button, Empty, Form, Input, Select, Spin, Table, Tabs, Tag, theme } from 'antd';
import type { ColumnsType, ColumnType } from 'antd/es/table';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
} from '@/entities/academic-semester';
import {
  buildUpstreamLoginCredentialsInitialValues,
  canUseRememberedUpstreamLoginCredentials,
  isExpiredUpstreamSessionError,
  type StoredUpstreamSession,
  type UpstreamLoginFormValues,
  UpstreamLoginModal,
  useUpstreamSession,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import {
  fetchManagedClassCourseResults,
  listMyManagedClasses,
  type ManagedClassCourseResultsClass,
  type ManagedClassCourseResultsTerm,
  type ManagedCourseResultRecord,
  type ManagedCourseResultsItem,
  type ManagedCourseResultsResult,
  resolveUpstreamErrorMessage,
} from '../api';

import './class-affairs-course-results-page-content.css';

type CurrentAccount = {
  accountId: number;
  displayName: string;
};

type PendingRefreshRequest = {
  classCode: string;
  scope: 'ALL_TERMS' | 'CURRENT_TERM';
  term: ManagedClassCourseResultsTerm;
};

type DisplayRow = ManagedCourseResultRecord & {
  studentName: string | null;
  studentNumber: string;
};

type PivotScoreCell = {
  periodicFinalTotalScore: string | null;
  totalScore: string | null;
};

type PivotCourseColumn = {
  courseId: string | null;
  courseName: string | null;
  key: string;
  teacherName: string | null;
  title: string;
};

type PivotStudentRow = {
  resultCount: number;
  scores: Record<string, PivotScoreCell[]>;
  studentName: string | null;
  studentNumber: string;
};

const COMPACT_VIEWPORT_QUERY = '(max-width: 1120px)';
const STUDENT_NUMBER_COLUMN_WIDTH = 98;
const STUDENT_NAME_COLUMN_WIDTH = 82;
const PIVOT_COURSE_COLUMN_WIDTH = 72;
const PIVOT_BASE_SCROLL_X = STUDENT_NUMBER_COLUMN_WIDTH + STUDENT_NAME_COLUMN_WIDTH;
const LOCAL_CLASS_SETUP_PATH = '/academic-affairs/student-roster-membership-reconciliation';
const STUDENT_ROSTER_SYNC_REQUIRED_PREFIX = '目标班级尚未同步学生名单';
const STUDENT_ROSTER_SYNC_LINK_TEXT = '同步学生名单';

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

function buildTermKey(term: Pick<ManagedClassCourseResultsTerm, 'schoolYear' | 'semester'>) {
  return `${term.schoolYear}::${term.semester}`;
}

function formatClassLabel(item: ManagedClassCourseResultsClass) {
  return `${item.className || item.classCode}（${item.classCode}）`;
}

function resolveClassCode(item: ManagedClassCourseResultsClass) {
  return item.classCode?.trim() || null;
}

function renderCourseResultsErrorTitle(message: string) {
  if (!message.includes(STUDENT_ROSTER_SYNC_REQUIRED_PREFIX)) {
    return message;
  }

  const linkTextIndex = message.lastIndexOf(STUDENT_ROSTER_SYNC_LINK_TEXT);

  if (linkTextIndex < 0) {
    return message;
  }

  return (
    <>
      {message.slice(0, linkTextIndex)}
      <a href={LOCAL_CLASS_SETUP_PATH}>{STUDENT_ROSTER_SYNC_LINK_TEXT}</a>
      {message.slice(linkTextIndex + STUDENT_ROSTER_SYNC_LINK_TEXT.length)}
    </>
  );
}

function compareManagedClasses(
  first: ManagedClassCourseResultsClass,
  second: ManagedClassCourseResultsClass,
) {
  const gradeCompare = (second.gradeYear ?? -1) - (first.gradeYear ?? -1);

  if (gradeCompare !== 0) {
    return gradeCompare;
  }

  return compareTextValue(resolveClassCode(second), resolveClassCode(first));
}

function compareTextValue(a: string | null, b: string | null) {
  return (a ?? '').localeCompare(b ?? '', 'zh-CN', {
    numeric: true,
    sensitivity: 'base',
  });
}

function buildCourseKey(row: DisplayRow) {
  return [
    row.courseId?.trim() || row.courseName?.trim() || 'no-course',
    row.teacherName?.trim() || 'no-teacher',
  ].join('::');
}

function resolveCourseName(row: DisplayRow) {
  return row.courseName?.trim() || row.courseId?.trim() || '未返回课程';
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

  return <span>{cells.flatMap(buildScoreParts).map(renderScorePart)}</span>;
}

function filterStudentItemsBySearch(
  items: readonly ManagedCourseResultsItem[],
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

function filterItemsByTerm(
  items: readonly ManagedCourseResultsItem[],
  term: ManagedClassCourseResultsTerm | null,
) {
  if (!term) {
    return [];
  }

  return items
    .map((item) => ({
      ...item,
      results: item.results.filter(
        (record) => record.schoolYear === term.schoolYear && record.semester === term.semester,
      ),
    }))
    .filter((item) => item.results.length > 0);
}

function formatSchoolYear(value: string) {
  if (/^\d{4}$/.test(value)) {
    const startYear = Number(value);
    const endYearSuffix = String((startYear + 1) % 100).padStart(2, '0');

    return `${value.slice(-2)}-${endYearSuffix}学年`;
  }

  return `${value} 学年`;
}

function formatSemester(value: string) {
  if (value === '1') {
    return '第一学期';
  }

  if (value === '2') {
    return '第二学期';
  }

  return `第 ${value} 学期`;
}

function buildTermLabel(schoolYear: string, semester: string) {
  return `${formatSchoolYear(schoolYear)} ${formatSemester(semester)}`;
}

function buildTermOrdinalByKey(terms: readonly ManagedClassCourseResultsTerm[]) {
  return new Map(
    [...terms]
      .sort(
        (first, second) =>
          compareTextValue(first.schoolYear, second.schoolYear) ||
          compareTextValue(first.semester, second.semester),
      )
      .map((term, index) => [buildTermKey(term), index + 1] as const),
  );
}

function resolveCurrentTermKey(currentSemester: AcademicSemesterRecord | null) {
  if (!currentSemester) {
    return null;
  }

  return `${currentSemester.schoolYear}::${currentSemester.termNumber}`;
}

function buildTermsFromResult(
  result: ManagedCourseResultsResult | null,
  currentSemester: AcademicSemesterRecord | null,
) {
  const currentTermKey = resolveCurrentTermKey(currentSemester);
  const termByKey = new Map<string, ManagedClassCourseResultsTerm>();

  for (const item of result?.items ?? []) {
    for (const record of item.results) {
      const schoolYear = record.schoolYear?.trim();
      const semester = record.semester?.trim();

      if (!schoolYear || !semester) {
        continue;
      }

      const key = `${schoolYear}::${semester}`;

      if (termByKey.has(key)) {
        continue;
      }

      termByKey.set(key, {
        canPullFromUpstream: true,
        disabledReason: null,
        hasLocalData: true,
        isCurrent: key === currentTermKey,
        label: buildTermLabel(schoolYear, semester),
        schoolYear,
        semester,
      });
    }
  }

  return [...termByKey.values()].sort(
    (first, second) =>
      compareTextValue(second.schoolYear, first.schoolYear) ||
      compareTextValue(second.semester, first.semester),
  );
}

function buildPivotTableData(items: readonly ManagedCourseResultsItem[]) {
  const courseColumnByKey = new Map<string, PivotCourseColumn>();
  const studentRows = items
    .map<PivotStudentRow>((item) => {
      const scores: Record<string, PivotScoreCell[]> = {};

      for (const record of item.results) {
        const row: DisplayRow = {
          ...record,
          studentName: item.studentName,
          studentNumber: item.studentNumber,
        };
        const courseKey = buildCourseKey(row);

        if (!courseColumnByKey.has(courseKey)) {
          courseColumnByKey.set(courseKey, {
            courseId: row.courseId,
            courseName: row.courseName,
            key: courseKey,
            teacherName: row.teacherName,
            title: resolveCourseName(row),
          });
        }

        scores[courseKey] = [
          ...(scores[courseKey] ?? []),
          {
            periodicFinalTotalScore: row.periodicFinalTotalScore,
            totalScore: row.totalScore,
          },
        ];
      }

      return {
        resultCount: item.results.length,
        scores,
        studentName: item.studentName,
        studentNumber: item.studentNumber,
      };
    })
    .sort((a, b) => compareTextValue(a.studentNumber, b.studentNumber));

  return {
    courseColumns: [...courseColumnByKey.values()].sort((a, b) =>
      compareTextValue(a.courseName, b.courseName),
    ),
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
  ];
}

function resolveScrollX(courseColumnCount: number) {
  return PIVOT_BASE_SCROLL_X + courseColumnCount * PIVOT_COURSE_COLUMN_WIDTH;
}

function resolveRefreshScope(term: ManagedClassCourseResultsTerm) {
  return term.isCurrent ? 'CURRENT_TERM' : 'ALL_TERMS';
}

export function ClassAffairsCourseResultsPageContent({
  currentAccount,
}: {
  currentAccount: CurrentAccount;
}) {
  const { token } = theme.useToken();
  const isCompactViewport = useCompactViewport();
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const [classes, setClasses] = useState<ManagedClassCourseResultsClass[]>([]);
  const [currentSemester, setCurrentSemester] = useState<AcademicSemesterRecord | null>(null);
  const [selectedClassCode, setSelectedClassCode] = useState<string | null>(null);
  const [activeTermKey, setActiveTermKey] = useState<string | null>(null);
  const [result, setResult] = useState<ManagedCourseResultsResult | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentNumber, setSelectedStudentNumber] = useState<string | null>(null);
  const [hasLoadedAllLocalTerms, setHasLoadedAllLocalTerms] = useState(false);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [pendingRefreshRequest, setPendingRefreshRequest] = useState<PendingRefreshRequest | null>(
    null,
  );
  const {
    clear,
    clearRememberedCredentials,
    keepAliveFailure,
    login: loginUpstream,
    persistSessionFromResult,
    rememberedCredentials,
    session: storedSession,
  } = useUpstreamSession({
    account: currentAccount,
    keepAlive: true,
  });
  const hasRememberedCredentials = canUseRememberedUpstreamLoginCredentials({
    rememberedCredentials,
  });
  const terms = useMemo(
    () => buildTermsFromResult(result, currentSemester),
    [currentSemester, result],
  );
  const termOrdinalByKey = useMemo(() => buildTermOrdinalByKey(terms), [terms]);
  const hasManagedClasses = classes.length > 0;
  const usableClasses = useMemo(
    () => classes.filter((item) => resolveClassCode(item)).sort(compareManagedClasses),
    [classes],
  );
  const hasOnlyIncompleteClasses = hasManagedClasses && usableClasses.length === 0;
  const classOptions = useMemo(
    () =>
      usableClasses.map((item) => ({
        label: formatClassLabel(item),
        value: resolveClassCode(item) as string,
      })),
    [usableClasses],
  );
  const activeTerm = useMemo(
    () => terms.find((term) => buildTermKey(term) === activeTermKey) ?? null,
    [activeTermKey, terms],
  );
  const searchedItems = useMemo(
    () => filterStudentItemsBySearch(result?.items ?? [], studentSearch),
    [result?.items, studentSearch],
  );
  const visibleItems = useMemo(
    () => filterItemsByTerm(searchedItems, activeTerm),
    [activeTerm, searchedItems],
  );
  const pivotData = useMemo(() => buildPivotTableData(visibleItems), [visibleItems]);
  const pivotColumns = useMemo(
    () => buildPivotColumns(pivotData.courseColumns, isCompactViewport, token),
    [isCompactViewport, pivotData.courseColumns, token],
  );

  const loadManagedClasses = useCallback(async () => {
    setIsLoadingOverview(true);
    setOverviewError(null);

    try {
      const [nextClasses, currentSemesters] = await Promise.all([
        listMyManagedClasses(),
        requestAcademicSemesters({ isCurrent: true, limit: 1 }),
      ]);
      const nextUsableClasses = nextClasses
        .filter((item) => resolveClassCode(item))
        .sort(compareManagedClasses);
      const nextClassCode = resolveClassCode(nextUsableClasses[0] ?? { classCode: null });

      setClasses(nextClasses);
      setCurrentSemester(currentSemesters[0] ?? null);
      setSelectedClassCode(nextClassCode);
      setActiveTermKey(null);
      setHasLoadedAllLocalTerms(false);
      return nextClassCode;
    } catch (error) {
      setClasses([]);
      setCurrentSemester(null);
      setSelectedClassCode(null);
      setActiveTermKey(null);
      setOverviewError(error instanceof Error ? error.message : '暂时无法加载本地负责班级。');
      return null;
    } finally {
      setIsLoadingOverview(false);
    }
  }, []);

  const readResults = useCallback(
    async (input: {
      classCode: string;
      includeAllLocalTerms?: boolean;
      term?: ManagedClassCourseResultsTerm | null;
    }) => {
      setIsLoadingResults(true);
      setResultError(null);

      try {
        const nextResult = await fetchManagedClassCourseResults({
          classCode: input.classCode,
          refreshMode: 'CACHE_FIRST',
          schoolYear: input.term?.schoolYear,
          semester: input.term?.semester,
        });

        setResult(nextResult);
        setHasLoadedAllLocalTerms(input.includeAllLocalTerms === true || !input.term);
      } catch (error) {
        setResult(null);
        setResultError(error instanceof Error ? error.message : '暂时无法读取班级成绩。');
      } finally {
        setIsLoadingResults(false);
      }
    },
    [],
  );

  const runRefresh = useCallback(
    async (session: StoredUpstreamSession, request: PendingRefreshRequest) => {
      setIsLoadingResults(true);
      setResultError(null);
      setLoginError(null);

      try {
        const nextResult = await fetchManagedClassCourseResults({
          classCode: request.classCode,
          refreshMode: 'REFRESH',
          schoolYear: request.scope === 'CURRENT_TERM' ? request.term.schoolYear : undefined,
          semester: request.scope === 'CURRENT_TERM' ? request.term.semester : undefined,
          upstreamSessionToken: session.upstreamSessionToken,
        });

        persistSessionFromResult(session, nextResult);
        setResult(nextResult);
        setActiveTermKey(request.scope === 'CURRENT_TERM' ? buildTermKey(request.term) : null);
        setHasLoadedAllLocalTerms(request.scope === 'ALL_TERMS');
      } catch (error) {
        if (isExpiredUpstreamSessionError(error)) {
          clear();
          setPendingRefreshRequest(request);
          setLoginError('智慧校园登录已失效，请重新登录后继续同步成绩。');
          loginForm.setFieldsValue(
            buildUpstreamLoginCredentialsInitialValues({
              fallbackUserId: session.upstreamLoginId,
              rememberedCredentials,
            }),
          );
          setIsLoginModalOpen(true);
          return;
        }

        setResultError(resolveUpstreamErrorMessage(error, '暂时无法同步成绩。'));
      } finally {
        setIsLoadingResults(false);
      }
    },
    [clear, loginForm, persistSessionFromResult, rememberedCredentials],
  );

  const handleClassChange = useCallback(
    async (classCode: string) => {
      setResult(null);
      setStudentSearch('');
      setSelectedStudentNumber(null);
      setSelectedClassCode(classCode || null);
      setActiveTermKey(null);
      setHasLoadedAllLocalTerms(false);

      if (classCode) {
        await readResults({
          classCode,
        });
      }
    },
    [readResults],
  );

  const handleReload = useCallback(async () => {
    if (!selectedClassCode) {
      const nextClassCode = await loadManagedClasses();

      if (nextClassCode) {
        await readResults({
          classCode: nextClassCode,
        });
      }

      return;
    }

    await handleClassChange(selectedClassCode);
  }, [handleClassChange, loadManagedClasses, readResults, selectedClassCode]);

  const handleTermChange = useCallback(
    async (termKey: string) => {
      const nextTerm = terms.find((term) => buildTermKey(term) === termKey) ?? null;

      setActiveTermKey(termKey);
      setSelectedStudentNumber(null);

      if (!nextTerm || !selectedClassCode || nextTerm.hasLocalData === false) {
        return;
      }

      if (!hasLoadedAllLocalTerms) {
        await readResults({
          classCode: selectedClassCode,
          includeAllLocalTerms: true,
        });
      }
    },
    [hasLoadedAllLocalTerms, readResults, selectedClassCode, terms],
  );

  const requestRefresh = useCallback(
    async (term: ManagedClassCourseResultsTerm) => {
      if (!selectedClassCode) {
        return;
      }

      const nextRequest: PendingRefreshRequest = {
        classCode: selectedClassCode,
        scope: resolveRefreshScope(term),
        term,
      };

      setPendingRefreshRequest(nextRequest);
      setLoginError(null);

      if (!storedSession) {
        loginForm.setFieldsValue(
          buildUpstreamLoginCredentialsInitialValues({
            rememberedCredentials,
          }),
        );
        setIsLoginModalOpen(true);
        return;
      }

      await runRefresh(storedSession, nextRequest);
    },
    [loginForm, rememberedCredentials, runRefresh, selectedClassCode, storedSession],
  );

  const handleLoginFinish = useCallback(
    async (values: UpstreamLoginFormValues) => {
      if (!pendingRefreshRequest) {
        setLoginError('同步请求已失效，请重新选择学期。');
        return;
      }

      setIsSubmittingLogin(true);
      setLoginError(null);

      try {
        const nextSession = await loginUpstream(values);
        const nextRequest = pendingRefreshRequest;

        setPendingRefreshRequest(null);
        setIsLoginModalOpen(false);
        loginForm.resetFields();
        await runRefresh(nextSession, nextRequest);
      } catch (error) {
        setLoginError(resolveUpstreamErrorMessage(error, '暂时无法登录智慧校园。'));
      } finally {
        setIsSubmittingLogin(false);
      }
    },
    [loginForm, loginUpstream, pendingRefreshRequest, runRefresh],
  );

  useEffect(() => {
    let isCancelled = false;

    async function bootstrap() {
      const nextClassCode = await loadManagedClasses();

      if (isCancelled) {
        return;
      }

      if (nextClassCode) {
        await readResults({
          classCode: nextClassCode,
        });
      }
    }

    void bootstrap();

    return () => {
      isCancelled = true;
    };
  }, [loadManagedClasses, readResults]);

  useEffect(() => {
    if (!keepAliveFailure) {
      return;
    }

    clear();
    setLoginError(keepAliveFailure.message);
    loginForm.setFieldsValue(
      buildUpstreamLoginCredentialsInitialValues({
        fallbackUserId: keepAliveFailure.upstreamLoginId,
        rememberedCredentials,
      }),
    );
    setIsLoginModalOpen(true);
  }, [clear, keepAliveFailure, loginForm, rememberedCredentials]);

  useEffect(() => {
    if (terms.length === 0) {
      setActiveTermKey(null);
      return;
    }

    if (activeTermKey && terms.some((term) => buildTermKey(term) === activeTermKey)) {
      return;
    }

    setActiveTermKey(buildTermKey(terms[0]));
  }, [activeTermKey, terms]);

  const emptyState = activeTerm ? (
    <div className="flex min-h-70 items-center justify-center">
      <Empty
        description={
          activeTerm.disabledReason ||
          (activeTerm.canPullFromUpstream ? '当前学期暂无本地成绩' : '当前学期暂未开放成绩同步')
        }
      >
        {activeTerm.canPullFromUpstream ? (
          <Button
            icon={<CloudSyncOutlined />}
            loading={isLoadingResults}
            type="primary"
            onClick={() => void requestRefresh(activeTerm)}
          >
            {activeTerm.isCurrent ? '同步当前学期成绩' : '同步该班成绩'}
          </Button>
        ) : null}
      </Empty>
    </div>
  ) : (
    <div className="flex min-h-70 items-center justify-center">
      <Empty description="暂无可查看学期" />
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-6">
      <DecoratedPageHeader
        badge={<Tag color="blue">班务管理</Tag>}
        description="查看负责班级的课程成绩汇总；缺少本地成绩时再按需同步智慧校园。"
        icon={<FileSearchOutlined />}
        title="成绩汇总"
      />

      <section className="rounded-card bg-bg-container p-5 shadow-card">
        <div className="flex flex-col gap-4">
          {overviewError ? <Alert showIcon title={overviewError} type="error" /> : null}
          {resultError ? (
            <Alert showIcon title={renderCourseResultsErrorTitle(resultError)} type="error" />
          ) : null}
          <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,260px)_auto]">
            <label className="flex flex-col gap-2">
              <span className="text-sm text-text-secondary">负责班级</span>
              <Select
                disabled={isLoadingOverview || isLoadingResults}
                loading={isLoadingOverview}
                optionFilterProp="label"
                options={classOptions}
                placeholder="暂无负责班级"
                showSearch
                value={selectedClassCode ?? undefined}
                onChange={(value) => void handleClassChange(value)}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm text-text-secondary">学生</span>
              <Input
                allowClear
                placeholder="输入学号或姓名"
                prefix={<SearchOutlined />}
                value={studentSearch}
                onChange={(event) => {
                  setStudentSearch(event.target.value);
                  setSelectedStudentNumber(null);
                }}
              />
            </label>
            <div className="flex items-end">
              <Button
                disabled={isLoadingOverview || isLoadingResults}
                icon={<ReloadOutlined />}
                onClick={() => void handleReload()}
              >
                重新加载
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="class-affairs-course-results-table-shell">
        {isLoadingOverview && classes.length === 0 && !result ? (
          <div className="flex min-h-80 items-center justify-center">
            <Spin size="large" />
          </div>
        ) : terms.length ? (
          <Tabs
            activeKey={activeTermKey ?? undefined}
            items={terms.map((term) => {
              const termKey = buildTermKey(term);
              const isActive = termKey === activeTermKey;
              const semesterOrdinal = termOrdinalByKey.get(termKey) ?? null;

              return {
                children: isActive ? (
                  isLoadingResults ? (
                    <div className="flex min-h-80 items-center justify-center">
                      <Spin size="large" />
                    </div>
                  ) : term.hasLocalData ? (
                    <div className="flex flex-col gap-4">
                      {term.isCurrent ? (
                        <div className="flex justify-end">
                          <Button
                            icon={<CloudSyncOutlined />}
                            loading={isLoadingResults}
                            onClick={() => void requestRefresh(term)}
                          >
                            同步当前学期
                          </Button>
                        </div>
                      ) : null}
                      <Table<PivotStudentRow>
                        columns={pivotColumns}
                        dataSource={pivotData.studentRows}
                        locale={{
                          emptyText: (
                            <Empty
                              description="暂无学生成绩"
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                            />
                          ),
                        }}
                        onRow={(record, index) => ({
                          className: [
                            index !== undefined && index % 2 === 0
                              ? 'class-affairs-course-results-row-even'
                              : 'class-affairs-course-results-row-odd',
                            record.studentNumber === selectedStudentNumber
                              ? 'class-affairs-course-results-row-selected'
                              : null,
                            'class-affairs-course-results-row-clickable',
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
                        scroll={{ x: resolveScrollX(pivotData.courseColumns.length) }}
                        size="small"
                        tableLayout="fixed"
                      />
                    </div>
                  ) : (
                    emptyState
                  )
                ) : null,
                disabled: !term.hasLocalData && term.isCurrent && !term.canPullFromUpstream,
                key: termKey,
                label: (
                  <span className="class-affairs-course-results-term-tab-label">
                    <span
                      className={[
                        'class-affairs-course-results-term-tab-primary',
                        isActive ? 'class-affairs-course-results-term-tab-primary-active' : null,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {formatSchoolYear(term.schoolYear)}
                    </span>
                    <span className="class-affairs-course-results-term-tab-secondary">
                      <span className="class-affairs-course-results-term-tab-secondary-text">
                        {formatSemester(term.semester)}
                      </span>
                      {!term.hasLocalData ? (
                        <span className="class-affairs-course-results-term-tab-badge class-affairs-course-results-term-tab-badge-pending">
                          待同步
                        </span>
                      ) : semesterOrdinal ? (
                        <span className="class-affairs-course-results-term-tab-badge">
                          {semesterOrdinal}
                        </span>
                      ) : null}
                    </span>
                  </span>
                ),
              };
            })}
            size="small"
            tabBarGutter={token.marginXS}
            tabPosition="left"
            onChange={(key) => void handleTermChange(key)}
          />
        ) : (
          <div className="flex min-h-80 items-center justify-center">
            {!hasManagedClasses ? (
              <Empty description="还没有本地负责班级">
                <div className="mb-4 max-w-xl text-sm text-text-secondary">
                  请先在“本地建班”完成班主任身份认定，认定后即可查看成绩汇总。
                </div>
                <Button href={LOCAL_CLASS_SETUP_PATH} type="primary">
                  去本地建班
                </Button>
              </Empty>
            ) : hasOnlyIncompleteClasses ? (
              <Empty description="本地班级数据不完整">
                <div className="max-w-xl text-sm text-text-secondary">
                  当前负责班级缺少 classCode，暂时无法查询成绩，请联系管理员修复班级数据。
                </div>
              </Empty>
            ) : (
              <Empty description="暂无负责班级成绩">
                {selectedClassCode ? (
                  <Button
                    icon={<CloudSyncOutlined />}
                    loading={isLoadingResults}
                    type="primary"
                    onClick={() =>
                      void requestRefresh({
                        canPullFromUpstream: true,
                        disabledReason: null,
                        hasLocalData: false,
                        isCurrent: false,
                        label: '该班成绩',
                        schoolYear: '',
                        semester: '',
                      })
                    }
                  >
                    同步该班成绩
                  </Button>
                ) : null}
              </Empty>
            )}
          </div>
        )}
      </section>

      <UpstreamLoginModal
        description="仅在需要同步缺失成绩时使用；当前学期只同步当前学期，历史学期会同步该班全部成绩。"
        form={loginForm}
        hasRememberedCredentials={hasRememberedCredentials}
        isSubmitting={isSubmittingLogin}
        loginError={loginError}
        okText="授权并同步"
        open={isLoginModalOpen}
        title="需要登录智慧校园"
        onCancel={() => {
          setIsLoginModalOpen(false);
          setPendingRefreshRequest(null);
          setLoginError(null);
        }}
        onClearRememberedCredentials={clearRememberedCredentials}
        onFinish={handleLoginFinish}
      />
    </div>
  );
}
