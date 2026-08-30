// src/labs/student-evaluation-comment-workbench/ui/product-workbench.tsx

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckOutlined,
  CloudSyncOutlined,
  DeleteOutlined,
  EditOutlined,
  FileExcelOutlined,
  LoginOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  Modal,
  Progress,
  Segmented,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType, TableRowSelection } from 'antd/es/table/interface';
import { Link, useBlocker } from 'react-router';

import { AcademicTermTabs } from '@/entities/academic-semester';
import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
  type StoredUpstreamSession,
  UpstreamLoginModal,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import { hasGraphQLCategory, isGraphQLIngressError } from '@/shared/graphql';
import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

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
} from '../application/workbench-model';
import {
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
  StudentEvaluationCommentWorkbench,
  StudentEvaluationCommentWorkbenchLoaderData,
  StudentEvaluationCommentWorkbenchStudent,
} from '../types';

import { StudentEvaluationCommentExcelImportDialog } from './excel-import-dialog';

type ProductWorkbenchProps = {
  currentAccount: StudentEvaluationCommentWorkbenchLoaderData['currentAccount'];
};

type EditorState = {
  baseline: string;
  content: string;
  studentId: string;
};

type BasisSyncRequest = {
  classId: string;
  scopeKey: string;
  semesterId: number;
};

const STATUS_OPTIONS: Array<{ label: string; value: StudentEvaluationCommentWorkflowStatus }> = [
  { label: '全部', value: 'ALL' },
  { label: '待处理', value: 'TODO' },
  { label: '生成中', value: 'GENERATING' },
  { label: '待审阅', value: 'REVIEW' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '问题', value: 'ISSUE' },
];

const STATUS_PRESENTATION = {
  TODO: { color: 'default', label: '待处理' },
  GENERATING: { color: 'processing', label: '生成中' },
  REVIEW: { color: 'blue', label: '待审阅' },
  COMPLETED: { color: 'success', label: '已完成' },
  ISSUE: { color: 'error', label: '需要处理' },
} as const;

const TONE_OPTIONS = [
  { label: '温暖鼓励', value: 'WARM_ENCOURAGING' },
  { label: '客观平衡', value: 'OBJECTIVE_BALANCED' },
  { label: '简洁直接', value: 'CONCISE_DIRECT' },
] as const;
const LENGTH_OPTIONS = [
  { label: '80–120 字', value: 'CHARS_80_120' },
  { label: '120–180 字', value: 'CHARS_120_180' },
  { label: '180–260 字', value: 'CHARS_180_260' },
] as const;
const ADDRESS_OPTIONS = [
  { label: '第二人称', value: 'SECOND_PERSON' },
  { label: '第三人称', value: 'THIRD_PERSON' },
] as const;

export function StudentEvaluationCommentProductWorkbench({
  currentAccount,
}: ProductWorkbenchProps) {
  const { message, modal } = AntApp.useApp();
  const [activeCommentKind, setActiveCommentKind] = useState<StudentEvaluationCommentKind>('TERM');
  const [workspace, setWorkspace] = useState<StudentEvaluationCommentWorkbench | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
  useUnsavedProductWorkbenchProtection(
    editorDirty || importedDraftStudentIds.size > 0 || hasPendingMaterialImport,
  );

  useEffect(() => {
    scopeKeyRef.current = scopeKey;
  }, [scopeKey]);

  const applyWorkspace = useCallback((next: StudentEvaluationCommentWorkbench) => {
    setWorkspace(next);
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
      semesterId?: number;
    }) => {
      setIsLoading(true);
      setIsCheckingConductBasis(input.commentKind === 'TERM');
      setErrorMessage(null);
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

        applyWorkspace(next);
        setConductIssuesByStudentId(nextConductIssues);
        setConductPreflightError(nextConductPreflightError);
        return next;
      } catch (error) {
        setErrorMessage(resolveProductErrorMessage(error));
        return null;
      } finally {
        setIsCheckingConductBasis(false);
        setIsLoading(false);
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

  const reloadCurrentWorkspace = useCallback(async () => {
    if (!classId) return loadWorkspace({ commentKind: activeCommentKind });
    if (isGraduation) return loadWorkspace({ classId, commentKind: 'GRADUATION' });
    if (semesterId === null) return loadWorkspace({ classId, commentKind: 'TERM' });
    return loadWorkspace({ classId, commentKind: 'TERM', semesterId });
  }, [activeCommentKind, classId, isGraduation, loadWorkspace, semesterId]);

  useEffect(() => {
    if (!students.some((student) => student.isAiDraftGenerating)) return;
    const timerId = window.setTimeout(() => void reloadCurrentWorkspace(), 4_000);
    return () => window.clearTimeout(timerId);
  }, [reloadCurrentWorkspace, students]);

  const clearMaterialImportSession = useCallback(() => {
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
        !(await requestConfirmation(modal, {
          content: '切换后会放弃当前尚未保存的编辑和 Excel 导入草稿。',
          okText: '放弃并切换',
          title: '切换评语范围？',
        }))
      ) {
        return;
      }
      setEditor(null);
      setSelectedStudentIds([]);
      setIssuesByStudentId({});
      setConductIssuesByStudentId({});
      setConductPreflightError(null);
      setImportedDrafts({});
      setImportOpen(false);
      clearMaterialImportSession();
      setStyleExampleStudentIds([]);
      setFilter('ALL');
      const nextCommentKind = next.commentKind ?? activeCommentKind;
      const loaded = await loadWorkspace({
        classId: next.classId,
        commentKind: nextCommentKind,
        ...(nextCommentKind === 'TERM' && next.semesterId !== undefined
          ? { semesterId: next.semesterId }
          : {}),
      });
      if (loaded) setActiveCommentKind(nextCommentKind);
    },
    [
      clearMaterialImportSession,
      editorDirty,
      importedDraftStudentIds.size,
      hasPendingMaterialImport,
      loadWorkspace,
      modal,
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
        !student.isAiDraftGenerating &&
        !importedDraftStudentIds.has(student.studentId)
      ) {
        issues[student.studentId] = issue;
      }
    });

    return issues;
  }, [conductIssuesByStudentId, importedDraftStudentIds, students]);
  const issuesByStudentId = useMemo(
    () => ({ ...generationIssuesByStudentId, ...actionableConductIssuesByStudentId }),
    [actionableConductIssuesByStudentId, generationIssuesByStudentId],
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
      }) === 'TODO',
  );
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
      setEditor({ baseline: content, content, studentId: student.studentId });
    },
    [importedDrafts],
  );

  const closeEditor = useCallback(async () => {
    if (
      editorDirty &&
      !(await requestConfirmation(modal, {
        content: '关闭后会放弃当前尚未保存的文本。',
        okText: '放弃修改',
        title: '关闭评语编辑？',
      }))
    ) {
      return;
    }
    setEditor(null);
  }, [editorDirty, modal]);

  const closeExcelImport = useCallback(() => {
    if (isImportingMaterial) return;
    setImportOpen(false);
    clearMaterialImportSession();
  }, [clearMaterialImportSession, isImportingMaterial]);

  const openExcelImport = useCallback(async () => {
    if (!writeAction?.allowed) return;
    if (
      editorDirty &&
      !(await requestConfirmation(modal, {
        content: '打开导入后会放弃当前编辑框里尚未保存的修改。',
        okText: '放弃并导入',
        title: '打开 Excel 导入？',
      }))
    ) {
      return;
    }
    if (
      importedDraftStudentIds.size > 0 &&
      !(await requestConfirmation(modal, {
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
  }, [clearMaterialImportSession, editorDirty, importedDraftStudentIds.size, modal, writeAction]);

  const runMaterialImport = useCallback(
    async (input: {
      file: File;
      identityMappings?: readonly StudentEvaluationCommentMaterialIdentityMappingInput[];
      selectedSheet?: string;
    }) => {
      if (!classId || semesterId === null || !writeAction?.allowed) return;

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

        const knownStudentIds = new Set(students.map((student) => student.studentId));
        if (result.previewRows.some((row) => !knownStudentIds.has(row.studentId))) {
          throw new Error('导入结果包含当前班级之外的学生，请刷新后重试。');
        }
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
        setMaterialImportError(resolveProductErrorMessage(error));
      } finally {
        setIsImportingMaterial(false);
      }
    },
    [classId, clearMaterialImportSession, message, semesterId, students, writeAction?.allowed],
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
      !(await requestConfirmation(modal, {
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
  }, [classId, importedCandidates, message, modal, reloadCurrentWorkspace, semesterId]);

  const discardImportedDrafts = useCallback(async () => {
    if (
      importedDraftStudentIds.size === 0 ||
      !(await requestConfirmation(modal, {
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
  }, [importedDraftStudentIds.size, message, modal]);

  const discardImportedDraft = useCallback(
    async (studentId: string) => {
      if (
        !(await requestConfirmation(modal, {
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
    [modal],
  );

  const saveEditor = useCallback(async () => {
    if (!editor || !editorStudent || !classId || (!isGraduation && semesterId === null)) return;
    const content = normalizeStudentEvaluationCommentContent(editor.content);
    const codePoints = countStudentEvaluationCommentCodePoints(content);
    if (!content || codePoints > STUDENT_EVALUATION_COMMENT_MAX_CODE_POINTS) return;

    setIsEditorSaving(true);
    try {
      const importedDraft = importedDrafts[editorStudent.studentId];
      if (importedDraft) {
        setImportedDrafts((current) => ({
          ...current,
          [editorStudent.studentId]: { ...importedDraft, content },
        }));
        message.success('Excel 草稿已更新，尚未写入正式评语。');
      } else if (editorStudent.aiDraft) {
        if (isGraduation) {
          await saveStudentGraduationEvaluationCommentProductDraft({
            classId,
            content,
            draftId: editorStudent.aiDraft.draftId,
            expectedRevision: editorStudent.aiDraft.revision,
          });
        } else if (semesterId !== null) {
          await saveStudentEvaluationCommentProductDraft({
            classId,
            content,
            draftId: editorStudent.aiDraft.draftId,
            expectedRevision: editorStudent.aiDraft.revision,
            semesterId,
          });
        }
        message.success('AI 草稿已保存。');
      } else {
        if (isGraduation) {
          await writeStudentGraduationEvaluationCommentProductComment({
            classId,
            content,
            expectedRevision: editorStudent.comment?.revision ?? null,
            studentId: editorStudent.studentId,
          });
        } else if (semesterId !== null) {
          await writeStudentEvaluationCommentProductComment({
            classId,
            content,
            expectedRevision: editorStudent.comment?.revision ?? null,
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
      const confirmed = await requestConfirmation(modal, {
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
    [classId, isGraduation, message, modal, reloadCurrentWorkspace, reviewCandidates, semesterId],
  );

  const clearFormalComments = useCallback(async () => {
    if (!classId || (!isGraduation && semesterId === null) || completedCandidates.length === 0) {
      return;
    }
    if (
      !(await requestConfirmation(modal, {
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
    modal,
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
      await reloadCurrentWorkspace();
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
      if (pendingAction) setQueuedBasisSync({ request: pendingAction, session });
    },
  });

  const runBasisSync = useCallback(
    async (session: StoredUpstreamSession, request: BasisSyncRequest) => {
      if (isOffCampusInternship || scopeKeyRef.current !== request.scopeKey) return;
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
        const failures = conduct.failureCount + courses.failedStudentCount;
        message[failures ? 'warning' : 'success'](
          failures
            ? `依据已更新，另有 ${failures} 条数据需要检查。`
            : `已更新 ${conduct.writtenStudentCount} 名操行依据和 ${courses.studentCount} 名成绩依据。`,
        );
        setIssuesByStudentId({});
        await reloadCurrentWorkspace();
      };

      setIsSyncingBasis(true);
      setBasisSyncError(null);
      try {
        await executeSync(session);
      } catch (error) {
        if (!isExpiredUpstreamSessionError(error)) {
          setBasisSyncError(resolveUpstreamErrorMessage(error, '暂时无法更新生成依据。'));
          return;
        }
        try {
          const refreshed = await refreshSession(latestSession);
          await executeSync(refreshed);
        } catch (retryError) {
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
    const request = { classId, scopeKey, semesterId };
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

  const columns = useMemo<ColumnsType<StudentEvaluationCommentWorkbenchStudent>>(
    () => [
      {
        render: (_, student) => (
          <Space orientation="vertical" size={0}>
            <span>{student.studentName}</span>
            <span className="text-xs text-text-secondary">{student.studentId}</span>
          </Space>
        ),
        title: '学生',
        width: 170,
      },
      {
        render: (_, student) => {
          const isImported = importedDraftStudentIds.has(student.studentId);
          const status = resolveStudentEvaluationCommentWorkflowStatus({
            hasWorkingDraft: isImported,
            issueCode: issuesByStudentId[student.studentId],
            student,
          });
          const presentation = STATUS_PRESENTATION[status];
          return isImported ? (
            <Tag color="purple">Excel 草稿</Tag>
          ) : (
            <Tag color={presentation.color}>{presentation.label}</Tag>
          );
        },
        title: '进度',
        width: 110,
      },
      {
        render: (_, student) => {
          const content =
            importedDrafts[student.studentId]?.content ??
            student.aiDraft?.content ??
            student.comment?.content;
          if (!content) {
            const issueCode = issuesByStudentId[student.studentId];
            return issueCode ? (
              <span className="text-text-secondary">
                <StudentEvaluationCommentIssueMessage
                  classId={classId}
                  issueCode={issueCode}
                  semesterId={semesterId}
                />
              </span>
            ) : (
              <span className="text-text-secondary">
                {isGraduation ? '尚未填写毕业鉴定' : '尚未填写评语'}
              </span>
            );
          }
          return <span className="line-clamp-2 whitespace-pre-wrap break-words">{content}</span>;
        },
        title: '当前内容',
        width: 520,
      },
      {
        render: (_, student) => (
          <Button icon={<EditOutlined />} size="small" onClick={() => openEditor(student)}>
            {importedDraftStudentIds.has(student.studentId) || student.aiDraft
              ? '审阅'
              : student.comment
                ? '编辑'
                : '填写'}
          </Button>
        ),
        title: '操作',
        width: 100,
      },
    ],
    [
      classId,
      importedDraftStudentIds,
      importedDrafts,
      isGraduation,
      issuesByStudentId,
      openEditor,
      semesterId,
    ],
  );

  const rowSelection = useMemo<TableRowSelection<StudentEvaluationCommentWorkbenchStudent>>(
    () => ({
      onChange: (keys) => setSelectedStudentIds(keys.map(String)),
      preserveSelectedRowKeys: true,
      selectedRowKeys: selectedStudentIds,
    }),
    [selectedStudentIds],
  );

  const editorLength = editor ? countStudentEvaluationCommentCodePoints(editor.content) : 0;
  const editorInvalid =
    !editor ||
    normalizeStudentEvaluationCommentContent(editor.content).length === 0 ||
    editorLength > STUDENT_EVALUATION_COMMENT_MAX_CODE_POINTS;
  const editorStatus = editorStudent
    ? resolveStudentEvaluationCommentWorkflowStatus({
        hasWorkingDraft: importedDraftStudentIds.has(editorStudent.studentId),
        issueCode: issuesByStudentId[editorStudent.studentId],
        student: editorStudent,
      })
    : null;
  const editorDraftUnavailable = Boolean(editorStudent?.aiDraft && editorStatus === 'ISSUE');
  const editorIsImported = Boolean(
    editorStudent && importedDraftStudentIds.has(editorStudent.studentId),
  );
  const completedPercent = counts.ALL ? Math.round((counts.COMPLETED / counts.ALL) * 100) : 0;

  if (isLoading && !workspace) {
    return <Card loading />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card size="small">
        <ResponsiveGrid className="gap-4" columns={{ compact: 1, regular: 2, wide: 3 }}>
          <div>
            <div className="mb-2">班级</div>
            <Select
              loading={isLoading}
              optionFilterProp="label"
              options={(workspace?.classOptions ?? []).map((item) => ({
                label: `${item.className} · ${item.classCode}`,
                value: item.classId,
              }))}
              placeholder="选择班级"
              showSearch
              style={{ width: '100%' }}
              value={workspace?.selectedClass?.classId}
              onChange={(nextClassId) =>
                void requestScopeChange({ classId: nextClassId, commentKind: activeCommentKind })
              }
            />
          </div>
          <div className="flex items-end">
            <Space wrap>
              <Button
                icon={<ReloadOutlined />}
                loading={isLoading}
                onClick={() => void reloadCurrentWorkspace()}
              >
                刷新
              </Button>
              {!isGraduation && !isOffCampusInternship ? (
                <Button
                  icon={upstreamSession ? <CloudSyncOutlined /> : <LoginOutlined />}
                  loading={isSyncingBasis}
                  onClick={handleBasisSync}
                >
                  更新生成依据
                </Button>
              ) : null}
            </Space>
          </div>
          <div>
            <div className="mb-2">{isGraduation ? '毕业鉴定完成度' : '当前学期完成度'}</div>
            <Space style={{ width: '100%' }}>
              <Progress percent={completedPercent} showInfo={false} size="small" />
              <span>{`${counts.COMPLETED} / ${counts.ALL}`}</span>
            </Space>
          </div>
        </ResponsiveGrid>
      </Card>

      {errorMessage ? <Alert showIcon title={errorMessage} type="error" /> : null}
      {!isGraduation && !isOffCampusInternship && basisSyncError ? (
        <Alert closable showIcon title={basisSyncError} type="warning" />
      ) : null}
      {workspace?.warnings.map((warning) => (
        <Alert
          key={`${warning.code}-${warning.schoolYear}-${warning.termNumber}`}
          closable
          showIcon
          title={warning.message}
          type="warning"
        />
      ))}

      <Tabs
        activeKey={activeCommentKind}
        items={[
          { disabled: isLoading || isBatchRunning, key: 'TERM', label: '学期评语' },
          { disabled: isLoading || isBatchRunning, key: 'GRADUATION', label: '毕业鉴定' },
        ]}
        onChange={(nextCommentKind) =>
          void requestScopeChange({
            classId,
            commentKind: nextCommentKind as StudentEvaluationCommentKind,
          })
        }
      />

      {workspace?.selectedClass ? (
        <StudentEvaluationCommentScope
          activeSemesterId={workspace.selectedTerm?.semesterId}
          commentKind={activeCommentKind}
          disabled={isLoading || isBatchRunning}
          records={workspace.termOptions}
          onChange={(nextSemesterId) =>
            void requestScopeChange({
              classId: workspace.selectedClass?.classId ?? '',
              commentKind: 'TERM',
              semesterId: nextSemesterId,
            })
          }
        >
          <Card
            extra={
              <Space wrap>
                {!isGraduation ? (
                  <Button
                    disabled={!writeAction?.allowed || isBatchRunning}
                    icon={<FileExcelOutlined />}
                    onClick={() => void openExcelImport()}
                  >
                    Excel 导入
                  </Button>
                ) : null}
                {!isGraduation && importedCandidates.length > 0 ? (
                  <>
                    <Button
                      icon={<SaveOutlined />}
                      loading={isBatchRunning}
                      type="primary"
                      onClick={() => void saveImportedDrafts()}
                    >
                      保存导入 {importedCandidates.length}
                    </Button>
                    <Button disabled={isBatchRunning} onClick={() => void discardImportedDrafts()}>
                      撤销导入
                    </Button>
                  </>
                ) : null}
                <Tooltip title={generationDisabledReason}>
                  <Button
                    disabled={
                      (!isGraduation && !isOffCampusInternship && isCheckingConductBasis) ||
                      !generateAction?.allowed ||
                      generationCandidates.length === 0
                    }
                    icon={<RobotOutlined />}
                    onClick={() => setGenerationOpen(true)}
                  >
                    {`AI 生成 ${generationCandidates.length || ''}`.trim()}
                  </Button>
                </Tooltip>
                <Button
                  disabled={confirmCandidates.length === 0}
                  icon={<CheckOutlined />}
                  loading={isBatchRunning}
                  type="primary"
                  onClick={() => void runDraftBatch('confirm', confirmCandidates)}
                >
                  {`确认 AI ${confirmCandidates.length || ''}`.trim()}
                </Button>
                <Button
                  danger
                  disabled={reviewCandidates.length === 0}
                  icon={<DeleteOutlined />}
                  loading={isBatchRunning}
                  onClick={() => void runDraftBatch('discard')}
                >
                  放弃 AI 草稿
                </Button>
                <Button
                  danger
                  disabled={!writeAction?.allowed || completedCandidates.length === 0}
                  icon={<DeleteOutlined />}
                  loading={isBatchRunning}
                  onClick={() => void clearFormalComments()}
                >
                  {`删除正式${isGraduation ? '毕业鉴定' : '评语'} ${completedCandidates.length || ''}`.trim()}
                </Button>
              </Space>
            }
            title={isGraduation ? '毕业鉴定' : (workspace.selectedTerm?.label ?? '学期评语')}
          >
            <div className="flex flex-col gap-4">
              {!isGraduation && !isOffCampusInternship && conductBlockedCount > 0 ? (
                <Alert
                  showIcon
                  action={
                    <Button
                      icon={<CloudSyncOutlined />}
                      loading={isSyncingBasis}
                      size="small"
                      onClick={handleBasisSync}
                    >
                      更新生成依据
                    </Button>
                  }
                  description="已在学生列表中标记并排除出 AI 生成批次；更新依据后会自动重新检查，也可直接人工填写。"
                  title={buildConductBasisAlertTitle({
                    conflictCount: conductConflictCount,
                    missingCount: conductMissingCount,
                  })}
                  type="warning"
                />
              ) : null}
              {!isGraduation && !isOffCampusInternship && conductPreflightError ? (
                <Alert closable showIcon title={conductPreflightError} type="warning" />
              ) : null}
              {!isGraduation && isOffCampusInternship ? (
                <Alert
                  showIcon
                  description="本场景不读取操行、课程成绩或上一学期风格样例，只生成围绕安全意识、职业规范、沟通协作和未来成长的一般性期许。生成结果仍需老师审阅确认。"
                  title="最后学期按下厂/校外实习场景治理"
                  type="info"
                />
              ) : null}
              {isGraduation ? (
                <Alert
                  showIcon
                  description="正常在读学生生成前须具备全部应有学期的正式评语，实际生成只采用最近三学期；复学学生不受完整性限制，尽力采用最近三学期，但至少需要两学期。生成结果仍需老师审阅确认。"
                  title="毕业鉴定按历史学期评语生成"
                  type="info"
                />
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Segmented
                  options={STATUS_OPTIONS.map((item) => ({
                    label: `${item.label} ${counts[item.value]}`,
                    value: item.value,
                  }))}
                  value={filter}
                  onChange={(value) => setFilter(value as StudentEvaluationCommentWorkflowStatus)}
                />
                <Input.Search
                  allowClear
                  placeholder="搜索姓名或学号"
                  style={{ width: 240 }}
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </div>
              {selectedStudentIds.length ? (
                <span className="text-sm text-text-secondary">
                  已选择 {selectedStudentIds.length} 人；批量操作只处理其中符合条件的学生。
                </span>
              ) : null}
              <Table
                columns={columns}
                dataSource={visibleStudents}
                loading={isLoading}
                locale={{ emptyText: <Empty description="当前筛选下没有学生" /> }}
                pagination={{
                  defaultPageSize: 60,
                  pageSizeOptions: [30, 60],
                  showSizeChanger: true,
                }}
                rowKey="studentId"
                rowSelection={rowSelection}
                scroll={{ x: 920 }}
              />
            </div>
          </Card>
        </StudentEvaluationCommentScope>
      ) : (
        <Empty description="当前账号没有可操作的班级评语范围" />
      )}

      <Drawer
        destroyOnHidden
        extra={
          <Space>
            {editorIsImported && editorStudent ? (
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => void discardImportedDraft(editorStudent.studentId)}
              >
                移除导入草稿
              </Button>
            ) : editorStudent?.aiDraft ? (
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => void runDraftBatch('discard', [editorStudent])}
              >
                放弃草稿
              </Button>
            ) : null}
            <Button
              disabled={
                !editorDirty || editorInvalid || editorDraftUnavailable || !writeAction?.allowed
              }
              icon={<SaveOutlined />}
              loading={isEditorSaving}
              type="primary"
              onClick={() => void saveEditor()}
            >
              {editorIsImported
                ? '保存草稿修改'
                : editorStudent?.aiDraft
                  ? '保存草稿'
                  : `保存正式${isGraduation ? '毕业鉴定' : '评语'}`}
            </Button>
          </Space>
        }
        open={Boolean(editor && editorStudent)}
        size="large"
        title={
          editorStudent
            ? `${editorStudent.studentName} · ${editorStudent.studentId}`
            : isGraduation
              ? '毕业鉴定'
              : '评语'
        }
        onClose={() => void closeEditor()}
      >
        {editor && editorStudent ? (
          <div className="flex flex-col gap-4">
            <Space wrap>
              <WorkflowStatusTag
                hasWorkingDraft={editorIsImported}
                issueCode={issuesByStudentId[editorStudent.studentId]}
                student={editorStudent}
              />
              <Tag>
                {editorIsImported
                  ? 'Excel 草稿'
                  : editorStudent.aiDraft
                    ? 'AI 草稿'
                    : `正式${isGraduation ? '毕业鉴定' : '评语'}`}
              </Tag>
            </Space>
            {issuesByStudentId[editorStudent.studentId] ? (
              <Alert
                showIcon
                description={
                  isGraduation
                    ? '补齐历史学期评语后可重新生成，也可以直接人工填写正式毕业鉴定。'
                    : '可以更新生成依据后重新生成，也可以直接人工填写正式评语。'
                }
                title={
                  <StudentEvaluationCommentIssueMessage
                    classId={classId}
                    issueCode={issuesByStudentId[editorStudent.studentId] ?? ''}
                    semesterId={semesterId}
                  />
                }
                type="warning"
              />
            ) : null}
            {editorDraftUnavailable ? (
              <Alert
                showIcon
                description="过期草稿不能继续保存或确认为正式评语，仍可直接放弃。"
                title="AI 草稿已经过期"
                type="warning"
              />
            ) : null}
            <Input.TextArea
              autoSize={{ maxRows: 18, minRows: 12 }}
              showCount={{ formatter: () => `${editorLength} / 1000` }}
              status={editorInvalid ? 'error' : undefined}
              value={editor.content}
              onChange={(event) =>
                setEditor((current) =>
                  current ? { ...current, content: event.target.value } : current,
                )
              }
            />
            {editorStudent.aiDraft &&
            !editorIsImported &&
            !editorDirty &&
            editorStatus === 'REVIEW' ? (
              <Button
                icon={<CheckOutlined />}
                loading={isBatchRunning}
                type="primary"
                onClick={() => void runDraftBatch('confirm', [editorStudent])}
              >
                {`确认为正式${isGraduation ? '毕业鉴定' : '评语'}`}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      <Modal
        confirmLoading={isBatchRunning}
        okButtonProps={{
          disabled:
            (!isGraduation && !isOffCampusInternship && isCheckingConductBasis) ||
            generationCandidates.length === 0,
        }}
        okText={`生成 ${generationCandidates.length} 名学生草稿`}
        open={generationOpen}
        title={isGraduation ? '生成毕业鉴定草稿' : 'AI 生成设置'}
        onCancel={() => setGenerationOpen(false)}
        onOk={() => void handleGenerate()}
      >
        <div className="flex flex-col gap-4 py-3">
          {isGraduation ? (
            <Alert
              showIcon
              description="系统会逐人检查生成资格。正常在读学生必须已有全部应有学期的正式评语；复学学生至少需要两学期。符合条件时只采用最近三学期作为生成依据。"
              title={`将为所选的 ${generationCandidates.length} 名学生检查并生成草稿`}
              type="info"
            />
          ) : (
            <>
              {!isOffCampusInternship && selectedConductBlockedCount > 0 ? (
                <Alert
                  showIcon
                  title={`所选学生中有 ${selectedConductBlockedCount} 人缺少可用的已确认操行等第，本次不会生成。`}
                  type="warning"
                />
              ) : null}
              {isOffCampusInternship ? (
                <Alert
                  showIcon
                  title="下厂/校外实习场景不使用操行、课程成绩或风格样例。"
                  type="info"
                />
              ) : null}
              <ResponsiveGrid className="gap-3" columns={{ compact: 1, regular: 3, wide: 3 }}>
                <Select options={[...TONE_OPTIONS]} value={tone} onChange={setTone} />
                <Select options={[...LENGTH_OPTIONS]} value={length} onChange={setLength} />
                <Select options={[...ADDRESS_OPTIONS]} value={address} onChange={setAddress} />
              </ResponsiveGrid>
              {!isOffCampusInternship && (workspace?.selectedTerm?.sequence ?? 1) > 1 ? (
                <div>
                  <div className="mb-2">
                    上一学期评语语气参考
                    {previousTerm ? `（${previousTerm.label}，可选，最多 5 人）` : '（可选）'}
                  </div>
                  {isLoadingStyleReferences || styleOptions.length > 0 ? (
                    <Select
                      allowClear
                      loading={isLoadingStyleReferences}
                      maxCount={5}
                      mode="multiple"
                      optionFilterProp="label"
                      options={styleOptions}
                      placeholder="从上一学期已有正式评语中选择"
                      style={{ width: '100%' }}
                      value={styleExampleStudentIds}
                      onChange={setStyleExampleStudentIds}
                    />
                  ) : (
                    <Alert
                      showIcon
                      title="上一学期暂无可用正式评语，本次生成将不使用语气参考。"
                      type="info"
                    />
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </Modal>

      <StudentEvaluationCommentExcelImportDialog
        className={workspace?.selectedClass?.className ?? ''}
        errorMessage={materialImportError}
        file={materialFile}
        identitySelections={materialIdentitySelections}
        isImporting={isImportingMaterial}
        open={importOpen}
        result={materialImportResult}
        selectedSheet={materialSelectedSheet}
        termLabel={workspace?.selectedTerm?.label ?? ''}
        onClose={closeExcelImport}
        onContinueIdentityMappings={handleContinueMaterialMappings}
        onContinueSheet={handleContinueMaterialSheet}
        onFileSelected={handleMaterialFileSelected}
        onIdentitySelectionChange={(mappingKey, studentId) =>
          setMaterialIdentitySelections((current) => ({
            ...current,
            [mappingKey]: studentId,
          }))
        }
        onRejectFile={setMaterialImportError}
        onSelectedSheetChange={setMaterialSelectedSheet}
      />

      <UpstreamLoginModal {...upstreamLoginModalProps} />
    </div>
  );
}

function StudentEvaluationCommentScope({
  activeSemesterId,
  children,
  commentKind,
  disabled,
  records,
  onChange,
}: {
  activeSemesterId?: number;
  children: ReactNode;
  commentKind: StudentEvaluationCommentKind;
  disabled: boolean;
  records: StudentEvaluationCommentWorkbench['termOptions'];
  onChange: (semesterId: number) => void;
}) {
  if (commentKind === 'GRADUATION') return children;

  return (
    <AcademicTermTabs
      activeSemesterId={activeSemesterId}
      disabled={disabled}
      records={records}
      onChange={onChange}
    >
      {children}
    </AcademicTermTabs>
  );
}

function WorkflowStatusTag(input: {
  hasWorkingDraft?: boolean;
  issueCode?: string;
  student: StudentEvaluationCommentWorkbenchStudent;
}) {
  const status = resolveStudentEvaluationCommentWorkflowStatus(input);
  const presentation = STATUS_PRESENTATION[status];
  return <Tag color={presentation.color}>{presentation.label}</Tag>;
}

function resolveStudentEvaluationCommentIssueMessage(issueCode: string) {
  if (issueCode === 'CONDUCT_GRADE_MISSING') {
    return '缺少已确认的操行等第，暂不能 AI 生成';
  }
  if (issueCode === 'CONDUCT_GRADE_CONFLICT') {
    return '操行补正状态已变化，请更新生成依据后再生成';
  }
  if (issueCode === 'TERM_COMMENTS_INCOMPLETE') {
    return '该生应有学期评语尚未全部完成，暂不能生成毕业鉴定';
  }
  if (issueCode === 'ENTRY_BASIS_INSUFFICIENT') {
    return '该复学学生可用的正式学期评语不足两学期，暂不能生成毕业鉴定';
  }
  if (issueCode === 'BASIS_UNAVAILABLE') {
    return '暂时无法读取该生的历史学期评语，请刷新后重试';
  }
  if (issueCode === 'BASIS_TOO_LARGE') {
    return '该生历史评语依据超出生成限制，请联系管理员检查';
  }
  return 'AI 生成依据尚未完整，可更新依据或直接人工填写';
}

function StudentEvaluationCommentIssueMessage({
  classId,
  issueCode,
  semesterId,
}: {
  classId: string;
  issueCode: string;
  semesterId: number | null;
}) {
  const message = resolveStudentEvaluationCommentIssueMessage(issueCode);
  const searchParams = new URLSearchParams();

  if (classId) searchParams.set('classId', classId);
  if (semesterId !== null) searchParams.set('semesterId', String(semesterId));
  const conductAlignmentPath = `/class-affairs/student-conduct-alignment?${searchParams.toString()}`;

  return issueCode === 'CONDUCT_GRADE_MISSING' || issueCode === 'CONDUCT_GRADE_CONFLICT' ? (
    <Link to={conductAlignmentPath}>{message}</Link>
  ) : (
    message
  );
}

function buildConductBasisAlertTitle(input: { conflictCount: number; missingCount: number }) {
  if (input.missingCount > 0 && input.conflictCount > 0) {
    return `${input.missingCount} 名待处理学生缺少已确认操行等第，另有 ${input.conflictCount} 名操行补正需要处理。`;
  }
  if (input.conflictCount > 0) {
    return `${input.conflictCount} 名待处理学生的操行补正状态已变化，暂不能 AI 生成。`;
  }
  return `${input.missingCount} 名待处理学生缺少已确认的操行等第，暂不能 AI 生成。`;
}

function requestConfirmation(
  modal: ReturnType<typeof AntApp.useApp>['modal'],
  input: { content: string; danger?: boolean; okText: string; title: string },
) {
  return new Promise<boolean>((resolve) => {
    modal.confirm({
      cancelText: '取消',
      content: input.content,
      okButtonProps: input.danger ? { danger: true } : undefined,
      okText: input.okText,
      onCancel: () => resolve(false),
      onOk: () => resolve(true),
      title: input.title,
    });
  });
}

function useUnsavedProductWorkbenchProtection(isDirty: boolean) {
  const { modal } = AntApp.useApp();
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const confirmation = modal.confirm({
      cancelText: '留在当前页',
      content: '离开后将丢失当前尚未保存的编辑或 Excel 导入草稿。',
      okButtonProps: { danger: true },
      okText: '离开页面',
      onCancel: () => blocker.reset(),
      onOk: () => blocker.proceed(),
      title: '存在未保存内容',
    });

    return () => confirmation.destroy();
  }, [blocker, modal]);
}

function resolveProductErrorMessage(error: unknown) {
  if (hasGraphQLCategory(error, 'FORBIDDEN')) return '当前账号没有该班级的评语编辑权限。';
  if (hasGraphQLCategory(error, 'BAD_USER_INPUT')) return '范围或提交内容无效，请刷新后重试。';
  if (hasGraphQLCategory(error, 'CONFLICT')) return '评语状态已变化，请刷新后重新操作。';
  if (isGraphQLIngressError(error)) return error.userMessage;
  return error instanceof Error ? error.message : '请求失败，请稍后重试。';
}
