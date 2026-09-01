// src/features/academic-teaching-plan/ui/teaching-plan-sheet.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightOutlined,
  DeleteOutlined,
  DownloadOutlined,
  DragOutlined,
  EditOutlined,
  HistoryOutlined,
  LaptopOutlined,
  PlusOutlined,
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

import { replaceTeachingPlanContentRowsFromHistory } from '../application/historical-plan-fill';
import {
  formatTeachingPlanBusinessDate,
  formatTeachingPlanCalcEffect,
  formatTeachingPlanWeekday,
  resolveCourseCategoryPresentation,
  type TeachingPlanCourseProjection,
} from '../application/teaching-plan-projection';
import {
  appendTeachingPlanContentRow,
  buildTeachingPlanDisplayRows,
  buildTeachingPlanFormalRows,
  clearTeachingPlanLocationOverrides,
  deleteTeachingPlanContentRow,
  ensureTeachingPlanContentRowAtIndex,
  insertTeachingPlanContentRow,
  moveTeachingPlanContentRow,
  moveTeachingPlanContentRowToEmptySlot,
  setTeachingPlanRowLocationOverride,
  type TeachingPlanContentRowDraft,
  type TeachingPlanCourseDraft,
  type TeachingPlanDeliveryMode,
  updateTeachingPlanContentRow,
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
  AcademicTeachingPlanPageLoaderData,
  CurriculumPlanDetailReferenceCandidate,
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
  currentAccount: AcademicTeachingPlanPageLoaderData['currentAccount'];
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
  const { message, modal, notification } = AntApp.useApp();
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
    readTeachingPlanCourseDraft(storageKey, course.effectiveOccurrenceCount),
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
  const [draggedContentRowId, setDraggedContentRowId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    index: number;
    position: 'after' | 'at' | 'before';
  } | null>(null);
  const draftRef = useRef(draft);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const nextDraft = readTeachingPlanCourseDraft(storageKey, course.effectiveOccurrenceCount);
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }, [course.effectiveOccurrenceCount, storageKey]);

  useEffect(
    () => () => {
      dragPreviewRef.current?.remove();
    },
    [],
  );

  const formalRows = useMemo(() => buildTeachingPlanFormalRows(course, draft), [course, draft]);
  const displayRows = useMemo(
    () => buildTeachingPlanDisplayRows({ contentRows: draft.contentRows, formalRows }),
    [draft.contentRows, formalRows],
  );
  const contentRowCount = useMemo(
    () => draft.contentRows.filter((contentRow) => contentRow !== null).length,
    [draft.contentRows],
  );
  const canExport =
    formalRows.length > 0 &&
    draft.contentRows.length === formalRows.length &&
    contentRowCount === formalRows.length;
  const plannedLessons = useMemo(
    () => formalRows.reduce((total, row) => total + row.teachingHours, 0),
    [formalRows],
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

  const updateContentRowAtIndex = (
    index: number,
    patch: Parameters<typeof updateTeachingPlanContentRow>[0]['patch'],
  ) => {
    const ensuredDraft = ensureTeachingPlanContentRowAtIndex({
      draft: draftRef.current,
      index,
    });
    const contentRow = ensuredDraft.contentRows[index];
    if (!contentRow) {
      return;
    }
    applyDraft(
      updateTeachingPlanContentRow({
        contentRowId: contentRow.id,
        draft: ensuredDraft,
        patch,
      }),
    );
  };

  const ensureContentRowAtIndex = (index: number) => {
    const nextDraft = ensureTeachingPlanContentRowAtIndex({
      draft: draftRef.current,
      index,
    });
    if (nextDraft !== draftRef.current) {
      applyDraft(nextDraft);
    }
  };

  const appendContentRow = () => {
    applyDraft(appendTeachingPlanContentRow(draftRef.current));
  };

  const removeContentRow = (contentRow: TeachingPlanContentRowDraft, index: number) => {
    applyDraft(
      deleteTeachingPlanContentRow({
        contentRowId: contentRow.id,
        draft: draftRef.current,
      }),
    );
    const notificationKey = `teaching-plan-content-row:${contentRow.id}`;
    notification.open({
      actions: (
        <Button
          size="small"
          type="link"
          onClick={() => {
            applyDraft(
              insertTeachingPlanContentRow({
                contentRow,
                draft: draftRef.current,
                index,
              }),
            );
            notification.destroy(notificationKey);
          }}
        >
          撤销
        </Button>
      ),
      duration: 5,
      key: notificationKey,
      title: `已删除第 ${index + 1} 行章节与作业`,
    });
  };

  const clearDragState = () => {
    dragPreviewRef.current?.remove();
    dragPreviewRef.current = null;
    setDraggedContentRowId(null);
    setDropTarget(null);
  };

  const handleContentRowDrop = (targetIndex: number, position: 'after' | 'at' | 'before') => {
    if (!draggedContentRowId) {
      return;
    }
    const fromIndex = draftRef.current.contentRows.findIndex(
      (contentRow) => contentRow?.id === draggedContentRowId,
    );
    if (fromIndex < 0) {
      clearDragState();
      return;
    }

    if (position === 'at') {
      applyDraft(
        moveTeachingPlanContentRowToEmptySlot({
          draft: draftRef.current,
          fromIndex,
          toIndex: targetIndex,
        }),
      );
      clearDragState();
      return;
    }

    let toIndex = targetIndex + (position === 'after' ? 1 : 0);
    if (fromIndex < toIndex) {
      toIndex -= 1;
    }
    toIndex = Math.min(Math.max(toIndex, 0), draftRef.current.contentRows.length - 1);
    applyDraft(
      moveTeachingPlanContentRow({
        draft: draftRef.current,
        fromIndex,
        toIndex,
      }),
    );
    clearDragState();
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
            resolveUpstreamErrorMessage(error, '暂时无法加载历史授课计划，请稍后重试。'),
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
    modal.confirm({
      cancelText: '取消',
      content: (
        <div className="flex flex-col gap-2">
          <Typography.Text>
            当前有 {draftRef.current.contentRows.filter((row) => row !== null).length}{' '}
            行章节与作业，历史计划有 {reference.items.length} 行。
          </Typography.Text>
          <Typography.Text type="secondary">
            确认后会整组替换当前 F/G 内容、行序和行数，现有手工编辑将被覆盖。
          </Typography.Text>
        </div>
      ),
      okButtonProps: { danger: true },
      okText: '确认替换',
      title: '替换当前章节与作业？',
      onOk: () => {
        const result = replaceTeachingPlanContentRowsFromHistory({
          draft: draftRef.current,
          reference,
        });
        applyDraft(result.draft);
        setHistoryModalOpen(false);
        void message.success(
          `已用历史计划将章节与作业从 ${result.previousRowCount} 行替换为 ${result.referenceRowCount} 行`,
        );
      },
    });
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
    if (isExporting) {
      return;
    }
    if (!canExport) {
      void message.warning(
        `内容行数（${draftRef.current.contentRows.filter((row) => row !== null).length}）必须与正式课次数（${formalRows.length}）一致且不能留有空位，才能导出`,
      );
      return;
    }

    setIsExporting(true);
    try {
      await exportTeachingPlanExcel({
        contentRows: draftRef.current.contentRows,
        courseName: course.courseName,
        formalRows,
        teachingClassName: course.teachingClassName,
      });
      void message.success('Excel 已导出；需要长期保留时，请妥善保存该文件');
    } catch (error: unknown) {
      void message.error(error instanceof Error ? error.message : 'Excel 导出失败，请稍后重试');
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
            description="当前 A–G 授课计划模板不适用于一体化课程，因此不会生成填写表格或提供本模板的 Excel 导出。"
            showIcon
            title="一体化课程使用另一种授课计划表"
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
          <div>
            <Alert
              description={`统一授课地点会保存到服务器；授课方式和逐课次地点例外只保存在当前浏览器，最后一次编辑 ${TEACHING_PLAN_DRAFT_TTL_HOURS} 小时后自动清除。需要长期保留完整计划时，请以导出的 Excel 文件为准。`}
              showIcon
              title="逐课次内容仍是限时本地草稿，请及时导出"
              type="warning"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Typography.Text type="secondary">
              首次填写时，可先参考历史计划带入章节与作业，再按本学期调整。
              <ArrowRightOutlined className="ml-2" />
            </Typography.Text>
            <Space wrap>
              <Button
                disabled={formalRows.length === 0}
                icon={<HistoryOutlined />}
                loading={isLoadingHistory}
                onClick={openHistoryReference}
              >
                参考历史计划
              </Button>
              <Tooltip
                title={
                  canExport
                    ? undefined
                    : `内容行数（${contentRowCount}）需与正式课次数（${formalRows.length}）一致，且不能留有空位`
                }
              >
                <span>
                  <Button
                    disabled={!canExport}
                    icon={<DownloadOutlined />}
                    loading={isExporting}
                    type="primary"
                    onClick={() => void handleExport()}
                  >
                    导出 Excel
                  </Button>
                </span>
              </Tooltip>
            </Space>
          </div>
          {historyError ? <Alert closable showIcon title={historyError} type="error" /> : null}
          {!canExport && formalRows.length > 0 ? (
            <Alert
              description={`当前有 ${contentRowCount} 个 F/G 内容组、${formalRows.length} 个正式课次。请补齐所有空位并增删至数量一致；内容单元格可以留空。`}
              showIcon
              title="当前不可导出"
              type="info"
            />
          ) : null}
        </div>

        <div className="border-b border-border px-4">{courseNavigation}</div>

        <div className="overflow-x-auto">
          <table
            aria-label={`${course.courseName}课程授课计划`}
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
                  <div className="flex items-center justify-between gap-2">
                    <span>课外作业</span>
                    <Tooltip title="在末尾新增一个章节与作业内容组">
                      <Button
                        aria-label="新增内容行"
                        icon={<PlusOutlined />}
                        size="small"
                        type="text"
                        onClick={appendContentRow}
                      />
                    </Tooltip>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map(({ contentRow, formalRow, rowKey }, index) => {
                const contentLabel = formalRow
                  ? `${formalRow.teachingDate}第${formalRow.periodsText}节`
                  : `第${index + 1}行`;
                const dropIndicatorClass =
                  dropTarget?.index === index && dropTarget.position === 'before'
                    ? 'border-t-2 border-t-primary'
                    : dropTarget?.index === index && dropTarget.position === 'after'
                      ? 'border-b-2 border-b-primary'
                      : dropTarget?.index === index && dropTarget.position === 'at'
                        ? 'border-y-2 border-y-primary bg-fill-secondary'
                        : '';

                return (
                  <tr
                    className={`transition-colors duration-150 hover:bg-fill-secondary ${
                      draggedContentRowId === contentRow?.id ? 'bg-fill-secondary opacity-50' : ''
                    }`}
                    key={rowKey}
                    onDragOver={(event) => {
                      if (!draggedContentRowId) {
                        return;
                      }
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      const bounds = event.currentTarget.getBoundingClientRect();
                      setDropTarget({
                        index,
                        position: contentRow
                          ? event.clientY < bounds.top + bounds.height / 2
                            ? 'before'
                            : 'after'
                          : 'at',
                      });
                    }}
                    onDrop={(event) => {
                      if (!dropTarget || dropTarget.index !== index) {
                        return;
                      }
                      event.preventDefault();
                      handleContentRowDrop(index, dropTarget.position);
                    }}
                  >
                    <td className="border-b border-r border-border bg-bg-layout px-3 py-3 text-center text-xs text-text-tertiary">
                      {index + 1}
                    </td>
                    {formalRow ? (
                      <>
                        <td className="border-b border-r border-border px-3 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-text">{formalRow.teachingDate}</span>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                              <span>
                                {formatTeachingPlanWeekday(formalRow.occurrence.physicalDayOfWeek)}
                              </span>
                              <span>第 {formalRow.occurrence.weekIndex} 周</span>
                              {formalRow.occurrence.calcEffect !== 'NORMAL' ? (
                                <Tag
                                  color={
                                    formalRow.occurrence.calcEffect === 'MAKEUP'
                                      ? 'green'
                                      : 'purple'
                                  }
                                >
                                  {formatTeachingPlanCalcEffect(formalRow.occurrence.calcEffect)}
                                </Tag>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-r border-border px-3 py-3 text-center font-medium text-text">
                          {formalRow.teachingHours}
                        </td>
                        <td className="border-b border-r border-border px-3 py-3 text-center font-medium text-text">
                          {formalRow.periodsText}
                        </td>
                        <td className="border-b border-r border-border px-2 py-2">
                          <Select<TeachingPlanDeliveryMode>
                            aria-label={`${formalRow.teachingDate}第${formalRow.periodsText}节授课方式`}
                            options={DELIVERY_MODE_OPTIONS}
                            size="small"
                            style={{ width: '100%' }}
                            value={formalRow.deliveryMode}
                            variant="borderless"
                            onChange={(deliveryMode) =>
                              updateRow(formalRow.rowKey, { deliveryMode })
                            }
                          />
                        </td>
                        <td className="border-b border-border px-2 py-2">
                          <Input
                            aria-label={`${formalRow.teachingDate}第${formalRow.periodsText}节授课地点`}
                            disabled={isSavingClassroomName}
                            maxLength={64}
                            placeholder="填写授课地点"
                            size="small"
                            value={formalRow.location}
                            variant="borderless"
                            onBlur={(event) =>
                              void commitRowLocation(formalRow.rowKey, event.currentTarget.value)
                            }
                            onChange={(event) =>
                              updateRow(formalRow.rowKey, {
                                locationOverride: event.target.value,
                              })
                            }
                            onPressEnter={(event) => event.currentTarget.blur()}
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        {Array.from({ length: 5 }, (_, blankColumnIndex) => (
                          <td
                            aria-label={
                              blankColumnIndex === 0 ? `第${index + 1}行无正式授课数据` : undefined
                            }
                            className="border-b border-r border-border bg-bg-layout/50 px-3 py-3"
                            key={blankColumnIndex}
                          />
                        ))}
                      </>
                    )}
                    <td
                      className={`border-b border-l border-border px-2 py-2 ${dropIndicatorClass}`}
                    >
                      <Input.TextArea
                        aria-label={`${contentLabel}授课章节与内容`}
                        autoSize={{ maxRows: 6, minRows: 2 }}
                        maxLength={2000}
                        placeholder="填写授课章节与内容"
                        value={contentRow?.chapterAndContent ?? ''}
                        variant="borderless"
                        onChange={(event) =>
                          updateContentRowAtIndex(index, {
                            chapterAndContent: event.target.value,
                          })
                        }
                        onFocus={() => ensureContentRowAtIndex(index)}
                      />
                    </td>
                    <td
                      className={`border-b border-l border-border px-2 py-2 ${dropIndicatorClass}`}
                    >
                      <div className="flex items-stretch gap-1">
                        <Input.TextArea
                          aria-label={`${contentLabel}课外作业`}
                          autoSize={{ maxRows: 6, minRows: 2 }}
                          maxLength={2000}
                          placeholder="填写课外作业"
                          value={contentRow?.homework ?? ''}
                          variant="borderless"
                          onChange={(event) =>
                            updateContentRowAtIndex(index, { homework: event.target.value })
                          }
                          onFocus={() => ensureContentRowAtIndex(index)}
                        />
                        <div className="flex w-8 shrink-0 flex-col items-center justify-center gap-1 border-l border-border pl-1">
                          {contentRow ? (
                            <>
                              <Tooltip title="拖动章节与作业到其他位置">
                                <Button
                                  aria-label={`拖动第${index + 1}行章节与作业`}
                                  aria-pressed={draggedContentRowId === contentRow.id}
                                  draggable
                                  icon={<DragOutlined />}
                                  size="small"
                                  type="text"
                                  onDragEnd={clearDragState}
                                  onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData('text/plain', contentRow.id);
                                    dragPreviewRef.current?.remove();
                                    const preview = createContentRowDragPreview(contentRow, index);
                                    dragPreviewRef.current = preview;
                                    event.dataTransfer.setDragImage(preview, 24, 24);
                                    setDraggedContentRowId(contentRow.id);
                                  }}
                                />
                              </Tooltip>
                              <Tooltip title="删除这一行章节与作业">
                                <Button
                                  aria-label={`删除第${index + 1}行章节与作业`}
                                  danger
                                  icon={<DeleteOutlined />}
                                  size="small"
                                  type="text"
                                  onClick={() => removeContentRow(contentRow, index)}
                                />
                              </Tooltip>
                            </>
                          ) : (
                            <Tooltip title="补齐到这一行">
                              <Button
                                aria-label={`创建第${index + 1}行章节与作业`}
                                icon={<PlusOutlined />}
                                size="small"
                                type="text"
                                onClick={() => ensureContentRowAtIndex(index)}
                              />
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
          <SheetMeta label="正式课次" value={`${formalRows.length} 行`} />
          <SheetMeta label="章节与作业" value={`${contentRowCount} 行`} />
        </div>

        <div className="flex items-start gap-2 border-t border-border bg-bg-layout p-3 text-xs text-text-secondary">
          <LaptopOutlined className="mt-0.5" />
          <span>
            每次打开页面都会根据当前真源重新生成 A–E。F“授课章节与内容”和
            G“课外作业”作为固定内容组，可拖动、删除或补行；只有内容组数量与正式课次数一致时才能导出。
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
        okText="替换当前内容"
        open={historyModalOpen}
        title={`选择“${course.courseName}”的历史授课计划`}
        onCancel={() => setHistoryModalOpen(false)}
        onOk={applySelectedHistory}
      >
        <div className="flex flex-col gap-3">
          <Typography.Text type="secondary">
            候选来自近 6 学期，优先同名且总课时相近的计划。选中后会按历史计划的完整行序替换
            F/G；历史行更多时，表格会自动向下扩展，新增行的 A–E 保持空白。
          </Typography.Text>
          <Alert
            description="下一步仍会显示替换前后的行数供确认；确认后当前 F/G 的手工内容与排序会被覆盖。"
            showIcon
            title="这是整组替换操作"
            type="warning"
          />
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

function createContentRowDragPreview(contentRow: TeachingPlanContentRowDraft, index: number) {
  const preview = document.createElement('div');
  preview.setAttribute('aria-hidden', 'true');
  preview.className =
    'grid w-[520px] grid-cols-2 overflow-hidden rounded-[var(--radius-surface)] border border-primary bg-bg-container shadow-card';
  preview.style.left = '0';
  preview.style.position = 'absolute';
  preview.style.top = '-9999px';

  const chapter = document.createElement('div');
  chapter.className = 'flex min-w-0 flex-col gap-1 border-r border-border px-3 py-2';
  const chapterLabel = document.createElement('span');
  chapterLabel.className = 'text-xs font-medium text-primary';
  chapterLabel.textContent = `第 ${index + 1} 行 · 授课章节与内容`;
  const chapterValue = document.createElement('span');
  chapterValue.className = 'truncate text-sm text-text';
  chapterValue.textContent = contentRow.chapterAndContent || '（空）';
  chapter.append(chapterLabel, chapterValue);

  const homework = document.createElement('div');
  homework.className = 'flex min-w-0 flex-col gap-1 px-3 py-2';
  const homeworkLabel = document.createElement('span');
  homeworkLabel.className = 'text-xs font-medium text-primary';
  homeworkLabel.textContent = '课外作业';
  const homeworkValue = document.createElement('span');
  homeworkValue.className = 'truncate text-sm text-text';
  homeworkValue.textContent = contentRow.homework || '（空）';
  homework.append(homeworkLabel, homeworkValue);

  preview.append(chapter, homework);
  document.body.append(preview);
  return preview;
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
