// src/labs/student-evaluation-comment-workbench/ui/product-workbench.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType, TableRowSelection } from 'antd/es/table/interface';
import { useBlocker } from 'react-router';

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
  countStudentEvaluationCommentCodePoints,
  countStudentEvaluationCommentWorkflowStatuses,
  normalizeStudentEvaluationCommentContent,
  resolveStudentEvaluationCommentWorkflowStatus,
  STUDENT_EVALUATION_COMMENT_MAX_CODE_POINTS,
  type StudentEvaluationCommentWorkflowStatus,
} from '../application/workbench-model';
import {
  confirmStudentEvaluationCommentProductDrafts,
  discardStudentEvaluationCommentProductDrafts,
  generateStudentEvaluationCommentProductDrafts,
  getStudentEvaluationCommentProductWorkbench,
  importStudentEvaluationCommentProductMaterial,
  refreshStudentEvaluationCommentProductConductBasis,
  refreshStudentEvaluationCommentProductCourseBasis,
  saveStudentEvaluationCommentProductDraft,
  writeStudentEvaluationCommentProductComment,
  writeStudentEvaluationCommentProductComments,
} from '../infrastructure/api';
import type {
  StudentEvaluationCommentAiAddress,
  StudentEvaluationCommentAiLength,
  StudentEvaluationCommentAiTone,
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
  const [workspace, setWorkspace] = useState<StudentEvaluationCommentWorkbench | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<StudentEvaluationCommentWorkflowStatus>('ALL');
  const [searchText, setSearchText] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [issuesByStudentId, setIssuesByStudentId] = useState<Record<string, string>>({});
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
    async (input: { classId?: string; semesterId?: number } = {}) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const next = await getStudentEvaluationCommentProductWorkbench(input);
        applyWorkspace(next);
        return next;
      } catch (error) {
        setErrorMessage(resolveProductErrorMessage(error));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [applyWorkspace],
  );

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const reloadCurrentWorkspace = useCallback(async () => {
    if (!classId || semesterId === null) return loadWorkspace();
    return loadWorkspace({ classId, semesterId });
  }, [classId, loadWorkspace, semesterId]);

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
    async (next: { classId: string; semesterId?: number }) => {
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
      setImportedDrafts({});
      setImportOpen(false);
      clearMaterialImportSession();
      setStyleExampleStudentIds([]);
      setFilter('ALL');
      await loadWorkspace(next);
    },
    [
      clearMaterialImportSession,
      editorDirty,
      importedDraftStudentIds.size,
      hasPendingMaterialImport,
      loadWorkspace,
      modal,
    ],
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
  const reviewCandidates = selectedStudents.filter(
    (student) => Boolean(student.aiDraft) && !importedDraftStudentIds.has(student.studentId),
  );
  const confirmCandidates = reviewCandidates.filter(
    (student) => resolveStudentEvaluationCommentWorkflowStatus({ student }) === 'REVIEW',
  );
  const generateAction = workspace?.actions.find(
    (action) => action.action === 'GENERATE_AI_DRAFTS',
  );
  const writeAction = workspace?.actions.find((action) => action.action === 'WRITE_COMMENTS');
  const generationDisabledReason = !generateAction?.allowed
    ? (generateAction?.reasonMessage ?? '当前学期暂不可生成 AI 草稿')
    : generationCandidates.length === 0
      ? '请先选择待处理学生'
      : undefined;
  const styleOptions = students.flatMap((student) =>
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
    if (!editor || !editorStudent || semesterId === null || !classId) return;
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
        await saveStudentEvaluationCommentProductDraft({
          classId,
          content,
          draftId: editorStudent.aiDraft.draftId,
          expectedRevision: editorStudent.aiDraft.revision,
          semesterId,
        });
        message.success('AI 草稿已保存。');
      } else {
        await writeStudentEvaluationCommentProductComment({
          classId,
          content,
          expectedRevision: editorStudent.comment?.revision ?? null,
          semesterId,
          studentId: editorStudent.studentId,
        });
        setIssuesByStudentId((current) => {
          const next = { ...current };
          delete next[editorStudent.studentId];
          return next;
        });
        message.success('正式评语已保存。');
      }
      setEditor(null);
      if (!importedDraft) await reloadCurrentWorkspace();
    } catch (error) {
      message.error(resolveProductErrorMessage(error));
    } finally {
      setIsEditorSaving(false);
    }
  }, [classId, editor, editorStudent, importedDrafts, message, reloadCurrentWorkspace, semesterId]);

  const runDraftBatch = useCallback(
    async (action: 'confirm' | 'discard', candidates = reviewCandidates) => {
      if (!classId || semesterId === null || candidates.length === 0) return;
      const confirmed = await requestConfirmation(modal, {
        content:
          action === 'confirm'
            ? `将 ${candidates.length} 条草稿写入正式评语。`
            : `将永久删除 ${candidates.length} 条 AI 草稿。`,
        okText: action === 'confirm' ? '确认写入' : '确认放弃',
        title: action === 'confirm' ? '确认正式评语？' : '放弃 AI 草稿？',
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
          const result = await confirmStudentEvaluationCommentProductDrafts({
            classId,
            items,
            semesterId,
          });
          message.success(`已确认 ${result.confirmedCount} 条正式评语。`);
        } else {
          const result = await discardStudentEvaluationCommentProductDrafts({
            classId,
            items,
            semesterId,
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
    [classId, message, modal, reloadCurrentWorkspace, reviewCandidates, semesterId],
  );

  const handleGenerate = useCallback(async () => {
    if (!classId || semesterId === null || generationCandidates.length === 0) return;
    setIsBatchRunning(true);
    try {
      const result = await generateStudentEvaluationCommentProductDrafts({
        address,
        classId,
        length,
        semesterId,
        studentIds: generationCandidates.map((student) => student.studentId),
        styleExampleStudentIds,
        tone,
      });
      setIssuesByStudentId((current) => {
        const next = { ...current };
        result.items.forEach((item) => {
          if (item.disposition === 'BASIS_MISSING') next[item.studentId] = 'BASIS_MISSING';
          else delete next[item.studentId];
        });
        return next;
      });
      setGenerationOpen(false);
      setSelectedStudentIds([]);
      message.success(
        result.counts.accepted
          ? `已受理 ${result.counts.accepted} 名学生，完成后列表会自动更新。`
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
    generationCandidates,
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
      if (scopeKeyRef.current !== request.scopeKey) return;
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
    if (!classId || semesterId === null || !scopeKey) return;
    const request = { classId, scopeKey, semesterId };
    if (!upstreamSession) {
      openLoginModal({ pendingAction: request });
      return;
    }
    void runBasisSync(upstreamSession, request);
  }, [classId, openLoginModal, runBasisSync, scopeKey, semesterId, upstreamSession]);

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
            return issuesByStudentId[student.studentId] ? (
              <span className="text-text-secondary">生成依据尚未就绪，可人工填写或更新依据</span>
            ) : (
              <span className="text-text-secondary">尚未填写评语</span>
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
    [importedDraftStudentIds, importedDrafts, issuesByStudentId, openEditor],
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
              onChange={(nextClassId) => void requestScopeChange({ classId: nextClassId })}
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
              <Button
                icon={upstreamSession ? <CloudSyncOutlined /> : <LoginOutlined />}
                loading={isSyncingBasis}
                onClick={handleBasisSync}
              >
                更新生成依据
              </Button>
            </Space>
          </div>
          <div>
            <div className="mb-2">当前学期完成度</div>
            <Space style={{ width: '100%' }}>
              <Progress percent={completedPercent} showInfo={false} size="small" />
              <span>{`${counts.COMPLETED} / ${counts.ALL}`}</span>
            </Space>
          </div>
        </ResponsiveGrid>
      </Card>

      {errorMessage ? <Alert showIcon title={errorMessage} type="error" /> : null}
      {basisSyncError ? <Alert closable showIcon title={basisSyncError} type="warning" /> : null}
      {workspace?.warnings.map((warning) => (
        <Alert
          key={`${warning.code}-${warning.schoolYear}-${warning.termNumber}`}
          closable
          showIcon
          title={warning.message}
          type="warning"
        />
      ))}

      {workspace?.selectedClass ? (
        <AcademicTermTabs
          activeSemesterId={workspace.selectedTerm?.semesterId}
          disabled={isLoading || isBatchRunning}
          records={workspace.termOptions}
          onChange={(nextSemesterId) =>
            void requestScopeChange({
              classId: workspace.selectedClass?.classId ?? '',
              semesterId: nextSemesterId,
            })
          }
        >
          <Card
            extra={
              <Space wrap>
                <Button
                  disabled={!writeAction?.allowed || isBatchRunning}
                  icon={<FileExcelOutlined />}
                  onClick={() => void openExcelImport()}
                >
                  Excel 导入
                </Button>
                {importedCandidates.length > 0 ? (
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
                    disabled={!generateAction?.allowed || generationCandidates.length === 0}
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
              </Space>
            }
            title={workspace.selectedTerm?.label ?? '学期评语'}
          >
            <div className="flex flex-col gap-4">
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
                pagination={{ defaultPageSize: 20, showSizeChanger: true }}
                rowKey="studentId"
                rowSelection={rowSelection}
                scroll={{ x: 920 }}
              />
            </div>
          </Card>
        </AcademicTermTabs>
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
                  : '保存正式评语'}
            </Button>
          </Space>
        }
        open={Boolean(editor && editorStudent)}
        size="large"
        title={editorStudent ? `${editorStudent.studentName} · ${editorStudent.studentId}` : '评语'}
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
                {editorIsImported ? 'Excel 草稿' : editorStudent.aiDraft ? 'AI 草稿' : '正式评语'}
              </Tag>
            </Space>
            {issuesByStudentId[editorStudent.studentId] ? (
              <Alert
                showIcon
                description="可以更新生成依据后重新生成，也可以直接人工填写正式评语。"
                title="该学生缺少完整的 AI 生成依据"
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
                确认为正式评语
              </Button>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      <Modal
        confirmLoading={isBatchRunning}
        okButtonProps={{ disabled: generationCandidates.length === 0 }}
        okText={`生成 ${generationCandidates.length} 名学生草稿`}
        open={generationOpen}
        title="AI 生成设置"
        onCancel={() => setGenerationOpen(false)}
        onOk={() => void handleGenerate()}
      >
        <div className="flex flex-col gap-4 py-3">
          <ResponsiveGrid className="gap-3" columns={{ compact: 1, regular: 3, wide: 3 }}>
            <Select options={[...TONE_OPTIONS]} value={tone} onChange={setTone} />
            <Select options={[...LENGTH_OPTIONS]} value={length} onChange={setLength} />
            <Select options={[...ADDRESS_OPTIONS]} value={address} onChange={setAddress} />
          </ResponsiveGrid>
          <div>
            <div className="mb-2">正式评语风格样例（可选，最多 5 人）</div>
            <Select
              allowClear
              maxCount={5}
              mode="multiple"
              optionFilterProp="label"
              options={styleOptions}
              placeholder="从本学期已有正式评语中选择"
              style={{ width: '100%' }}
              value={styleExampleStudentIds}
              onChange={setStyleExampleStudentIds}
            />
          </div>
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

function WorkflowStatusTag(input: {
  hasWorkingDraft?: boolean;
  issueCode?: string;
  student: StudentEvaluationCommentWorkbenchStudent;
}) {
  const status = resolveStudentEvaluationCommentWorkflowStatus(input);
  const presentation = STATUS_PRESENTATION[status];
  return <Tag color={presentation.color}>{presentation.label}</Tag>;
}

function requestConfirmation(
  modal: ReturnType<typeof AntApp.useApp>['modal'],
  input: { content: string; okText: string; title: string },
) {
  return new Promise<boolean>((resolve) => {
    modal.confirm({
      cancelText: '取消',
      content: input.content,
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
