import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DownloadOutlined,
  EditOutlined,
  FormOutlined,
  HistoryOutlined,
  LaptopOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Collapse,
  Empty,
  Flex,
  Input,
  Modal,
  Popover,
  Radio,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';

import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
  type StoredUpstreamSession,
  UpstreamLoginModal,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import { fillEmptyTeachingPlanRowsFromHistory } from '../application/historical-plan-fill';
import {
  formatTeachingPlanBusinessDate,
  formatTeachingPlanCalcEffect,
  formatTeachingPlanWeekday,
  resolveCourseCategoryPresentation,
  type TeachingPlanCourseProjection,
} from '../application/teaching-plan-projection';
import {
  buildTeachingPlanSheetRows,
  clearTeachingPlanLocationOverrides,
  setTeachingPlanRowLocationOverride,
  type TeachingPlanCourseDraft,
  type TeachingPlanDeliveryMode,
  updateTeachingPlanRowDraft,
} from '../application/teaching-plan-sheet';
import {
  requestCurriculumPlanDetailReferenceCandidates,
  requestUpdateAcademicCourseScheduleClassroomName,
} from '../infrastructure/api';
import {
  buildTeachingPlanDraftStorageKey,
  readTeachingPlanCourseDraft,
  TEACHING_PLAN_DRAFT_TTL_HOURS,
  writeTeachingPlanCourseDraft,
} from '../infrastructure/draft-storage';
import { exportTeachingPlanExcel } from '../infrastructure/teaching-plan-excel-export';
import type {
  CurriculumPlanDetailReferenceCandidate,
  MyTeachingPlanLabLoaderData,
  TeachingPlanOccurrence,
} from '../types';

const DELIVERY_MODE_OPTIONS = [
  { label: '线下', value: 'OFFLINE' },
  { label: '线上', value: 'ONLINE' },
] satisfies readonly { label: string; value: TeachingPlanDeliveryMode }[];

export function TeachingPlanSheet({
  course,
  courseNavigation,
  canManage,
  currentAccount,
  currentAccountId,
  isCompact,
  semesterId,
  semesterName,
  semesterNumber,
  schoolYear,
  targetStaffId,
  teacherName,
  onClassroomNameUpdated,
}: {
  course: TeachingPlanCourseProjection;
  courseNavigation: React.ReactNode;
  canManage: boolean;
  currentAccount: MyTeachingPlanLabLoaderData['currentAccount'];
  currentAccountId: number;
  isCompact: boolean;
  semesterId: number;
  semesterName: string;
  semesterNumber: number;
  schoolYear: string;
  targetStaffId: string;
  teacherName: string;
  onClassroomNameUpdated: (scheduleId: number, classroomName: string) => void;
}) {
  const { message } = AntApp.useApp();
  const storageKey = useMemo(
    () =>
      buildTeachingPlanDraftStorageKey({
        currentAccountId,
        scheduleId: course.scheduleId,
        semesterId,
        targetStaffId,
      }),
    [course.scheduleId, currentAccountId, semesterId, targetStaffId],
  );
  const [draft, setDraft] = useState<TeachingPlanCourseDraft>(() =>
    readTeachingPlanCourseDraft(storageKey),
  );
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingClassroomName, setIsSavingClassroomName] = useState(false);
  const [classroomEditorOpen, setClassroomEditorOpen] = useState(false);
  const [classroomEditorValue, setClassroomEditorValue] = useState(course.classroomName ?? '');
  const [classroomEditorError, setClassroomEditorError] = useState<string | null>(null);
  const [historyCandidates, setHistoryCandidates] = useState<
    CurriculumPlanDetailReferenceCandidate[]
  >([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyWarnings, setHistoryWarnings] = useState<string[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [queuedHistorySession, setQueuedHistorySession] = useState<StoredUpstreamSession | null>(
    null,
  );
  const [selectedHistoryPlanId, setSelectedHistoryPlanId] = useState<string | null>(null);
  const draftRef = useRef(draft);

  useEffect(() => {
    const nextDraft = readTeachingPlanCourseDraft(storageKey);
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }, [storageKey]);

  const rows = useMemo(() => buildTeachingPlanSheetRows(course, draft), [course, draft]);
  const plannedLessons = useMemo(
    () => rows.reduce((total, row) => total + row.teachingHours, 0),
    [rows],
  );

  const applyDraft = (nextDraft: TeachingPlanCourseDraft) => {
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    writeTeachingPlanCourseDraft(storageKey, nextDraft);
  };

  const updateRow = (
    rowKey: string,
    patch: Parameters<typeof updateTeachingPlanRowDraft>[0]['patch'],
  ) => {
    applyDraft(
      updateTeachingPlanRowDraft({
        draft: draftRef.current,
        patch,
        rowKey,
      }),
    );
  };

  const {
    modalProps: upstreamLoginModalProps,
    openLoginModal,
    openLoginModalForExpiredSession,
    persistSessionFromResult,
    session: upstreamSession,
  } = useUpstreamLoginModalController<'load-history'>({
    account: currentAccount,
    keepAlive: true,
    lockedUserId: currentAccount.lockedUpstreamLoginUserId,
    resolveLoginErrorMessage: (error) =>
      resolveUpstreamErrorMessage(error, '校园网登录失败，请检查账号或密码。'),
    onLoginSuccess: ({ pendingAction, session }) => {
      if (pendingAction === 'load-history') {
        setQueuedHistorySession(session);
      }
    },
  });

  const loadHistoryCandidates = useCallback(
    async (activeSession: StoredUpstreamSession) => {
      setIsLoadingHistory(true);
      setHistoryError(null);
      try {
        const result = await requestCurriculumPlanDetailReferenceCandidates({
          courseName: course.courseName,
          mode: canManage ? 'managed' : 'self',
          plannedLessons,
          schoolYear,
          semester: String(semesterNumber),
          staffId: targetStaffId,
          upstreamSessionToken: activeSession.upstreamSessionToken,
        });
        persistSessionFromResult(activeSession, result);
        setHistoryCandidates(result.items);
        setHistoryWarnings(result.warnings);
        setSelectedHistoryPlanId(result.items[0]?.sourcePlanId ?? null);
        setHistoryModalOpen(true);
      } catch (error) {
        if (isExpiredUpstreamSessionError(error)) {
          openLoginModalForExpiredSession({
            loginError: 'upstream 会话已失效，请重新登录后继续。',
            pendingAction: 'load-history',
            session: activeSession,
          });
        } else {
          setHistoryError(
            resolveUpstreamErrorMessage(error, '暂时无法加载历史教学计划，请稍后重试。'),
          );
        }
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [
      canManage,
      course.courseName,
      openLoginModalForExpiredSession,
      persistSessionFromResult,
      plannedLessons,
      schoolYear,
      semesterNumber,
      targetStaffId,
    ],
  );

  useEffect(() => {
    if (!queuedHistorySession) {
      return;
    }
    const session = queuedHistorySession;
    setQueuedHistorySession(null);
    void loadHistoryCandidates(session);
  }, [loadHistoryCandidates, queuedHistorySession]);

  const openHistoryReference = () => {
    if (upstreamSession) {
      void loadHistoryCandidates(upstreamSession);
      return;
    }
    openLoginModal({
      fallbackUserId: targetStaffId,
      pendingAction: 'load-history',
    });
  };

  const applySelectedHistory = () => {
    const reference = historyCandidates.find(
      (candidate) => candidate.sourcePlanId === selectedHistoryPlanId,
    );
    if (!reference) {
      return;
    }
    const result = fillEmptyTeachingPlanRowsFromHistory({
      course,
      draft: draftRef.current,
      reference,
    });
    applyDraft(result.draft);
    setHistoryModalOpen(false);
    if (result.filledCellCount === 0) {
      void message.info('当前课次没有可补充的空白章节或作业');
      return;
    }
    const mismatchNotice =
      result.referenceRowCount === result.targetRowCount
        ? ''
        : `；已按顺序对应前 ${result.mappedRowCount} 行`;
    void message.success(
      `已从历史计划补充 ${result.filledRowCount} 行、${result.filledCellCount} 个单元格${mismatchNotice}`,
    );
  };

  const commitRowLocation = async (rowKey: string, rawLocation: string) => {
    const location = rawLocation.trim();
    if (course.classroomName) {
      applyDraft(
        setTeachingPlanRowLocationOverride({
          draft: draftRef.current,
          locationOverride: location && location !== course.classroomName ? location : undefined,
          rowKey,
        }),
      );
      return;
    }

    if (!location) {
      applyDraft(
        setTeachingPlanRowLocationOverride({
          draft: draftRef.current,
          rowKey,
        }),
      );
      return;
    }
    if (isSavingClassroomName) {
      return;
    }

    setIsSavingClassroomName(true);
    try {
      const saved = await requestUpdateAcademicCourseScheduleClassroomName({
        classroomName: location,
        scheduleId: course.scheduleId,
      });
      applyDraft(
        setTeachingPlanRowLocationOverride({
          draft: draftRef.current,
          rowKey,
        }),
      );
      onClassroomNameUpdated(saved.scheduleId, saved.classroomName);
      void message.success(`已将“${saved.classroomName}”保存为本课程统一授课地点`);
    } catch (error: unknown) {
      applyDraft(
        setTeachingPlanRowLocationOverride({
          draft: draftRef.current,
          locationOverride: location,
          rowKey,
        }),
      );
      void message.error(`${getErrorMessage(error)} 当前输入仍保留在本地草稿中。`);
    } finally {
      setIsSavingClassroomName(false);
    }
  };

  const openClassroomEditor = () => {
    setClassroomEditorValue(course.classroomName ?? '');
    setClassroomEditorError(null);
    setClassroomEditorOpen(true);
  };

  const saveUnifiedClassroomName = async () => {
    const classroomName = classroomEditorValue.trim();
    if (!classroomName) {
      setClassroomEditorError('请输入授课地点');
      return;
    }

    setClassroomEditorError(null);
    setIsSavingClassroomName(true);
    try {
      const saved =
        classroomName === course.classroomName
          ? { classroomName, scheduleId: course.scheduleId }
          : await requestUpdateAcademicCourseScheduleClassroomName({
              classroomName,
              scheduleId: course.scheduleId,
            });
      applyDraft(clearTeachingPlanLocationOverrides(draftRef.current));
      onClassroomNameUpdated(saved.scheduleId, saved.classroomName);
      setClassroomEditorValue(saved.classroomName);
      setClassroomEditorOpen(false);
      void message.success(`已将本课程全部课次统一修改为“${saved.classroomName}”`);
    } catch (error: unknown) {
      setClassroomEditorError(getErrorMessage(error));
    } finally {
      setIsSavingClassroomName(false);
    }
  };

  const handleExport = async () => {
    if (isExporting || rows.length === 0) {
      return;
    }

    setIsExporting(true);
    try {
      await exportTeachingPlanExcel({
        courseName: course.courseName,
        rows,
        teachingClassName: course.teachingClassName,
      });
      void message.success('Excel 已导出；需要长期保留时，请妥善保存该文件');
    } catch {
      void message.error('Excel 导出失败，请稍后重试');
    } finally {
      setIsExporting(false);
    }
  };

  if (resolveCourseCategoryPresentation(course.courseCategory).kind === 'integrated') {
    return (
      <div className="overflow-hidden rounded-[var(--radius-surface)] border border-border bg-bg-container shadow-card">
        <div className="border-b border-border px-4">{courseNavigation}</div>
        <div className="p-4">
          <Alert
            description="当前 A–G 教学计划模板不适用于一体化课程，因此不会生成填写表格或提供本模板的 Excel 导出。"
            showIcon
            title="一体化课程使用另一种教学计划表"
            type="info"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="overflow-hidden rounded-[var(--radius-surface)] border border-border bg-bg-container shadow-card">
        <div className="flex flex-col gap-4 border-b border-border p-4">
          <Flex gap="middle" justify="space-between" vertical={isCompact}>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Tag color="blue">Excel A–G</Tag>
                <Tag icon={<FormOutlined />}>本地草稿</Tag>
              </div>
              <Typography.Text type="secondary">
                每行对应一个真源课次片段；连续四节若已切成两个双节片段，将保持为两行。
              </Typography.Text>
            </div>
            <Space wrap>
              <Button
                disabled={rows.length === 0}
                icon={<HistoryOutlined />}
                loading={isLoadingHistory}
                onClick={openHistoryReference}
              >
                参考历史计划
              </Button>
              <Button
                disabled={rows.length === 0}
                icon={<DownloadOutlined />}
                loading={isExporting}
                type="primary"
                onClick={() => void handleExport()}
              >
                导出 Excel
              </Button>
            </Space>
          </Flex>

          <div>
            <Alert
              description={`统一授课地点会保存到服务器；授课方式和逐课次地点例外只保存在当前浏览器，最后一次编辑 ${TEACHING_PLAN_DRAFT_TTL_HOURS} 小时后自动清除。需要长期保留完整计划时，请以导出的 Excel 文件为准。`}
              showIcon
              title="逐课次内容仍是限时本地草稿，请及时导出"
              type="warning"
            />
          </div>
          {historyError ? <Alert closable showIcon title={historyError} type="error" /> : null}
        </div>

        <div className="border-b border-border px-4">{courseNavigation}</div>

        <div className="overflow-x-auto">
          <table
            aria-label={`${course.courseName}课程教学计划`}
            className="w-full min-w-[1280px] border-separate border-spacing-0 text-sm"
          >
            <colgroup>
              <col className="w-12" />
              <col className="w-40" />
              <col className="w-24" />
              <col className="w-28" />
              <col className="w-32" />
              <col className="w-56" />
              <col className="w-72" />
              <col className="w-56" />
            </colgroup>
            <thead>
              <tr className="bg-bg-layout text-xs text-text-tertiary">
                <th className="border-b border-r border-border px-3 py-2" scope="col">
                  #
                </th>
                {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((letter) => (
                  <th
                    className="border-b border-r border-border px-3 py-2 font-medium last:border-r-0"
                    key={letter}
                    scope="col"
                  >
                    {letter}
                  </th>
                ))}
              </tr>
              <tr className="bg-fill-secondary text-left text-text">
                <th className="border-b border-r border-border px-3 py-3 text-center" scope="col">
                  行
                </th>
                <th className="border-b border-r border-border px-3 py-3" scope="col">
                  授课时间
                </th>
                <th className="border-b border-r border-border px-3 py-3 text-center" scope="col">
                  学时数
                </th>
                <th className="border-b border-r border-border px-3 py-3 text-center" scope="col">
                  节次
                </th>
                <th className="border-b border-r border-border px-3 py-3" scope="col">
                  授课方式
                </th>
                <th className="border-b border-border px-3 py-3" scope="col">
                  <div className="flex items-center justify-between gap-2">
                    <span>授课地点</span>
                    {course.classroomName ? (
                      <Popover
                        content={
                          <div className="flex w-72 flex-col gap-3">
                            <span className="text-sm text-text-secondary">
                              将应用到本课程全部课次并保存到服务器。
                            </span>
                            <Input
                              aria-label="统一授课地点"
                              maxLength={64}
                              showCount
                              value={classroomEditorValue}
                              onChange={(event) => setClassroomEditorValue(event.target.value)}
                              onPressEnter={() => void saveUnifiedClassroomName()}
                            />
                            {classroomEditorError ? (
                              <Typography.Text type="danger">
                                {classroomEditorError}
                              </Typography.Text>
                            ) : null}
                            <div className="flex justify-end gap-2">
                              <Button
                                disabled={isSavingClassroomName}
                                size="small"
                                onClick={() => setClassroomEditorOpen(false)}
                              >
                                取消
                              </Button>
                              <Button
                                loading={isSavingClassroomName}
                                size="small"
                                type="primary"
                                onClick={() => void saveUnifiedClassroomName()}
                              >
                                应用并保存
                              </Button>
                            </div>
                          </div>
                        }
                        open={classroomEditorOpen}
                        placement="bottomRight"
                        title="统一修改授课地点"
                        trigger="click"
                        onOpenChange={(open) => {
                          if (open) {
                            openClassroomEditor();
                          } else if (!isSavingClassroomName) {
                            setClassroomEditorOpen(false);
                          }
                        }}
                      >
                        <Tooltip title="统一修改授课地点">
                          <Button
                            aria-label="统一修改授课地点"
                            icon={<EditOutlined />}
                            loading={isSavingClassroomName}
                            size="small"
                            type="text"
                          />
                        </Tooltip>
                      </Popover>
                    ) : null}
                  </div>
                </th>
                <th className="border-b border-l border-border px-3 py-3" scope="col">
                  授课章节与内容
                </th>
                <th className="border-b border-l border-border px-3 py-3" scope="col">
                  课外作业
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  className="transition-colors duration-150 hover:bg-fill-secondary"
                  key={row.rowKey}
                >
                  <td className="border-b border-r border-border bg-bg-layout px-3 py-3 text-center text-xs text-text-tertiary">
                    {index + 1}
                  </td>
                  <td className="border-b border-r border-border px-3 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-text">{row.teachingDate}</span>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                        <span>{formatTeachingPlanWeekday(row.occurrence.physicalDayOfWeek)}</span>
                        <span>第 {row.occurrence.weekIndex} 周</span>
                        {row.occurrence.calcEffect !== 'NORMAL' ? (
                          <Tag color={row.occurrence.calcEffect === 'MAKEUP' ? 'green' : 'purple'}>
                            {formatTeachingPlanCalcEffect(row.occurrence.calcEffect)}
                          </Tag>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-r border-border px-3 py-3 text-center font-medium text-text">
                    {row.teachingHours}
                  </td>
                  <td className="border-b border-r border-border px-3 py-3 text-center font-medium text-text">
                    {row.periodsText}
                  </td>
                  <td className="border-b border-r border-border px-2 py-2">
                    <Select<TeachingPlanDeliveryMode>
                      aria-label={`${row.teachingDate}第${row.periodsText}节授课方式`}
                      options={DELIVERY_MODE_OPTIONS}
                      size="small"
                      value={row.deliveryMode}
                      variant="borderless"
                      style={{ width: '100%' }}
                      onChange={(deliveryMode) => updateRow(row.rowKey, { deliveryMode })}
                    />
                  </td>
                  <td className="border-b border-border px-2 py-2">
                    <Input
                      aria-label={`${row.teachingDate}第${row.periodsText}节授课地点`}
                      disabled={isSavingClassroomName}
                      maxLength={64}
                      placeholder="填写授课地点"
                      size="small"
                      value={row.location}
                      variant="borderless"
                      onBlur={(event) =>
                        void commitRowLocation(row.rowKey, event.currentTarget.value)
                      }
                      onChange={(event) =>
                        updateRow(row.rowKey, { locationOverride: event.target.value })
                      }
                      onPressEnter={(event) => event.currentTarget.blur()}
                    />
                  </td>
                  <td className="border-b border-l border-border px-2 py-2">
                    <Input.TextArea
                      aria-label={`${row.teachingDate}第${row.periodsText}节授课章节与内容`}
                      autoSize={{ maxRows: 6, minRows: 2 }}
                      maxLength={2000}
                      placeholder="填写授课章节与内容"
                      value={row.chapterAndContent}
                      variant="borderless"
                      onChange={(event) =>
                        updateRow(row.rowKey, { chapterAndContent: event.target.value })
                      }
                    />
                  </td>
                  <td className="border-b border-l border-border px-2 py-2">
                    <Input.TextArea
                      aria-label={`${row.teachingDate}第${row.periodsText}节课外作业`}
                      autoSize={{ maxRows: 6, minRows: 2 }}
                      maxLength={2000}
                      placeholder="填写课外作业"
                      value={row.homework}
                      variant="borderless"
                      onChange={(event) => updateRow(row.rowKey, { homework: event.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className="grid gap-4 border-t border-border bg-bg-layout p-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
        >
          <SheetMeta label="课程" value={course.courseName} />
          <SheetMeta label="教学班" value={course.teachingClassName} />
          <SheetMeta label="教师" value={teacherName} />
          <SheetMeta label="学期" value={semesterName} />
          <SheetMeta label="计划行" value={`${rows.length} 行`} />
        </div>

        <div className="flex items-start gap-2 border-t border-border bg-bg-layout p-3 text-xs text-text-secondary">
          <LaptopOutlined className="mt-0.5" />
          <span>
            每次打开页面都会根据当前真源重新生成 A–C；本地草稿只匹配当前仍存在的课次行。
            F“授课章节与内容”和 G“课外作业”可手工编辑，也可选择历史计划按课次顺序补充空白项。
          </span>
        </div>
      </div>

      {course.adjustmentOccurrences.length ? (
        <Collapse
          ghost={isCompact}
          items={[
            {
              children: (
                <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                  {course.adjustmentOccurrences.map((occurrence) => (
                    <AdjustmentRow
                      key={`${occurrence.date}:${occurrence.slotId}:${occurrence.calcEffect}`}
                      occurrence={occurrence}
                    />
                  ))}
                </Space>
              ),
              key: 'adjustments',
              label: `停课与调出记录（${course.adjustmentOccurrences.length}）`,
            },
          ]}
        />
      ) : null}

      <Modal
        destroyOnHidden
        okButtonProps={{ disabled: selectedHistoryPlanId === null }}
        okText="填充空白项"
        open={historyModalOpen}
        title={`选择“${course.courseName}”的历史教学计划`}
        onCancel={() => setHistoryModalOpen(false)}
        onOk={applySelectedHistory}
      >
        <div className="flex flex-col gap-3">
          <Typography.Text type="secondary">
            候选来自近 6 学期，优先同名且总课时相近的计划。应用时按课次顺序对应，只填当前空白的
            F/G。
          </Typography.Text>
          {historyWarnings.length ? (
            <Alert showIcon title="部分历史计划明细读取失败，已自动忽略" type="warning" />
          ) : null}
          {historyCandidates.length ? (
            <div className="flex flex-col gap-2">
              <Radio.Group
                value={selectedHistoryPlanId}
                onChange={(event) => setSelectedHistoryPlanId(String(event.target.value))}
              >
                {historyCandidates.map((candidate) => (
                  <Radio key={candidate.sourcePlanId} value={candidate.sourcePlanId}>
                    <Space wrap size="small">
                      <Typography.Text strong>
                        {candidate.schoolYear} 学年第 {candidate.semester} 学期
                      </Typography.Text>
                      <Typography.Text>{candidate.courseName ?? '未命名课程'}</Typography.Text>
                      {candidate.teachingClassName ? (
                        <Typography.Text type="secondary">
                          {candidate.teachingClassName}
                        </Typography.Text>
                      ) : null}
                      <Tag color={candidate.recommended ? 'blue' : undefined}>
                        {candidate.items.length} 行
                      </Tag>
                    </Space>
                  </Radio>
                ))}
              </Radio.Group>
            </div>
          ) : (
            <Empty
              description="近 6 学期没有找到可用的同课程历史计划"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </div>
      </Modal>
      <UpstreamLoginModal {...upstreamLoginModalProps} />
    </div>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '暂时无法保存统一授课地点。';
}

function SheetMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-text-tertiary">{label}</span>
      <span className="truncate font-medium text-text" title={value}>
        {value}
      </span>
    </div>
  );
}

function AdjustmentRow({ occurrence }: { occurrence: TeachingPlanOccurrence }) {
  return (
    <Card size="small">
      <Flex gap="small" justify="space-between" wrap>
        <Space wrap size="small">
          <Tag color={occurrence.calcEffect === 'CANCEL' ? 'red' : 'orange'}>
            {formatTeachingPlanCalcEffect(occurrence.calcEffect)}
          </Tag>
          <Typography.Text>
            {formatTeachingPlanBusinessDate(occurrence.date)} ·{' '}
            {formatTeachingPlanWeekday(occurrence.physicalDayOfWeek)}
          </Typography.Text>
          <Typography.Text type="secondary">
            第 {occurrence.periodStart}
            {occurrence.periodEnd === occurrence.periodStart ? '' : `–${occurrence.periodEnd}`} 节
          </Typography.Text>
        </Space>
        {occurrence.classroomName ? (
          <Typography.Text type="secondary">{occurrence.classroomName}</Typography.Text>
        ) : null}
      </Flex>
    </Card>
  );
}
