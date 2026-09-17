// src/features/student-evaluation-comment/ui/workbench.tsx

import { type ReactNode, useCallback, useEffect, useMemo } from 'react';
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
import { UpstreamLoginModal } from '@/entities/upstream-session';

import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

import { useStudentEvaluationCommentWorkbench } from '../application/use-workbench';
import {
  countStudentEvaluationCommentCodePoints,
  normalizeStudentEvaluationCommentContent,
  resolveStudentEvaluationCommentWorkflowStatus,
  STUDENT_EVALUATION_COMMENT_MAX_CODE_POINTS,
  type StudentEvaluationCommentWorkflowStatus,
} from '../application/workbench-model';
import { buildConductAlignmentPath } from '../infrastructure/links';
import type {
  StudentEvaluationCommentKind,
  StudentEvaluationCommentWorkbench,
  StudentEvaluationCommentWorkbenchLoaderData,
  StudentEvaluationCommentWorkbenchStudent,
} from '../types';

import { StudentEvaluationCommentExcelImportDialog } from './excel-import-dialog';
type ProductWorkbenchProps = {
  currentAccount: StudentEvaluationCommentWorkbenchLoaderData['currentAccount'];
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

export function StudentEvaluationCommentWorkbench({ currentAccount }: ProductWorkbenchProps) {
  const { message, modal } = AntApp.useApp();
  const confirm = useCallback(
    (input: { content: string; danger?: boolean; okText: string; title: string }) =>
      requestConfirmation(modal, input),
    [modal],
  );
  const {
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
  } = useStudentEvaluationCommentWorkbench({ currentAccount, confirm, message });
  useUnsavedProductWorkbenchProtection(isDirty);
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
    [selectedStudentIds, setSelectedStudentIds],
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
              disabled={isLoading || isBatchRunning}
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
                  disabled={cancellationCandidates.length === 0 || isBatchRunning}
                  onClick={() => void handleCancelGeneration()}
                >
                  取消生成 {cancellationCandidates.length || ''}
                </Button>
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
  const generationMessages: Record<string, string> = {
    GENERATION_FAILED: 'AI 生成未完成，可在允许时重试或人工填写',
    OUTPUT_INVALID: 'AI 返回缺行或无效内容，可在允许时重试或人工填写',
    ROSTER_CHANGED: '名单已变化，本次结果未写入，请刷新名单',
    BASIS_CHANGED: '毕业鉴定依据已变化，本次结果未写入，请检查后重试',
    TIMED_OUT: '后端已确认生成超时，可在允许时重试',
    CANCELLED: '本次生成已取消，可在允许时重新生成',
  };
  if (generationMessages[issueCode]) return generationMessages[issueCode];
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
  const conductAlignmentPath = buildConductAlignmentPath({ classId, semesterId });

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
