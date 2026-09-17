// src/features/student-evaluation-comment/application/use-workbench.ts

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
  type StoredUpstreamSession,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import { hasGraphQLCategory, isGraphQLIngressError } from '@/shared/graphql';

import {
  cancelStudentEvaluationCommentProductGenerations,
  clearStudentEvaluationCommentProductComments,
  clearStudentGraduationEvaluationCommentProductComments,
  confirmStudentEvaluationCommentProductDrafts,
  confirmStudentGraduationEvaluationCommentProductDrafts,
  discardStudentEvaluationCommentProductDrafts,
  discardStudentGraduationEvaluationCommentProductDrafts,
  generateStudentEvaluationCommentProductDrafts,
  generateStudentGraduationEvaluationCommentProductDrafts,
  getStudentEvaluationCommentProductConductBasis,
  getStudentEvaluationCommentProductWorkbench,
  getStudentGraduationEvaluationCommentProductWorkbench,
  importStudentEvaluationCommentProductMaterial,
  refreshStudentEvaluationCommentProductConductBasis,
  refreshStudentEvaluationCommentProductCourseBasis,
  saveStudentEvaluationCommentProductDraft,
  saveStudentGraduationEvaluationCommentProductDraft,
  writeStudentEvaluationCommentProductComment,
  writeStudentEvaluationCommentProductComments,
  writeStudentGraduationEvaluationCommentProductComment,
} from '../infrastructure/api';
import type {
  StudentEvaluationCommentAiAddress,
  StudentEvaluationCommentAiLength,
  StudentEvaluationCommentAiTone,
  StudentEvaluationCommentKind,
  StudentEvaluationCommentMaterialIdentityMappingInput,
  StudentEvaluationCommentMaterialImportResult,
  StudentEvaluationCommentMaterialPreviewRow,
  StudentEvaluationCommentRevision,
  StudentEvaluationCommentWorkbench,
  StudentEvaluationCommentWorkbenchLoaderData,
  StudentEvaluationCommentWorkbenchStudent,
} from '../types';

import { assertMaterialPreviewMatchesWorkspace } from './material-import-preflight';
import {
  collectStudentEvaluationCommentConductBasisIssues,
  countStudentEvaluationCommentCodePoints,
  countStudentEvaluationCommentWorkflowStatuses,
  normalizeStudentEvaluationCommentContent,
  resolvePreviousStudentEvaluationCommentTerm,
  resolveStudentEvaluationCommentAiScenario,
  resolveStudentEvaluationCommentWorkflowStatus,
  STUDENT_EVALUATION_COMMENT_MAX_CODE_POINTS,
  type StudentEvaluationCommentWorkflowStatus,
} from './workbench-model';
import { initialWorkspaceState, workspaceReducer } from './workspace-state';

type ProductWorkbenchProps = {
  currentAccount: StudentEvaluationCommentWorkbenchLoaderData['currentAccount'];
};

type EditorState = {
  baseline: string;
  content: string;
  studentId: string;
  target:
    | { kind: 'import' }
    | { kind: 'draft'; draftId: string; revision: StudentEvaluationCommentRevision }
    | { kind: 'formal'; revision: StudentEvaluationCommentRevision | null };
};

type BasisSyncRequest = {
  classId: string;
  scopeKey: string;
  scopeVersion: number;
  semesterId: number;
};

type WorkspaceReloadOptions = {
  generationIssuePolicy?: 'clear' | 'preserve';
  scopeVersion?: number;
};

type WorkbenchFeedback = {
  confirm: (input: {
    content: string;
    danger?: boolean;
    okText: string;
    title: string;
  }) => Promise<boolean>;
  message: { [K in 'success' | 'error' | 'warning' | 'info']: (content: string) => void };
};

export function useStudentEvaluationCommentWorkbench({
  currentAccount,
  confirm,
  message,
}: ProductWorkbenchProps & WorkbenchFeedback) {
  const [activeCommentKind, setActiveCommentKind] = useState<StudentEvaluationCommentKind>('TERM');
  const [workspaceState, dispatchWorkspace] = useReducer(workspaceReducer, initialWorkspaceState);
  const { workspace, errorMessage } = workspaceState;
  const isLoading = workspaceState.status === 'loading';
  const [filter, setFilter] = useState<StudentEvaluationCommentWorkflowStatus>('ALL');
  const [searchText, setSearchText] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [generationIssuesByStudentId, setIssuesByStudentId] = useState<Record<string, string>>({});
  const [conductIssuesByStudentId, setConductIssuesByStudentId] = useState<Record<string, string>>(
    {},
  );
  const [conductPreflightError, setConductPreflightError] = useState<string | null>(null);
  const [isCheckingConductBasis, setIsCheckingConductBasis] = useState(false);
  const [importedDrafts, setImportedDrafts] = useState<
    Record<string, StudentEvaluationCommentMaterialPreviewRow>
  >({});
  const [importOpen, setImportOpen] = useState(false);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialImportResult, setMaterialImportResult] =
    useState<StudentEvaluationCommentMaterialImportResult | null>(null);
  const [materialImportError, setMaterialImportError] = useState<string | null>(null);
  const [materialSelectedSheet, setMaterialSelectedSheet] = useState<string | null>(null);
  const [materialIdentitySelections, setMaterialIdentitySelections] = useState<
    Record<string, string>
  >({});
  const [isImportingMaterial, setIsImportingMaterial] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [isEditorSaving, setIsEditorSaving] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [generationOpen, setGenerationOpen] = useState(false);
  const [tone, setTone] = useState<StudentEvaluationCommentAiTone>('OBJECTIVE_BALANCED');
  const [length, setLength] = useState<StudentEvaluationCommentAiLength>('CHARS_120_180');
  const [address, setAddress] = useState<StudentEvaluationCommentAiAddress>('THIRD_PERSON');
  const [styleExampleStudentIds, setStyleExampleStudentIds] = useState<string[]>([]);
  const [styleReferenceStudents, setStyleReferenceStudents] = useState<
    StudentEvaluationCommentWorkbenchStudent[]
  >([]);
  const [isLoadingStyleReferences, setIsLoadingStyleReferences] = useState(false);
  const [isSyncingBasis, setIsSyncingBasis] = useState(false);
  const [basisSyncError, setBasisSyncError] = useState<string | null>(null);
  const [queuedBasisSync, setQueuedBasisSync] = useState<{
    request: BasisSyncRequest;
    session: StoredUpstreamSession;
  } | null>(null);
  const latestWorkspaceRequestIdRef = useRef(0);
  const currentWorkspaceRef = useRef<StudentEvaluationCommentWorkbench | null>(null);
  const materialRequestIdRef = useRef(0);
  const scopeVersionRef = useRef(0);
  const scopeKeyRef = useRef('');

  const students = useMemo(() => workspace?.view?.students ?? [], [workspace?.view?.students]);
  const classId = workspace?.selectedClass?.classId ?? '';
  const semesterId = workspace?.selectedTerm?.semesterId ?? null;
  const scopeKey = workspace?.view?.scope.scopeKey ?? '';
  const isGraduation = activeCommentKind === 'GRADUATION';
  const generationScenario = resolveStudentEvaluationCommentAiScenario({
    selectedClass: workspace?.selectedClass ?? null,
    selectedTerm: workspace?.selectedTerm ?? null,
  });
  const isOffCampusInternship = generationScenario === 'OFF_CAMPUS_INTERNSHIP';
  const previousTerm = useMemo(
    () =>
      isGraduation || isOffCampusInternship
        ? null
        : resolvePreviousStudentEvaluationCommentTerm(
            workspace?.termOptions ?? [],
            workspace?.selectedTerm ?? null,
          ),
    [isGraduation, isOffCampusInternship, workspace?.selectedTerm, workspace?.termOptions],
  );
  const previousTermSemesterId = previousTerm?.semesterId ?? null;
  const editorStudent = editor
    ? (students.find((student) => student.studentId === editor.studentId) ?? null)
    : null;
  const editorDirty = editor ? editor.content !== editor.baseline : false;
  const importedDraftStudentIds = useMemo(
    () => new Set(Object.keys(importedDrafts)),
    [importedDrafts],
  );
  const hasPendingMaterialImport =
    isImportingMaterial ||
    (Boolean(materialFile) &&
      (materialImportResult?.status === 'SHEET_SELECTION_REQUIRED' ||
        materialImportResult?.status === 'IDENTITY_MAPPING_REQUIRED'));
  const isDirty = editorDirty || importedDraftStudentIds.size > 0 || hasPendingMaterialImport;

  useEffect(() => {
    scopeKeyRef.current = scopeKey;
  }, [scopeKey]);

  const applyWorkspace = useCallback((next: StudentEvaluationCommentWorkbench) => {
    currentWorkspaceRef.current = next;
    dispatchWorkspace({ type: 'received', workspace: next });
    setSelectedStudentIds((current) =>
      current.filter((studentId) =>
        next.view?.students.some((student) => student.studentId === studentId),
      ),
    );
  }, []);

  const loadWorkspace = useCallback(
    async (input: {
      classId?: string;
      commentKind: StudentEvaluationCommentKind;
      scopeVersion?: number;
      semesterId?: number;
    }) => {
      const scopeVersion = input.scopeVersion ?? scopeVersionRef.current;
      if (scopeVersion !== scopeVersionRef.current) return null;

      const requestId = latestWorkspaceRequestIdRef.current + 1;
      latestWorkspaceRequestIdRef.current = requestId;
      const isCurrentRequest = () =>
        latestWorkspaceRequestIdRef.current === requestId &&
        scopeVersionRef.current === scopeVersion;

      dispatchWorkspace({ type: 'requested' });
      setIsCheckingConductBasis(input.commentKind === 'TERM');
      try {
        const next =
          input.commentKind === 'GRADUATION'
            ? await getStudentGraduationEvaluationCommentProductWorkbench({
                ...(input.classId ? { classId: input.classId } : {}),
              })
            : await getStudentEvaluationCommentProductWorkbench({
                ...(input.classId ? { classId: input.classId } : {}),
                ...(input.semesterId !== undefined ? { semesterId: input.semesterId } : {}),
              });
        const nextClassId = next.selectedClass?.classId;
        const nextSemesterId = next.selectedTerm?.semesterId;
        const nextGenerationScenario = resolveStudentEvaluationCommentAiScenario({
          selectedClass: next.selectedClass,
          selectedTerm: next.selectedTerm,
        });
        let nextConductIssues: Record<string, string> = {};
        let nextConductPreflightError: string | null = null;

        if (
          input.commentKind === 'TERM' &&
          nextGenerationScenario === 'ACADEMIC_TERM' &&
          nextClassId &&
          nextSemesterId !== undefined
        ) {
          try {
            const conductWorkspace = await getStudentEvaluationCommentProductConductBasis({
              classId: nextClassId,
              semesterId: nextSemesterId,
            });
            nextConductIssues = collectStudentEvaluationCommentConductBasisIssues(
              conductWorkspace.view?.students ?? [],
            );
          } catch {
            nextConductPreflightError =
              '暂时无法检查已确认操行等第，AI 生成时仍会由服务端最终复核。';
          }
        }

        if (!isCurrentRequest()) return null;
        applyWorkspace(next);
        setConductIssuesByStudentId(nextConductIssues);
        setConductPreflightError(nextConductPreflightError);
        return next;
      } catch (error) {
        if (isCurrentRequest())
          dispatchWorkspace({ type: 'failed', errorMessage: resolveProductErrorMessage(error) });
        return null;
      } finally {
        if (isCurrentRequest()) {
          setIsCheckingConductBasis(false);
        }
      }
    },
    [applyWorkspace],
  );

  useEffect(() => {
    void loadWorkspace({ commentKind: 'TERM' });
  }, [loadWorkspace]);

  useEffect(() => {
    let active = true;
    setStyleExampleStudentIds([]);
    setStyleReferenceStudents([]);
    if (isGraduation || !classId || previousTermSemesterId === null) {
      setIsLoadingStyleReferences(false);
      return;
    }

    setIsLoadingStyleReferences(true);
    void getStudentEvaluationCommentProductWorkbench({
      classId,
      semesterId: previousTermSemesterId,
    })
      .then((referenceWorkspace) => {
        if (!active) return;
        setStyleReferenceStudents(
          (referenceWorkspace.view?.students ?? []).filter((student) => Boolean(student.comment)),
        );
      })
      .catch(() => {
        if (active) setStyleReferenceStudents([]);
      })
      .finally(() => {
        if (active) setIsLoadingStyleReferences(false);
      });

    return () => {
      active = false;
    };
  }, [classId, isGraduation, previousTermSemesterId]);

  const reloadCurrentWorkspace = useCallback(
    async (options: WorkspaceReloadOptions = {}) => {
      const scopeVersion = options.scopeVersion ?? scopeVersionRef.current;
      if (scopeVersion !== scopeVersionRef.current) return null;

      const next = !classId
        ? await loadWorkspace({ commentKind: activeCommentKind, scopeVersion })
        : isGraduation
          ? await loadWorkspace({ classId, commentKind: 'GRADUATION', scopeVersion })
          : semesterId === null
            ? await loadWorkspace({ classId, commentKind: 'TERM', scopeVersion })
            : await loadWorkspace({ classId, commentKind: 'TERM', scopeVersion, semesterId });
      if (
        next &&
        scopeVersionRef.current === scopeVersion &&
        options.generationIssuePolicy !== 'preserve'
      ) {
        setIssuesByStudentId({});
      }
      return next;
    },
    [activeCommentKind, classId, isGraduation, loadWorkspace, semesterId],
  );

  useEffect(() => {
    if (!students.some((student) => student.aiGeneration.status === 'GENERATING')) return;
    const scopeVersion = scopeVersionRef.current;
    const timerId = globalThis.setTimeout(
      () =>
        void reloadCurrentWorkspace({
          generationIssuePolicy: 'preserve',
          scopeVersion,
        }),
      4_000,
    );
    return () => globalThis.clearTimeout(timerId);
  }, [reloadCurrentWorkspace, students]);

  const clearMaterialImportSession = useCallback(() => {
    materialRequestIdRef.current += 1;
    setMaterialFile(null);
    setMaterialImportResult(null);
    setMaterialImportError(null);
    setMaterialSelectedSheet(null);
    setMaterialIdentitySelections({});
    setIsImportingMaterial(false);
  }, []);

  const requestScopeChange = useCallback(
    async (next: {
      classId: string;
      commentKind?: StudentEvaluationCommentKind;
      semesterId?: number;
    }) => {
      if (
        (editorDirty || importedDraftStudentIds.size > 0 || hasPendingMaterialImport) &&
        !(await confirm({
          content: '切换后会放弃当前尚未保存的编辑和 Excel 导入草稿。',
          okText: '放弃并切换',
          title: '切换评语范围？',
        }))
      ) {
        return;
      }
      const scopeVersion = scopeVersionRef.current + 1;
      scopeVersionRef.current = scopeVersion;
      setEditor(null);
      setSelectedStudentIds([]);
      setIssuesByStudentId({});
      setConductIssuesByStudentId({});
      setConductPreflightError(null);
      setBasisSyncError(null);
      setQueuedBasisSync(null);
      setImportedDrafts({});
      setImportOpen(false);
      clearMaterialImportSession();
      setStyleExampleStudentIds([]);
      setFilter('ALL');
      const nextCommentKind = next.commentKind ?? activeCommentKind;
      const loaded = await loadWorkspace({
        classId: next.classId,
        commentKind: nextCommentKind,
        scopeVersion,
        ...(nextCommentKind === 'TERM' && next.semesterId !== undefined
          ? { semesterId: next.semesterId }
          : {}),
      });
      if (loaded && scopeVersionRef.current === scopeVersion) {
        setActiveCommentKind(nextCommentKind);
      }
    },
    [
      clearMaterialImportSession,
      editorDirty,
      importedDraftStudentIds.size,
      hasPendingMaterialImport,
      loadWorkspace,
      confirm,
      activeCommentKind,
    ],
  );

  const actionableConductIssuesByStudentId = useMemo(() => {
    const issues: Record<string, string> = {};

    students.forEach((student) => {
      const issue = conductIssuesByStudentId[student.studentId];
      if (
        issue &&
        !student.comment &&
        !student.aiDraft &&
        !(student.aiGeneration.status === 'GENERATING') &&
        !importedDraftStudentIds.has(student.studentId)
      ) {
        issues[student.studentId] = issue;
      }
    });

    return issues;
  }, [conductIssuesByStudentId, importedDraftStudentIds, students]);
  const issuesByStudentId = useMemo(
    () => ({
      ...generationIssuesByStudentId,
      ...actionableConductIssuesByStudentId,
      ...Object.fromEntries(
        students.flatMap((student) =>
          student.aiGeneration.status === 'FAILED' && student.aiGeneration.reasonCode
            ? [[student.studentId, student.aiGeneration.reasonCode]]
            : [],
        ),
      ),
    }),
    [actionableConductIssuesByStudentId, generationIssuesByStudentId, students],
  );
  const counts = useMemo(
    () =>
      countStudentEvaluationCommentWorkflowStatuses({
        issuesByStudentId,
        students,
        workingDraftStudentIds: importedDraftStudentIds,
      }),
    [importedDraftStudentIds, issuesByStudentId, students],
  );
  const visibleStudents = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return students.filter((student) => {
      const status = resolveStudentEvaluationCommentWorkflowStatus({
        hasWorkingDraft: importedDraftStudentIds.has(student.studentId),
        issueCode: issuesByStudentId[student.studentId],
        student,
      });
      if (filter !== 'ALL' && status !== filter) return false;
      return (
        !query ||
        student.studentName.toLowerCase().includes(query) ||
        student.studentId.toLowerCase().includes(query)
      );
    });
  }, [filter, importedDraftStudentIds, issuesByStudentId, searchText, students]);
  const selectedStudents = useMemo(
    () => students.filter((student) => selectedStudentIds.includes(student.studentId)),
    [selectedStudentIds, students],
  );
  const generationCandidates = selectedStudents.filter(
    (student) =>
      resolveStudentEvaluationCommentWorkflowStatus({
        hasWorkingDraft: importedDraftStudentIds.has(student.studentId),
        issueCode: issuesByStudentId[student.studentId],
        student,
      }) === 'TODO' ||
      (student.aiGeneration.retryAllowed && !importedDraftStudentIds.has(student.studentId)),
  );
  const cancellationCandidates = selectedStudents.flatMap((student) =>
    student.aiGeneration.status === 'GENERATING' && student.aiGeneration.generationVersion
      ? [
          {
            studentId: student.studentId,
            expectedGenerationVersion: student.aiGeneration.generationVersion,
          },
        ]
      : [],
  );
  const handleCancelGeneration = async () => {
    if (isBatchRunning || cancellationCandidates.length === 0) return;
    const scopeVersion = scopeVersionRef.current;
    const input = {
      classId,
      commentKind: activeCommentKind,
      semesterId: isGraduation ? null : semesterId,
      items: cancellationCandidates,
    };
    const confirmed = await confirm({
      title: '取消所选学生的生成？',
      content: '只取消本次结果接收，不保证停止外部生成请求。已生成的草稿和未选中的学生不受影响。',
      okText: '确认取消生成',
    });
    if (!confirmed || scopeVersionRef.current !== scopeVersion) return;
    setIsBatchRunning(true);
    try {
      const result = await cancelStudentEvaluationCommentProductGenerations(input);
      if (scopeVersionRef.current !== scopeVersion) return;
      const count = result.items.filter((item) => item.disposition === 'CANCELLED').length;
      message.info(`已取消 ${count} 名学生的生成；已完成或版本已变化的任务保持不变。`);
      await reloadCurrentWorkspace({ generationIssuePolicy: 'preserve', scopeVersion });
    } catch (error) {
      if (scopeVersionRef.current === scopeVersion)
        message.error(resolveProductErrorMessage(error));
    } finally {
      setIsBatchRunning(false);
    }
  };
  const selectedConductBlockedCount = selectedStudents.filter((student) =>
    Boolean(actionableConductIssuesByStudentId[student.studentId]),
  ).length;
  const conductMissingCount = Object.values(actionableConductIssuesByStudentId).filter(
    (issue) => issue === 'CONDUCT_GRADE_MISSING',
  ).length;
  const conductConflictCount = Object.values(actionableConductIssuesByStudentId).filter(
    (issue) => issue === 'CONDUCT_GRADE_CONFLICT',
  ).length;
  const conductBlockedCount = conductMissingCount + conductConflictCount;
  const reviewCandidates = selectedStudents.filter(
    (student) => Boolean(student.aiDraft) && !importedDraftStudentIds.has(student.studentId),
  );
  const confirmCandidates = reviewCandidates.filter(
    (student) => resolveStudentEvaluationCommentWorkflowStatus({ student }) === 'REVIEW',
  );
  const completedCandidates = selectedStudents.filter(
    (student) =>
      resolveStudentEvaluationCommentWorkflowStatus({
        hasWorkingDraft: importedDraftStudentIds.has(student.studentId),
        issueCode: issuesByStudentId[student.studentId],
        student,
      }) === 'COMPLETED',
  );
  const generateAction = workspace?.actions.find(
    (action) => action.action === 'GENERATE_AI_DRAFTS',
  );
  const writeAction = workspace?.actions.find((action) => action.action === 'WRITE_COMMENTS');
  const generationDisabledReason =
    !isGraduation && !isOffCampusInternship && isCheckingConductBasis
      ? '正在检查已确认操行等第'
      : !generateAction?.allowed
        ? (generateAction?.reasonMessage ??
          (isGraduation ? '当前班级暂不可生成毕业鉴定草稿' : '当前学期暂不可生成 AI 草稿'))
        : generationCandidates.length === 0
          ? selectedConductBlockedCount > 0
            ? `所选 ${selectedConductBlockedCount} 名学生缺少可用的已确认操行等第`
            : '请先选择待处理学生'
          : undefined;
  const styleOptions = styleReferenceStudents.flatMap((student) =>
    student.comment
      ? [{ label: `${student.studentName} · ${student.studentId}`, value: student.studentId }]
      : [],
  );
  const importedCandidates = students.flatMap((student) => {
    const draft = importedDrafts[student.studentId];
    return draft ? [{ draft, student }] : [];
  });

  const openEditor = useCallback(
    (student: StudentEvaluationCommentWorkbenchStudent) => {
      const content =
        importedDrafts[student.studentId]?.content ??
        student.aiDraft?.content ??
        student.comment?.content ??
        '';
      setEditor({
        baseline: content,
        content,
        studentId: student.studentId,
        target: importedDrafts[student.studentId]
          ? { kind: 'import' }
          : student.aiDraft
            ? {
                kind: 'draft',
                draftId: student.aiDraft.draftId,
                revision: { ...student.aiDraft.revision },
              }
            : {
                kind: 'formal',
                revision: student.comment ? { ...student.comment.revision } : null,
              },
      });
    },
    [importedDrafts],
  );

  const closeEditor = useCallback(async () => {
    if (
      editorDirty &&
      !(await confirm({
        content: '关闭后会放弃当前尚未保存的文本。',
        okText: '放弃修改',
        title: '关闭评语编辑？',
      }))
    ) {
      return;
    }
    setEditor(null);
  }, [editorDirty, confirm]);

  const closeExcelImport = useCallback(() => {
    if (isImportingMaterial) return;
    setImportOpen(false);
    clearMaterialImportSession();
  }, [clearMaterialImportSession, isImportingMaterial]);

  const openExcelImport = useCallback(async () => {
    if (!writeAction?.allowed) return;
    if (
      editorDirty &&
      !(await confirm({
        content: '打开导入后会放弃当前编辑框里尚未保存的修改。',
        okText: '放弃并导入',
        title: '打开 Excel 导入？',
      }))
    ) {
      return;
    }
    if (
      importedDraftStudentIds.size > 0 &&
      !(await confirm({
        content: `重新导入会替换当前 ${importedDraftStudentIds.size} 条 Excel 草稿。`,
        okText: '重新导入',
        title: '替换 Excel 草稿？',
      }))
    ) {
      return;
    }

    setEditor(null);
    setImportedDrafts({});
    clearMaterialImportSession();
    setImportOpen(true);
  }, [clearMaterialImportSession, editorDirty, importedDraftStudentIds.size, confirm, writeAction]);

  const runMaterialImport = useCallback(
    async (input: {
      file: File;
      identityMappings?: readonly StudentEvaluationCommentMaterialIdentityMappingInput[];
      selectedSheet?: string;
    }) => {
      if (!classId || semesterId === null || !writeAction?.allowed) return;

      const requestId = ++materialRequestIdRef.current;
      const scopeVersion = scopeVersionRef.current;
      const isCurrentRequest = () =>
        requestId === materialRequestIdRef.current && scopeVersion === scopeVersionRef.current;
      setIsImportingMaterial(true);
      setMaterialImportError(null);
      setMaterialImportResult(null);
      try {
        const result = await importStudentEvaluationCommentProductMaterial({
          classId,
          file: input.file,
          ...(input.identityMappings ? { identityMappings: input.identityMappings } : {}),
          ...(input.selectedSheet ? { selectedSheet: input.selectedSheet } : {}),
          semesterId,
        });

        if (!isCurrentRequest()) return;
        const currentWorkspace = currentWorkspaceRef.current;
        if (
          currentWorkspace?.selectedClass?.classId !== classId ||
          currentWorkspace.commentKind !== 'TERM' ||
          currentWorkspace.selectedTerm?.semesterId !== semesterId
        )
          return;

        setMaterialSelectedSheet(result.selectedSheet ?? input.selectedSheet ?? null);
        if (result.status === 'SHEET_SELECTION_REQUIRED') {
          setMaterialImportResult(result);
          setMaterialSelectedSheet(null);
          setMaterialIdentitySelections({});
          message.info('请选择需要导入的工作表。');
          return;
        }
        if (result.status === 'IDENTITY_MAPPING_REQUIRED') {
          setMaterialImportResult(result);
          setMaterialIdentitySelections({});
          message.warning('存在重名学生，请确认对应身份。');
          return;
        }
        if (result.status === 'BLOCKED') {
          setMaterialImportResult(result);
          message.error('材料存在阻断问题，工作台草稿未发生变化。');
          return;
        }
        if (result.status === 'NO_CHANGES') {
          setMaterialImportResult(result);
          setMaterialFile(null);
          message.info('Excel 中没有需要预填的变化。');
          return;
        }

        assertMaterialPreviewMatchesWorkspace({
          previewRows: result.previewRows,
          students: currentWorkspace.view?.students ?? [],
        });
        const nextDrafts = Object.fromEntries(
          result.previewRows.map((row) => [row.studentId, row]),
        );
        const importedStudentIds = result.previewRows.map((row) => row.studentId);
        setImportedDrafts(nextDrafts);
        setSelectedStudentIds(importedStudentIds);
        setFilter('REVIEW');
        setEditor(null);
        setImportOpen(false);
        clearMaterialImportSession();
        message.success(`已预填 ${importedStudentIds.length} 条 Excel 草稿，请审阅后统一保存。`);
      } catch (error) {
        if (isCurrentRequest()) setMaterialImportError(resolveProductErrorMessage(error));
      } finally {
        if (isCurrentRequest()) setIsImportingMaterial(false);
      }
    },
    [classId, clearMaterialImportSession, message, semesterId, writeAction?.allowed],
  );

  const handleMaterialFileSelected = useCallback(
    (file: File) => {
      setMaterialFile(file);
      setMaterialImportResult(null);
      setMaterialImportError(null);
      setMaterialSelectedSheet(null);
      setMaterialIdentitySelections({});
      void runMaterialImport({ file });
    },
    [runMaterialImport],
  );

  const handleContinueMaterialSheet = useCallback(() => {
    if (!materialFile || !materialSelectedSheet) return;
    void runMaterialImport({ file: materialFile, selectedSheet: materialSelectedSheet });
  }, [materialFile, materialSelectedSheet, runMaterialImport]);

  const handleContinueMaterialMappings = useCallback(() => {
    if (!materialFile || materialImportResult?.status !== 'IDENTITY_MAPPING_REQUIRED') return;
    const identityMappings = materialImportResult.identityMappingGroups.flatMap((group) => {
      const studentId = materialIdentitySelections[group.mappingKey];
      return studentId ? [{ mappingKey: group.mappingKey, studentId }] : [];
    });
    if (identityMappings.length !== materialImportResult.identityMappingGroups.length) {
      message.warning('请先为全部来源身份选择对应学生。');
      return;
    }
    void runMaterialImport({
      file: materialFile,
      identityMappings,
      ...(materialSelectedSheet ? { selectedSheet: materialSelectedSheet } : {}),
    });
  }, [
    materialFile,
    materialIdentitySelections,
    materialImportResult,
    materialSelectedSheet,
    message,
    runMaterialImport,
  ]);

  const saveImportedDrafts = useCallback(async () => {
    if (!classId || semesterId === null || importedCandidates.length === 0) return;
    const invalidCount = importedCandidates.filter(({ draft }) => {
      const content = normalizeStudentEvaluationCommentContent(draft.content);
      const length = countStudentEvaluationCommentCodePoints(content);
      return !content || length > STUDENT_EVALUATION_COMMENT_MAX_CODE_POINTS;
    }).length;
    if (invalidCount > 0) {
      message.error(`${invalidCount} 条 Excel 草稿内容无效，请逐条检查。`);
      return;
    }
    if (
      !(await confirm({
        content: `将 ${importedCandidates.length} 条 Excel 草稿写入正式评语。`,
        okText: '确认保存',
        title: '保存 Excel 导入？',
      }))
    ) {
      return;
    }

    setIsBatchRunning(true);
    try {
      const result = await writeStudentEvaluationCommentProductComments({
        classId,
        items: importedCandidates.map(({ draft, student }) => ({
          content: normalizeStudentEvaluationCommentContent(draft.content),
          expectedRevision: draft.expectedRevision,
          studentId: student.studentId,
        })),
        semesterId,
      });
      setImportedDrafts({});
      setEditor(null);
      setSelectedStudentIds([]);
      message.success(
        result.status === 'NO_CHANGES'
          ? '服务端确认没有实际变化。'
          : `Excel 导入已保存：新建 ${result.counts.created}，更新 ${result.counts.updated}。`,
      );
      await reloadCurrentWorkspace();
    } catch (error) {
      message.error(resolveProductErrorMessage(error));
    } finally {
      setIsBatchRunning(false);
    }
  }, [classId, importedCandidates, message, confirm, reloadCurrentWorkspace, semesterId]);

  const discardImportedDrafts = useCallback(async () => {
    if (
      importedDraftStudentIds.size === 0 ||
      !(await confirm({
        content: `将移除 ${importedDraftStudentIds.size} 条尚未保存的 Excel 草稿，正式评语不会改变。`,
        okText: '移除草稿',
        title: '撤销 Excel 导入？',
      }))
    ) {
      return;
    }
    setImportedDrafts({});
    setEditor(null);
    setSelectedStudentIds([]);
    message.success('Excel 草稿已移除。');
  }, [importedDraftStudentIds.size, message, confirm]);

  const discardImportedDraft = useCallback(
    async (studentId: string) => {
      if (
        !(await confirm({
          content: '只移除这条尚未保存的 Excel 草稿，原正式评语不会改变。',
          okText: '移除草稿',
          title: '移除 Excel 草稿？',
        }))
      ) {
        return;
      }
      setImportedDrafts((current) => {
        const next = { ...current };
        delete next[studentId];
        return next;
      });
      setSelectedStudentIds((current) => current.filter((id) => id !== studentId));
      setEditor(null);
    },
    [confirm],
  );

  const saveEditor = useCallback(async () => {
    if (!editor || !editorStudent || !classId || (!isGraduation && semesterId === null)) return;
    const content = normalizeStudentEvaluationCommentContent(editor.content);
    const codePoints = countStudentEvaluationCommentCodePoints(content);
    if (!content || codePoints > STUDENT_EVALUATION_COMMENT_MAX_CODE_POINTS) return;

    setIsEditorSaving(true);
    try {
      const importedDraft = importedDrafts[editorStudent.studentId];
      if (editor.target.kind === 'import') {
        if (!importedDraft) return;
        setImportedDrafts((current) => ({
          ...current,
          [editorStudent.studentId]: { ...importedDraft, content },
        }));
        message.success('Excel 草稿已更新，尚未写入正式评语。');
      } else if (editor.target.kind === 'draft') {
        if (isGraduation) {
          await saveStudentGraduationEvaluationCommentProductDraft({
            classId,
            content,
            draftId: editor.target.draftId,
            expectedRevision: editor.target.revision,
          });
        } else if (semesterId !== null) {
          await saveStudentEvaluationCommentProductDraft({
            classId,
            content,
            draftId: editor.target.draftId,
            expectedRevision: editor.target.revision,
            semesterId,
          });
        }
        message.success('AI 草稿已保存。');
      } else {
        if (isGraduation) {
          await writeStudentGraduationEvaluationCommentProductComment({
            classId,
            content,
            expectedRevision: editor.target.revision,
            studentId: editorStudent.studentId,
          });
        } else if (semesterId !== null) {
          await writeStudentEvaluationCommentProductComment({
            classId,
            content,
            expectedRevision: editor.target.revision,
            semesterId,
            studentId: editorStudent.studentId,
          });
        }
        setIssuesByStudentId((current) => {
          const next = { ...current };
          delete next[editorStudent.studentId];
          return next;
        });
        message.success(`正式${isGraduation ? '毕业鉴定' : '评语'}已保存。`);
      }
      setEditor(null);
      if (!importedDraft) await reloadCurrentWorkspace();
    } catch (error) {
      message.error(resolveProductErrorMessage(error));
    } finally {
      setIsEditorSaving(false);
    }
  }, [
    classId,
    editor,
    editorStudent,
    importedDrafts,
    isGraduation,
    message,
    reloadCurrentWorkspace,
    semesterId,
  ]);

  const runDraftBatch = useCallback(
    async (action: 'confirm' | 'discard', candidates = reviewCandidates) => {
      if (!classId || (!isGraduation && semesterId === null) || candidates.length === 0) return;
      const confirmed = await confirm({
        content:
          action === 'confirm'
            ? `将 ${candidates.length} 条草稿写入正式${isGraduation ? '毕业鉴定' : '评语'}。`
            : `将永久删除 ${candidates.length} 条 AI 草稿。`,
        okText: action === 'confirm' ? '确认写入' : '确认放弃',
        title:
          action === 'confirm'
            ? `确认正式${isGraduation ? '毕业鉴定' : '评语'}？`
            : '放弃 AI 草稿？',
      });
      if (!confirmed) return;

      setIsBatchRunning(true);
      try {
        const items = candidates.flatMap((student) =>
          student.aiDraft
            ? [
                {
                  draftId: student.aiDraft.draftId,
                  expectedRevision: student.aiDraft.revision,
                },
              ]
            : [],
        );
        if (action === 'confirm') {
          const result = isGraduation
            ? await confirmStudentGraduationEvaluationCommentProductDrafts({ classId, items })
            : await confirmStudentEvaluationCommentProductDrafts({
                classId,
                items,
                semesterId: semesterId as number,
              });
          message.success(
            `已确认 ${result.confirmedCount} 条正式${isGraduation ? '毕业鉴定' : '评语'}。`,
          );
        } else {
          const result = isGraduation
            ? await discardStudentGraduationEvaluationCommentProductDrafts({ classId, items })
            : await discardStudentEvaluationCommentProductDrafts({
                classId,
                items,
                semesterId: semesterId as number,
              });
          message.success(`已放弃 ${result.discardedCount} 条 AI 草稿。`);
        }
        setEditor(null);
        setSelectedStudentIds([]);
        await reloadCurrentWorkspace();
      } catch (error) {
        message.error(resolveProductErrorMessage(error));
      } finally {
        setIsBatchRunning(false);
      }
    },
    [classId, isGraduation, message, confirm, reloadCurrentWorkspace, reviewCandidates, semesterId],
  );

  const clearFormalComments = useCallback(async () => {
    if (!classId || (!isGraduation && semesterId === null) || completedCandidates.length === 0) {
      return;
    }
    if (
      !(await confirm({
        content: `将永久删除 ${completedCandidates.length} 条正式${isGraduation ? '毕业鉴定' : '评语'}，学生会重新回到待处理状态。任一内容已被他人修改时，本批次不会删除任何记录。`,
        danger: true,
        okText: '确认删除',
        title: `批量删除正式${isGraduation ? '毕业鉴定' : '评语'}？`,
      }))
    ) {
      return;
    }

    setIsBatchRunning(true);
    try {
      const items = completedCandidates.flatMap((student) =>
        student.comment
          ? [{ expectedRevision: student.comment.revision, studentId: student.studentId }]
          : [],
      );
      const result = isGraduation
        ? await clearStudentGraduationEvaluationCommentProductComments({ classId, items })
        : await clearStudentEvaluationCommentProductComments({
            classId,
            items,
            semesterId: semesterId as number,
          });
      setEditor(null);
      setSelectedStudentIds([]);
      message.success(
        result.status === 'NO_CHANGES'
          ? '服务端确认没有可删除的正式评语。'
          : `已删除 ${result.counts.deleted} 条正式${isGraduation ? '毕业鉴定' : '评语'}。`,
      );
      await reloadCurrentWorkspace();
    } catch (error) {
      message.error(resolveProductErrorMessage(error));
    } finally {
      setIsBatchRunning(false);
    }
  }, [
    classId,
    completedCandidates,
    isGraduation,
    message,
    confirm,
    reloadCurrentWorkspace,
    semesterId,
  ]);

  const handleGenerate = useCallback(async () => {
    if (!classId || (!isGraduation && semesterId === null) || generationCandidates.length === 0) {
      return;
    }
    setIsBatchRunning(true);
    try {
      const studentIds = generationCandidates.map((student) => student.studentId);
      const result = isGraduation
        ? await generateStudentGraduationEvaluationCommentProductDrafts({ classId, studentIds })
        : await generateStudentEvaluationCommentProductDrafts({
            address,
            classId,
            length,
            scenario: generationScenario,
            semesterId: semesterId as number,
            studentIds,
            styleExampleStudentIds: isOffCampusInternship ? [] : styleExampleStudentIds,
            tone,
          });
      setIssuesByStudentId((current) => {
        const next = { ...current };
        result.items.forEach((item) => {
          if (
            item.disposition === 'BASIS_MISSING' ||
            item.disposition === 'TERM_COMMENTS_INCOMPLETE' ||
            item.disposition === 'ENTRY_BASIS_INSUFFICIENT' ||
            item.disposition === 'BASIS_UNAVAILABLE' ||
            item.disposition === 'BASIS_TOO_LARGE'
          ) {
            next[item.studentId] = item.disposition;
          } else delete next[item.studentId];
        });
        return next;
      });
      setGenerationOpen(false);
      setSelectedStudentIds([]);
      const blockedCount = isGraduation
        ? result.items.filter((item) =>
            [
              'TERM_COMMENTS_INCOMPLETE',
              'ENTRY_BASIS_INSUFFICIENT',
              'BASIS_UNAVAILABLE',
              'BASIS_TOO_LARGE',
            ].includes(item.disposition),
          ).length
        : result.items.filter((item) => item.disposition === 'BASIS_MISSING').length;
      message[result.counts.accepted ? 'success' : blockedCount ? 'warning' : 'info'](
        result.counts.accepted
          ? `已受理 ${result.counts.accepted} 名学生${blockedCount ? `，另有 ${blockedCount} 人依据不满足要求` : ''}，完成后列表会自动更新。`
          : blockedCount
            ? `${blockedCount} 名学生的生成依据不满足要求，请查看列表中的说明。`
            : '本次没有新增生成任务。',
      );
      await reloadCurrentWorkspace({ generationIssuePolicy: 'preserve' });
    } catch (error) {
      message.error(resolveProductErrorMessage(error));
    } finally {
      setIsBatchRunning(false);
    }
  }, [
    address,
    classId,
    generationScenario,
    generationCandidates,
    isGraduation,
    isOffCampusInternship,
    length,
    message,
    reloadCurrentWorkspace,
    semesterId,
    styleExampleStudentIds,
    tone,
  ]);

  const {
    modalProps: upstreamLoginModalProps,
    openLoginModal,
    openLoginModalForExpiredSession,
    persistSessionFromResult,
    refreshSession,
    session: upstreamSession,
  } = useUpstreamLoginModalController<BasisSyncRequest>({
    account: currentAccount,
    keepAlive: true,
    lockedUserId: currentAccount.lockedUpstreamLoginUserId,
    resolveLoginErrorMessage: (error) =>
      resolveUpstreamErrorMessage(error, '校园网登录失败，请检查账号或密码。'),
    onLoginSuccess: ({ pendingAction, session }) => {
      if (
        pendingAction?.scopeVersion === scopeVersionRef.current &&
        pendingAction.scopeKey === scopeKeyRef.current
      ) {
        setQueuedBasisSync({ request: pendingAction, session });
      }
    },
  });

  const runBasisSync = useCallback(
    async (session: StoredUpstreamSession, request: BasisSyncRequest) => {
      const isCurrentScope = () =>
        scopeVersionRef.current === request.scopeVersion &&
        scopeKeyRef.current === request.scopeKey;
      if (isOffCampusInternship || !isCurrentScope()) return;
      let latestSession = session;
      const executeSync = async (activeSession: StoredUpstreamSession) => {
        const conduct = await refreshStudentEvaluationCommentProductConductBasis({
          classId: request.classId,
          semesterId: request.semesterId,
          upstreamSessionToken: activeSession.upstreamSessionToken,
        });
        const afterConduct = persistSessionFromResult(activeSession, conduct);
        latestSession = afterConduct;
        const courses = await refreshStudentEvaluationCommentProductCourseBasis({
          classId: request.classId,
          semesterId: request.semesterId,
          upstreamSessionToken: afterConduct.upstreamSessionToken,
        });
        latestSession = persistSessionFromResult(afterConduct, courses);
        if (!isCurrentScope()) return;
        const failures = conduct.failureCount + courses.failedStudentCount;
        message[failures ? 'warning' : 'success'](
          failures
            ? `依据已更新，另有 ${failures} 条数据需要检查。`
            : `已更新 ${conduct.writtenStudentCount} 名操行依据和 ${courses.studentCount} 名成绩依据。`,
        );
        setIssuesByStudentId({});
        await reloadCurrentWorkspace({ scopeVersion: request.scopeVersion });
      };

      setIsSyncingBasis(true);
      setBasisSyncError(null);
      try {
        await executeSync(session);
      } catch (error) {
        if (!isCurrentScope()) return;
        if (!isExpiredUpstreamSessionError(error)) {
          setBasisSyncError(resolveUpstreamErrorMessage(error, '暂时无法更新生成依据。'));
          return;
        }
        try {
          const refreshed = await refreshSession(latestSession);
          if (!isCurrentScope()) return;
          await executeSync(refreshed);
        } catch (retryError) {
          if (!isCurrentScope()) return;
          openLoginModalForExpiredSession({
            loginError: resolveUpstreamErrorMessage(
              retryError,
              '校园网会话已失效，请重新登录后继续。',
            ),
            pendingAction: request,
            session: latestSession,
          });
        }
      } finally {
        setIsSyncingBasis(false);
      }
    },
    [
      isOffCampusInternship,
      message,
      openLoginModalForExpiredSession,
      persistSessionFromResult,
      refreshSession,
      reloadCurrentWorkspace,
    ],
  );

  useEffect(() => {
    if (!queuedBasisSync) return;
    setQueuedBasisSync(null);
    void runBasisSync(queuedBasisSync.session, queuedBasisSync.request);
  }, [queuedBasisSync, runBasisSync]);

  const handleBasisSync = useCallback(() => {
    if (isOffCampusInternship || !classId || semesterId === null || !scopeKey) return;
    const request = {
      classId,
      scopeKey,
      scopeVersion: scopeVersionRef.current,
      semesterId,
    };
    if (!upstreamSession) {
      openLoginModal({ pendingAction: request });
      return;
    }
    void runBasisSync(upstreamSession, request);
  }, [
    classId,
    isOffCampusInternship,
    openLoginModal,
    runBasisSync,
    scopeKey,
    semesterId,
    upstreamSession,
  ]);

  return {
    activeCommentKind,
    address,
    basisSyncError,
    cancellationCandidates,
    classId,
    clearFormalComments,
    closeEditor,
    closeExcelImport,
    completedCandidates,
    conductBlockedCount,
    conductConflictCount,
    conductMissingCount,
    conductPreflightError,
    confirmCandidates,
    counts,
    discardImportedDraft,
    discardImportedDrafts,
    editor,
    editorDirty,
    editorStudent,
    errorMessage,
    filter,
    generateAction,
    generationCandidates,
    generationDisabledReason,
    generationOpen,
    handleBasisSync,
    handleCancelGeneration,
    handleContinueMaterialMappings,
    handleContinueMaterialSheet,
    handleGenerate,
    handleMaterialFileSelected,
    importOpen,
    importedCandidates,
    importedDraftStudentIds,
    importedDrafts,
    isBatchRunning,
    isCheckingConductBasis,
    isDirty,
    isEditorSaving,
    isGraduation,
    isImportingMaterial,
    isLoading,
    isLoadingStyleReferences,
    isOffCampusInternship,
    isSyncingBasis,
    issuesByStudentId,
    length,
    materialFile,
    materialIdentitySelections,
    materialImportError,
    materialImportResult,
    materialSelectedSheet,
    openEditor,
    openExcelImport,
    previousTerm,
    reloadCurrentWorkspace,
    requestScopeChange,
    reviewCandidates,
    runDraftBatch,
    saveEditor,
    saveImportedDrafts,
    searchText,
    selectedConductBlockedCount,
    selectedStudentIds,
    semesterId,
    setAddress,
    setEditor,
    setFilter,
    setGenerationOpen,
    setLength,
    setMaterialIdentitySelections,
    setMaterialImportError,
    setMaterialSelectedSheet,
    setSearchText,
    setSelectedStudentIds,
    setStyleExampleStudentIds,
    setTone,
    styleExampleStudentIds,
    styleOptions,
    tone,
    upstreamLoginModalProps,
    visibleStudents,
    workspace,
    writeAction,
    upstreamSession,
  };
}

function resolveProductErrorMessage(error: unknown) {
  if (hasGraphQLCategory(error, 'FORBIDDEN')) return '当前账号没有该班级的评语编辑权限。';
  if (hasGraphQLCategory(error, 'BAD_USER_INPUT')) return '范围或提交内容无效，请刷新后重试。';
  if (hasGraphQLCategory(error, 'CONFLICT')) return '评语状态已变化，请刷新后重新操作。';
  if (isGraphQLIngressError(error)) return error.userMessage;
  return error instanceof Error ? error.message : '请求失败，请稍后重试。';
}
