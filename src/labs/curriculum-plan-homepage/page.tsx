// src/labs/curriculum-plan-homepage/page.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClearOutlined,
  LoginOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Descriptions,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  theme,
  Typography,
} from 'antd';

import {
  buildDepartmentSelectOptions,
  DepartmentFormItem,
  type DepartmentSelectOption,
  ensureDepartmentSelectOption,
  resolveDepartmentDefaultId,
} from '@/entities/department';
import {
  buildUpstreamLoginCredentialsInitialValues,
  canUseRememberedUpstreamLoginCredentials,
  formatUpstreamSessionDateTime,
  type StoredUpstreamSession,
  type UpstreamLoginFormValues,
  UpstreamLoginModal,
  useUpstreamSession,
} from '@/entities/upstream-session';

import {
  type CurrentCurriculumPlanHomepageAccount,
  type CurriculumPlanHomepageDetailResult,
  type CurriculumPlanHomepageListItem,
  type CurriculumPlanHomepageListResult,
  fetchCurrentCurriculumPlanHomepageAccount,
  fetchCurriculumPlanHomepageDepartmentOptions,
  fetchCurriculumPlanHomepageDetail,
  fetchCurriculumPlanHomepageList,
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
  saveCurriculumPlanHomepage,
} from './api';

type SearchFormValues = {
  departmentId?: string | null;
  schoolYear: string;
  semester: string;
};

type PendingAction =
  | {
      type: 'detail';
      item: CurriculumPlanHomepageListItem;
    }
  | {
      type: 'list';
      values: SearchFormValues;
    }
  | {
      homepage: Record<string, unknown>;
      planId: string;
      type: 'save';
    };

type ActionError = {
  message: string;
  target: 'detail' | 'list' | 'save' | 'session';
};

const SEMESTER_OPTIONS = [
  {
    label: '第一学期',
    value: '1',
  },
  {
    label: '第二学期',
    value: '2',
  },
];
const DEFAULT_DEPARTMENT_ID = 'ORG0302';

function getDefaultAcademicTerm(): SearchFormValues {
  const now = new Date();
  const month = now.getMonth() + 1;
  const schoolYear = month >= 8 ? now.getFullYear() : now.getFullYear() - 1;

  return {
    departmentId: DEFAULT_DEPARTMENT_ID,
    schoolYear: String(schoolYear),
    semester: month >= 8 ? '1' : '2',
  };
}

function buildSchoolYearOptions(selectedYear: string) {
  const parsedYear = Number.parseInt(selectedYear, 10);
  const baseYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();

  return Array.from({ length: 6 }, (_, index) => baseYear + 1 - index).map((year) => ({
    label: `${year}-${year + 1}`,
    value: String(year),
  }));
}

function formatCompactValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '未返回';
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  return String(value);
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function resolveReviewStatusTagColor(status: string | null) {
  if (!status) {
    return 'default';
  }

  if (status.includes('通过') || status === 'APPROVED') {
    return 'success';
  }

  if (status.includes('不通过') || status === 'REJECTED') {
    return 'error';
  }

  if (status.includes('审核') || status === 'UNDER_REVIEW') {
    return 'processing';
  }

  if (status.includes('提交') || status === 'PENDING_SUBMIT') {
    return 'warning';
  }

  return 'default';
}

function resolveUpstreamRefreshFailureMessage(error: unknown) {
  if (isExpiredUpstreamSessionError(error)) {
    return 'upstream 会话已失效，请重新登录后继续。';
  }

  return resolveUpstreamErrorMessage(error, 'upstream 会话刷新失败，请重新登录后继续。');
}

function renderJsonBlock(value: unknown, token: ReturnType<typeof theme.useToken>['token']) {
  return (
    <pre
      style={{
        background: token.colorFillTertiary,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusSM,
        color: token.colorText,
        fontSize: token.fontSizeSM,
        lineHeight: 1.6,
        margin: 0,
        maxHeight: 360,
        overflow: 'auto',
        padding: token.paddingSM,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {formatJson(value)}
    </pre>
  );
}

function buildDetailMetadataItems(item: CurriculumPlanHomepageListItem | null) {
  return [
    {
      children: formatCompactValue(item?.planId),
      key: 'planId',
      label: '教学计划 ID',
    },
    {
      children: formatCompactValue(item?.teachingClassId),
      key: 'teachingClassId',
      label: '教学班 ID',
    },
    {
      children: formatCompactValue(item?.courseName),
      key: 'courseName',
      label: '课程',
    },
    {
      children: formatCompactValue(item?.className),
      key: 'className',
      label: '班级',
    },
    {
      children: `${formatCompactValue(item?.schoolYear)} / ${formatCompactValue(item?.semester)}`,
      key: 'term',
      label: '学年学期',
    },
    {
      children: formatCompactValue(item?.weekNumberText ?? item?.weekCount),
      key: 'weeks',
      label: '授课周',
    },
    {
      children: formatCompactValue(item?.weeklyHours),
      key: 'weeklyHours',
      label: '周课时',
    },
    {
      children: (
        <Tag color={resolveReviewStatusTagColor(item?.reviewStatus ?? null)}>
          {formatCompactValue(item?.reviewStatus)}
        </Tag>
      ),
      key: 'reviewStatus',
      label: '审核状态',
    },
  ];
}

function readHomepageValue(
  homepage: Record<string, unknown> | null,
  candidates: readonly string[],
) {
  if (!homepage) {
    return null;
  }

  for (const key of candidates) {
    const value = homepage[key];

    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }

  return null;
}

function readHomepageText(homepage: Record<string, unknown> | null, candidates: readonly string[]) {
  const value = readHomepageValue(homepage, candidates);

  if (value === null) {
    return '';
  }

  return String(value);
}

function readHomepageNumber(
  homepage: Record<string, unknown> | null,
  candidates: readonly string[],
) {
  const value = readHomepageValue(homepage, candidates);

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function buildHomepageDraftFromDetail(result: CurriculumPlanHomepageDetailResult) {
  const homepage =
    result.homepage && typeof result.homepage === 'object' && !Array.isArray(result.homepage)
      ? { ...result.homepage }
      : {};

  if (!homepage.lecture_plan_id) {
    homepage.lecture_plan_id = result.planId;
  }

  return homepage;
}

function renderDraftInput(value: string, onChange: (nextValue: string) => void) {
  return <Input value={value} onChange={(event) => onChange(event.target.value)} />;
}

function renderDraftTextarea(value: string, onChange: (nextValue: string) => void, rows = 3) {
  return (
    <Input.TextArea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
  );
}

function renderDraftNumber(value: number | null, onChange: (nextValue: number | null) => void) {
  return (
    <InputNumber
      controls
      style={{ width: '100%' }}
      value={value}
      onChange={(nextValue) => {
        onChange(typeof nextValue === 'number' && Number.isFinite(nextValue) ? nextValue : null);
      }}
    />
  );
}

function CurriculumPlanHomepageFormPreview({
  homepage,
  isSaving,
  onSave,
  onUpdateField,
  token,
}: {
  homepage: Record<string, unknown>;
  isSaving: boolean;
  onSave: () => void;
  onUpdateField: (field: string, value: number | string | null) => void;
  token: ReturnType<typeof theme.useToken>['token'];
}) {
  const tableStyle = {
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    width: '100%',
  } as const;
  const cellStyle = {
    border: `1px solid ${token.colorBorder}`,
    padding: token.paddingXS,
    verticalAlign: 'middle',
  } as const;
  const labelCellStyle = {
    ...cellStyle,
    background: token.colorFillQuaternary,
    color: token.colorText,
    textAlign: 'center',
    width: 230,
  } as const;
  const headerCellStyle = {
    ...labelCellStyle,
    width: undefined,
  } as const;
  const fieldsetStyle = {
    border: `1px solid ${token.colorBorder}`,
    margin: 0,
    padding: `${token.paddingSM}px ${token.padding}px ${token.padding}px`,
  } as const;
  const legendStyle = {
    color: token.colorText,
    fontWeight: token.fontWeightStrong,
    padding: `0 ${token.paddingXXS}px`,
  } as const;

  return (
    <Space orientation="vertical" size={token.margin} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" gap={token.margin}>
        <span style={{ width: 88 }} />
        <Typography.Title level={3} style={{ margin: 0, textAlign: 'center' }}>
          授课计划首页信息
        </Typography.Title>
        <Button icon={<SaveOutlined />} loading={isSaving} type="primary" onClick={onSave}>
          保存
        </Button>
      </Flex>

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>基本信息</legend>
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={labelCellStyle}>教材名称及版本</td>
              <td style={cellStyle}>
                {renderDraftInput(
                  readHomepageText(homepage, ['textbook_name', 'textbookName']),
                  (value) => onUpdateField('textbook_name', value),
                )}
              </td>
            </tr>
            <tr>
              <td style={labelCellStyle}>教学目的要求</td>
              <td style={cellStyle}>
                {renderDraftTextarea(
                  readHomepageText(homepage, ['teaching_objectives', 'teachingObjectives']),
                  (value) => onUpdateField('teaching_objectives', value),
                )}
              </td>
            </tr>
            <tr>
              <td style={labelCellStyle}>改进教学的具体措施</td>
              <td style={cellStyle}>
                {renderDraftTextarea(
                  readHomepageText(homepage, [
                    'teaching_improvement_measures',
                    'improve_teaching_measures',
                    'teaching_measures',
                    'improvement_measures',
                    'teachingMethods',
                  ]),
                  (value) => onUpdateField('teaching_improvement_measures', value),
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </fieldset>

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>课时分配</legend>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th rowSpan={2} style={headerCellStyle}>
                授课周数
              </th>
              <th rowSpan={2} style={headerCellStyle}>
                周课时
              </th>
              <th rowSpan={2} style={headerCellStyle}>
                授课总课时
              </th>
              <th colSpan={4} style={headerCellStyle}>
                分配
              </th>
            </tr>
            <tr>
              <th style={headerCellStyle}>讲课</th>
              <th style={headerCellStyle}>实训</th>
              <th style={headerCellStyle}>复习考试</th>
              <th style={headerCellStyle}>机动</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={cellStyle}>
                {renderDraftNumber(readHomepageNumber(homepage, ['teaching_weeks']), (value) =>
                  onUpdateField('teaching_weeks', value),
                )}
              </td>
              <td style={cellStyle}>
                {renderDraftNumber(readHomepageNumber(homepage, ['weekly_lessons']), (value) =>
                  onUpdateField('weekly_lessons', value),
                )}
              </td>
              <td style={cellStyle}>
                {renderDraftNumber(readHomepageNumber(homepage, ['total_lessons']), (value) =>
                  onUpdateField('total_lessons', value),
                )}
              </td>
              <td style={cellStyle}>
                {renderDraftNumber(readHomepageNumber(homepage, ['lecture_lessons']), (value) =>
                  onUpdateField('lecture_lessons', value),
                )}
              </td>
              <td style={cellStyle}>
                {renderDraftNumber(readHomepageNumber(homepage, ['training_lessons']), (value) =>
                  onUpdateField('training_lessons', value),
                )}
              </td>
              <td style={cellStyle}>
                {renderDraftNumber(readHomepageNumber(homepage, ['review_exam_lessons']), (value) =>
                  onUpdateField('review_exam_lessons', value),
                )}
              </td>
              <td style={cellStyle}>
                {renderDraftNumber(readHomepageNumber(homepage, ['flexible_lessons']), (value) =>
                  onUpdateField('flexible_lessons', value),
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </fieldset>

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>期末完成情况</legend>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th rowSpan={2} style={headerCellStyle}>
                计划课时
              </th>
              <th rowSpan={2} style={headerCellStyle}>
                完成课时
              </th>
              <th colSpan={3} style={headerCellStyle}>
                超出或减少课时
              </th>
            </tr>
            <tr>
              <th style={headerCellStyle}>超出</th>
              <th style={headerCellStyle}>减少</th>
              <th style={headerCellStyle}>弥补</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={cellStyle}>
                {renderDraftNumber(
                  readHomepageNumber(homepage, ['planned_lessons', 'plan_lessons']),
                  (value) => onUpdateField('planned_lessons', value),
                )}
              </td>
              <td style={cellStyle}>
                {renderDraftNumber(
                  readHomepageNumber(homepage, ['completed_lessons', 'finished_lessons']),
                  (value) => onUpdateField('completed_lessons', value),
                )}
              </td>
              <td style={cellStyle}>
                {renderDraftNumber(
                  readHomepageNumber(homepage, ['exceeded_lessons', 'exceed_lessons']),
                  (value) => onUpdateField('exceeded_lessons', value),
                )}
              </td>
              <td style={cellStyle}>
                {renderDraftNumber(
                  readHomepageNumber(homepage, ['reduced_lessons', 'reduce_lessons']),
                  (value) => onUpdateField('reduced_lessons', value),
                )}
              </td>
              <td style={cellStyle}>
                {renderDraftNumber(
                  readHomepageNumber(homepage, ['makeup_lessons', 'make_up_lessons']),
                  (value) => onUpdateField('makeup_lessons', value),
                )}
              </td>
            </tr>
            <tr>
              <td style={labelCellStyle}>教学截止章节内容</td>
              <td colSpan={4} style={cellStyle}>
                {renderDraftTextarea(
                  readHomepageText(homepage, [
                    'teaching_end_chapter_content',
                    'teachingEndChapterContent',
                  ]),
                  (value) => onUpdateField('teaching_end_chapter_content', value),
                  3,
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </fieldset>
    </Space>
  );
}

export function CurriculumPlanHomepageLabPage() {
  const { token } = theme.useToken();
  const defaultSearchValues = useMemo(() => getDefaultAcademicTerm(), []);
  const schoolYearOptions = useMemo(
    () => buildSchoolYearOptions(defaultSearchValues.schoolYear),
    [defaultSearchValues.schoolYear],
  );
  const [loginForm] = Form.useForm<UpstreamLoginFormValues>();
  const [searchForm] = Form.useForm<SearchFormValues>();
  const [currentAccount, setCurrentAccount] = useState<CurrentCurriculumPlanHomepageAccount | null>(
    null,
  );
  const [isLoadingCurrentAccount, setIsLoadingCurrentAccount] = useState(true);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isRefreshingSession, setIsRefreshingSession] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSavingHomepage, setIsSavingHomepage] = useState(false);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentSelectOption[]>([]);
  const [departmentOptionsError, setDepartmentOptionsError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [listResult, setListResult] = useState<CurriculumPlanHomepageListResult | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [detailResult, setDetailResult] = useState<CurriculumPlanHomepageDetailResult | null>(null);
  const [homepageDrafts, setHomepageDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const isAdminAccount = currentAccount?.accessGroup.includes('ADMIN') === true;
  const lockedUpstreamLoginUserId =
    !isAdminAccount && currentAccount?.staffId ? currentAccount.staffId : null;
  const {
    clear,
    clearRememberedCredentials,
    keepAliveFailure,
    login: loginUpstream,
    persistSessionFromResult,
    rememberedCredentials,
    refreshSession,
    session: storedSession,
  } = useUpstreamSession({
    account: currentAccount,
    keepAlive: true,
  });
  const canUseRememberedCredentials = canUseRememberedUpstreamLoginCredentials({
    lockedUserId: lockedUpstreamLoginUserId,
    rememberedCredentials,
  });
  const clearResults = useCallback(() => {
    setListResult(null);
    setSelectedPlanId(null);
    setDetailResult(null);
    setHomepageDrafts({});
    setSaveSuccessMessage(null);
  }, []);

  const clearCurrentSession = useCallback(
    (error?: ActionError) => {
      clear();
      clearResults();
      setActionError(error ?? null);
    },
    [clear, clearResults],
  );

  const openLoginModal = useCallback(
    (input?: {
      action?: PendingAction;
      fallbackUserId?: string | null;
      message?: string | null;
    }) => {
      setPendingAction(input?.action ?? null);
      setLoginError(input?.message ?? null);
      loginForm.setFieldsValue(
        buildUpstreamLoginCredentialsInitialValues({
          fallbackUserId: input?.fallbackUserId ?? storedSession?.upstreamLoginId,
          lockedUserId: lockedUpstreamLoginUserId,
          rememberedCredentials,
        }),
      );
      setIsLoginModalOpen(true);
    },
    [lockedUpstreamLoginUserId, loginForm, rememberedCredentials, storedSession?.upstreamLoginId],
  );

  const promptUpstreamLogin = useCallback(
    (input: { action?: PendingAction; message: string; session: StoredUpstreamSession }) => {
      clearCurrentSession();
      openLoginModal({
        action: input.action,
        fallbackUserId: input.session.upstreamLoginId,
        message: input.message,
      });
    },
    [clearCurrentSession, openLoginModal],
  );

  const performAction = useCallback(
    async (session: StoredUpstreamSession, action: PendingAction) => {
      const runActionWithSession = async (currentSession: StoredUpstreamSession) => {
        if (action.type === 'list') {
          setIsLoadingList(true);
          setDetailResult(null);
          setSelectedPlanId(null);
          setHomepageDrafts({});
          setSaveSuccessMessage(null);

          const result = await fetchCurriculumPlanHomepageList({
            ...action.values,
            sessionToken: currentSession.upstreamSessionToken,
          });

          persistSessionFromResult(currentSession, result);
          setListResult(result);
          return;
        }

        if (action.type === 'save') {
          setIsSavingHomepage(true);
          setSaveSuccessMessage(null);

          const result = await saveCurriculumPlanHomepage({
            homepage: action.homepage,
            sessionToken: currentSession.upstreamSessionToken,
          });

          persistSessionFromResult(currentSession, result);

          if (!result.success) {
            throw new Error(result.msg?.trim() || result.code || '授课计划首页保存失败。');
          }

          setSaveSuccessMessage(result.msg?.trim() || '授课计划首页已保存。');
          return;
        }

        setIsLoadingDetail(true);
        setSaveSuccessMessage(null);
        setSelectedPlanId(action.item.planId);

        const result = await fetchCurriculumPlanHomepageDetail({
          planId: action.item.planId,
          sessionToken: currentSession.upstreamSessionToken,
        });

        persistSessionFromResult(currentSession, result);
        setDetailResult(result);
        setHomepageDrafts((current) => ({
          ...current,
          [result.planId]: buildHomepageDraftFromDetail(result),
        }));
      };

      const handleActionError = (error: unknown) => {
        if (action.type === 'list') {
          clearResults();
          setActionError({
            message: resolveUpstreamErrorMessage(error, '暂时无法读取授课计划首页列表。'),
            target: 'list',
          });
          return;
        }

        if (action.type === 'save') {
          setActionError({
            message: resolveUpstreamErrorMessage(error, '暂时无法保存授课计划首页。'),
            target: 'save',
          });
          return;
        }

        setDetailResult(null);
        setSelectedPlanId(action.item.planId);
        setActionError({
          message: resolveUpstreamErrorMessage(error, '暂时无法读取授课计划首页详情。'),
          target: 'detail',
        });
      };

      setActionError(null);

      try {
        await runActionWithSession(session);
      } catch (error) {
        if (isExpiredUpstreamSessionError(error)) {
          let refreshedSession: StoredUpstreamSession;

          try {
            refreshedSession = await refreshSession(session);
          } catch (refreshError) {
            promptUpstreamLogin({
              action,
              message: resolveUpstreamRefreshFailureMessage(refreshError),
              session,
            });
            return;
          }

          try {
            await runActionWithSession(refreshedSession);
            return;
          } catch (retryError) {
            if (isExpiredUpstreamSessionError(retryError)) {
              promptUpstreamLogin({
                action,
                message: 'upstream 会话已失效，请重新登录后继续。',
                session: refreshedSession,
              });
              return;
            }

            handleActionError(retryError);
            return;
          }
        }

        handleActionError(error);
      } finally {
        setIsLoadingList(false);
        setIsLoadingDetail(false);
        setIsSavingHomepage(false);
      }
    },
    [clearResults, persistSessionFromResult, promptUpstreamLogin, refreshSession],
  );

  const ensureSessionAndRun = useCallback(
    async (action: PendingAction) => {
      setActionError(null);
      setLoginError(null);

      if (!storedSession) {
        openLoginModal({
          action,
        });
        return;
      }

      await performAction(storedSession, action);
    },
    [openLoginModal, performAction, storedSession],
  );

  const handleSelectPlan = useCallback(
    async (item: CurriculumPlanHomepageListItem) => {
      if (!item.planId.trim()) {
        setActionError({
          message: '当前记录缺少教学计划 ID，无法读取首页详情。',
          target: 'detail',
        });
        return;
      }

      await ensureSessionAndRun({
        item,
        type: 'detail',
      });
    },
    [ensureSessionAndRun],
  );

  const updateHomepageDraftField = useCallback(
    (planId: string, field: string, value: number | string | null) => {
      setHomepageDrafts((current) => ({
        ...current,
        [planId]: {
          ...(current[planId] ?? {}),
          [field]: value,
        },
      }));
      setSaveSuccessMessage(null);
    },
    [],
  );

  const handleSaveHomepage = useCallback(
    async (planId: string) => {
      const draft = homepageDrafts[planId];

      if (!draft) {
        setActionError({
          message: '当前首页详情尚未加载完成，暂时无法保存。',
          target: 'save',
        });
        return;
      }

      await ensureSessionAndRun({
        homepage: draft,
        planId,
        type: 'save',
      });
    },
    [ensureSessionAndRun, homepageDrafts],
  );

  const planTabItems = useMemo(
    () =>
      (listResult?.items ?? []).map((item) => {
        const isActiveItem = selectedPlanId === item.planId;
        const matchedDetail = detailResult?.planId === item.planId ? detailResult : null;
        const draft = homepageDrafts[item.planId];

        return {
          children: (
            <div style={{ minHeight: 480, paddingLeft: token.paddingLG }}>
              {isLoadingDetail && isActiveItem ? (
                <Flex align="center" justify="center" style={{ minHeight: 320 }}>
                  <Spin />
                </Flex>
              ) : (
                <Space orientation="vertical" size={token.margin} style={{ width: '100%' }}>
                  {matchedDetail && draft ? (
                    <CurriculumPlanHomepageFormPreview
                      key={matchedDetail.planId}
                      homepage={draft}
                      isSaving={isSavingHomepage && isActiveItem}
                      onSave={() => {
                        void handleSaveHomepage(item.planId);
                      }}
                      onUpdateField={(field, value) => {
                        updateHomepageDraftField(item.planId, field, value);
                      }}
                      token={token}
                    />
                  ) : (
                    <Empty description="暂未读取详情" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}

                  <Collapse
                    items={[
                      {
                        children: (
                          <Descriptions
                            bordered
                            column={1}
                            items={buildDetailMetadataItems(item)}
                            size="small"
                          />
                        ),
                        key: 'summary',
                        label: '列表摘要',
                      },
                      {
                        children: renderJsonBlock(draft ?? matchedDetail?.homepage ?? {}, token),
                        key: 'homepage',
                        label: '当前 homepage 草稿',
                      },
                      {
                        children: renderJsonBlock(item.rawPlan ?? {}, token),
                        key: 'rawPlan',
                        label: '列表 rawPlan',
                      },
                    ]}
                    size="small"
                  />
                </Space>
              )}
            </div>
          ),
          key: item.planId,
          label: (
            <div style={{ maxWidth: 240 }}>
              <div
                style={{
                  fontWeight: isActiveItem ? token.fontWeightStrong : token.fontWeight,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.courseName || '未命名课程'}
              </div>
              <Typography.Text
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                type="secondary"
              >
                {item.className || '未返回班级'}
              </Typography.Text>
            </div>
          ),
        };
      }),
    [
      detailResult,
      handleSaveHomepage,
      homepageDrafts,
      isLoadingDetail,
      isSavingHomepage,
      listResult?.items,
      selectedPlanId,
      token,
      updateHomepageDraftField,
    ],
  );

  useEffect(() => {
    let isCancelled = false;

    async function bootstrapPage() {
      setIsLoadingCurrentAccount(true);
      setPageError(null);
      setActionError(null);
      clearResults();

      try {
        const nextAccount = await fetchCurrentCurriculumPlanHomepageAccount();

        if (isCancelled) {
          return;
        }

        setCurrentAccount(nextAccount);
        setIsLoadingCurrentAccount(false);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setCurrentAccount(null);
        setPageError(resolveUpstreamErrorMessage(error, '暂时无法确认当前登录账号。'));
        setIsLoadingCurrentAccount(false);
      }
    }

    void bootstrapPage();

    return () => {
      isCancelled = true;
    };
  }, [clearResults]);

  useEffect(() => {
    let isCancelled = false;

    async function loadDepartmentOptions() {
      setIsLoadingDepartments(true);
      setDepartmentOptionsError(null);

      try {
        const departments = await fetchCurriculumPlanHomepageDepartmentOptions();
        const nextOptions = ensureDepartmentSelectOption(
          buildDepartmentSelectOptions(departments),
          {
            id: DEFAULT_DEPARTMENT_ID,
          },
        );

        if (isCancelled) {
          return;
        }

        setDepartmentOptions(nextOptions);
        searchForm.setFieldsValue({
          departmentId: resolveDepartmentDefaultId({
            currentDepartmentId: searchForm.getFieldValue('departmentId') as string | undefined,
            defaultDepartmentId: DEFAULT_DEPARTMENT_ID,
            options: nextOptions,
          }),
        });
      } catch (error) {
        const fallbackOptions = ensureDepartmentSelectOption([], {
          id: DEFAULT_DEPARTMENT_ID,
        });

        if (isCancelled) {
          return;
        }

        setDepartmentOptions(fallbackOptions);
        setDepartmentOptionsError(
          error instanceof Error ? error.message : '暂时无法加载可选系部。',
        );
        searchForm.setFieldsValue({
          departmentId: resolveDepartmentDefaultId({
            currentDepartmentId: searchForm.getFieldValue('departmentId') as string | undefined,
            defaultDepartmentId: DEFAULT_DEPARTMENT_ID,
            options: fallbackOptions,
          }),
        });
      } finally {
        if (!isCancelled) {
          setIsLoadingDepartments(false);
        }
      }
    }

    void loadDepartmentOptions();

    return () => {
      isCancelled = true;
    };
  }, [searchForm]);

  useEffect(() => {
    if (!keepAliveFailure) {
      return;
    }

    clearCurrentSession({
      message: keepAliveFailure.message,
      target: 'session',
    });
    openLoginModal({
      fallbackUserId: keepAliveFailure.upstreamLoginId,
      message: keepAliveFailure.message,
    });
  }, [clearCurrentSession, keepAliveFailure, openLoginModal]);

  useEffect(() => {
    if (
      !listResult?.items.length ||
      !storedSession ||
      isLoadingList ||
      isLoadingDetail ||
      isLoginModalOpen
    ) {
      return;
    }

    const activeItem =
      listResult.items.find((item) => item.planId === selectedPlanId) ?? listResult.items[0];

    if (!activeItem) {
      return;
    }

    if (detailResult?.planId === activeItem.planId && selectedPlanId === activeItem.planId) {
      return;
    }

    if (selectedPlanId !== activeItem.planId) {
      setSelectedPlanId(activeItem.planId);
    }

    void handleSelectPlan(activeItem);
  }, [
    detailResult?.planId,
    handleSelectPlan,
    isLoadingDetail,
    isLoadingList,
    isLoginModalOpen,
    listResult?.items,
    selectedPlanId,
    storedSession,
  ]);

  async function handleFetchList(values: SearchFormValues) {
    await ensureSessionAndRun({
      type: 'list',
      values,
    });
  }

  async function handleLogin(values: UpstreamLoginFormValues) {
    setIsSubmittingLogin(true);
    setLoginError(null);

    try {
      const nextSession = await loginUpstream(values);
      const action = pendingAction;

      setPendingAction(null);
      setIsLoginModalOpen(false);

      if (action) {
        await performAction(nextSession, action);
      }
    } catch (error) {
      setLoginError(resolveUpstreamErrorMessage(error, 'upstream 登录失败，请检查账号或密码。'));
    } finally {
      setIsSubmittingLogin(false);
    }
  }

  async function handleRefreshSession() {
    if (!storedSession) {
      openLoginModal();
      return;
    }

    setIsRefreshingSession(true);
    setActionError(null);

    try {
      await refreshSession(storedSession);
    } catch (error) {
      setActionError({
        message: resolveUpstreamRefreshFailureMessage(error),
        target: 'session',
      });
      openLoginModal({
        fallbackUserId: storedSession.upstreamLoginId,
        message: resolveUpstreamRefreshFailureMessage(error),
      });
    } finally {
      setIsRefreshingSession(false);
    }
  }

  function handleClearSession() {
    clearCurrentSession();
    setLoginError(null);
    setPendingAction(null);
  }

  const sessionSummary = storedSession
    ? `${storedSession.upstreamLoginId || '未记录账号'} · ${formatUpstreamSessionDateTime(
        storedSession.expiresAt,
      )}`
    : '未登录 upstream';

  return (
    <div style={{ display: 'grid', gap: token.marginLG }}>
      <Flex align="flex-start" justify="space-between" wrap="wrap" gap={token.margin}>
        <div>
          <Typography.Title level={2} style={{ marginBottom: token.marginXS }}>
            授课计划首页
          </Typography.Title>
          <Typography.Text type="secondary">
            {currentAccount
              ? `${currentAccount.displayName} · ${currentAccount.accessGroup.join(', ')}`
              : '正在确认当前账号'}
          </Typography.Text>
        </div>
        <Tag color="blue">Lab</Tag>
      </Flex>

      {pageError ? <Alert showIcon message={pageError} type="error" /> : null}
      {actionError ? <Alert showIcon message={actionError.message} type="warning" /> : null}
      {saveSuccessMessage ? <Alert showIcon message={saveSuccessMessage} type="success" /> : null}

      <Card>
        <Flex align="center" justify="space-between" wrap="wrap" gap={token.margin}>
          <Space orientation="vertical" size={2}>
            <Typography.Text strong>Upstream 会话</Typography.Text>
            <Typography.Text type="secondary">{sessionSummary}</Typography.Text>
          </Space>
          <Space wrap>
            <Button
              icon={<LoginOutlined />}
              loading={isLoadingCurrentAccount}
              onClick={() => {
                openLoginModal();
              }}
            >
              登录 upstream
            </Button>
            <Button
              disabled={!storedSession}
              icon={<ReloadOutlined />}
              loading={isRefreshingSession}
              onClick={() => {
                void handleRefreshSession();
              }}
            >
              刷新会话
            </Button>
            <Button
              disabled={!storedSession && !listResult}
              icon={<ClearOutlined />}
              onClick={handleClearSession}
            >
              清除
            </Button>
          </Space>
        </Flex>
      </Card>

      <Card>
        <Form<SearchFormValues>
          form={searchForm}
          initialValues={defaultSearchValues}
          layout="inline"
          requiredMark={false}
          style={{ rowGap: token.marginSM }}
          onFinish={(values) => {
            void handleFetchList(values);
          }}
        >
          <Form.Item
            label="学年"
            name="schoolYear"
            rules={[{ required: true, message: '请选择学年' }]}
          >
            <Select options={schoolYearOptions} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item
            label="学期"
            name="semester"
            rules={[{ required: true, message: '请选择学期' }]}
          >
            <Select options={SEMESTER_OPTIONS} style={{ width: 120 }} />
          </Form.Item>
          <DepartmentFormItem
            label="系部"
            loading={isLoadingDepartments}
            options={departmentOptions}
            required
            selectProps={{
              style: { width: 220 },
            }}
            validateStatus={departmentOptionsError ? 'warning' : undefined}
          />
          <Form.Item>
            <Button
              disabled={isLoadingCurrentAccount || isLoadingDepartments || Boolean(pageError)}
              htmlType="submit"
              icon={<SearchOutlined />}
              loading={isLoadingList}
              type="primary"
            >
              读取计划列表
            </Button>
          </Form.Item>
        </Form>
        {departmentOptionsError ? (
          <Alert showIcon message={departmentOptionsError} type="warning" />
        ) : null}
      </Card>

      {listResult?.items?.length ? (
        <Tabs
          activeKey={selectedPlanId ?? listResult.items[0]?.planId}
          items={planTabItems}
          tabPosition="left"
          onChange={(nextPlanId) => {
            const nextItem = listResult.items.find((item) => item.planId === nextPlanId);

            if (!nextItem) {
              return;
            }

            void handleSelectPlan(nextItem);
          }}
        />
      ) : (
        <Flex
          align="center"
          justify="center"
          style={{
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
            minHeight: 320,
          }}
        >
          <Empty description={isLoadingList ? '正在读取' : '暂无授课计划'} />
        </Flex>
      )}

      <UpstreamLoginModal
        form={loginForm}
        hasRememberedCredentials={canUseRememberedCredentials}
        isSubmitting={isSubmittingLogin}
        lockedUserId={lockedUpstreamLoginUserId}
        loginError={loginError}
        open={isLoginModalOpen}
        title="登录智慧校园"
        onCancel={() => {
          setIsLoginModalOpen(false);
          setPendingAction(null);
          setLoginError(null);
        }}
        onClearRememberedCredentials={clearRememberedCredentials}
        onFinish={(values) => {
          void handleLogin(values);
        }}
      />
    </div>
  );
}
