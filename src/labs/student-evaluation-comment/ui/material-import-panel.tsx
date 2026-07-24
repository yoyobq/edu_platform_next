// src/labs/student-evaluation-comment/ui/material-import-panel.tsx

import { InboxOutlined, LoadingOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import { Alert, Button, Card, Select, Space, Tag, Upload } from 'antd';

import { STUDENT_EVALUATION_COMMENT_MATERIAL_MAX_FILE_BYTES } from '../infrastructure/api';
import type {
  StudentEvaluationCommentMaterialImportResult,
  StudentEvaluationCommentMaterialNotice,
} from '../types';

type StudentEvaluationCommentMaterialImportPanelProps = {
  disabled: boolean;
  errorMessage: string | null;
  file: File | null;
  identitySelections: Readonly<Record<string, string>>;
  isImporting: boolean;
  result: StudentEvaluationCommentMaterialImportResult | null;
  selectedSheet: string | null;
  onClear: () => void;
  onContinueIdentityMappings: () => void;
  onContinueSheet: () => void;
  onFileSelected: (file: File) => void;
  onIdentitySelectionChange: (mappingKey: string, studentId: string) => void;
  onRejectFile: (message: string) => void;
  onSelectedSheetChange: (sheetName: string) => void;
};

function buildUploadFileList(file: File | null, isImporting: boolean): UploadFile[] {
  if (!file) return [];

  return [
    {
      name: file.name,
      size: file.size,
      status: isImporting ? 'uploading' : 'done',
      uid: `${file.name}-${file.lastModified}-${file.size}`,
    },
  ];
}

function resolveStatusTag(result: StudentEvaluationCommentMaterialImportResult | null) {
  if (!result) return null;

  const statusConfig = {
    BLOCKED: { color: 'red', label: '已阻断' },
    IDENTITY_MAPPING_REQUIRED: { color: 'gold', label: '待身份对齐' },
    NO_CHANGES: { color: 'default', label: '无变化' },
    READY_TO_SAVE: { color: 'blue', label: '已预填' },
    SHEET_SELECTION_REQUIRED: { color: 'gold', label: '待选择工作表' },
  } as const;
  const config = statusConfig[result.status];

  return <Tag color={config.color}>{config.label}</Tag>;
}

function formatNoticePosition(notice: StudentEvaluationCommentMaterialNotice) {
  const sheet = notice.sourceSheet ? `工作表“${notice.sourceSheet}”` : '';
  const rows = notice.sourceRows?.length ? `第 ${notice.sourceRows.join('、')} 行` : '';

  return [sheet, rows].filter(Boolean).join(' ');
}

function renderNotices(
  title: string,
  type: 'error' | 'warning',
  notices: readonly StudentEvaluationCommentMaterialNotice[],
) {
  if (notices.length === 0) return null;

  return (
    <Alert
      showIcon
      description={
        <Space orientation="vertical" size={2}>
          {notices.slice(0, 8).map((notice, index) => {
            const position = formatNoticePosition(notice);

            return (
              <span key={`${notice.code}-${position}-${index}`}>
                {notice.message}
                {position ? `（${position}）` : ''}
              </span>
            );
          })}
          {notices.length > 8 ? <span>另有 {notices.length - 8} 项问题未展开。</span> : null}
        </Space>
      }
      title={title}
      type={type}
    />
  );
}

function MaterialImportSummary({
  result,
}: {
  result: StudentEvaluationCommentMaterialImportResult;
}) {
  const { summary } = result;

  return (
    <Alert
      showIcon
      description={`解析 ${summary.parsedRows} 行，匹配 ${summary.matchedRows} 行；新建 ${summary.createCount}，更新 ${summary.updateCount}，不变 ${summary.unchangedCount}，空白 ${summary.blankCommentCount}。`}
      title={
        result.status === 'READY_TO_SAVE'
          ? 'Excel 内容已合并到页面草稿，请检查后保存'
          : 'Excel 解析完成'
      }
      type={result.status === 'READY_TO_SAVE' ? 'success' : 'info'}
    />
  );
}

export function StudentEvaluationCommentMaterialImportPanel({
  disabled,
  errorMessage,
  file,
  identitySelections,
  isImporting,
  result,
  selectedSheet,
  onClear,
  onContinueIdentityMappings,
  onContinueSheet,
  onFileSelected,
  onIdentitySelectionChange,
  onRejectFile,
  onSelectedSheetChange,
}: StudentEvaluationCommentMaterialImportPanelProps) {
  const beforeUpload: UploadProps['beforeUpload'] = (nextFile) => {
    if (!nextFile.name.toLowerCase().endsWith('.xlsx')) {
      onRejectFile('评语材料只支持 .xlsx 文件。');
      return Upload.LIST_IGNORE;
    }
    if (nextFile.size < 1 || nextFile.size > STUDENT_EVALUATION_COMMENT_MATERIAL_MAX_FILE_BYTES) {
      onRejectFile('评语 Excel 文件大小必须在 1 MiB 以内。');
      return Upload.LIST_IGNORE;
    }

    onFileSelected(nextFile);
    return false;
  };
  const identityGroups = result?.identityMappingGroups ?? [];
  const mappingsComplete =
    identityGroups.length > 0 &&
    identityGroups.every((group) => Boolean(identitySelections[group.mappingKey]));

  return (
    <Card
      extra={
        <Space>
          {resolveStatusTag(result)}
          {file || result ? (
            <Button disabled={isImporting} size="small" onClick={onClear}>
              {file ? '移除文件' : '关闭结果'}
            </Button>
          ) : null}
        </Space>
      }
      title="Excel 评语导入"
    >
      <div className="flex flex-col gap-4">
        <Alert
          showIcon
          description="文件只用于解析和学生对齐，不会直接写入正式评语；仅支持单个 .xlsx，最多 100 名学生、1 MiB。"
          title="先选择当前班级和评语范围，再拖入 Excel"
          type="info"
        />

        <Upload.Dragger
          accept=".xlsx"
          beforeUpload={beforeUpload}
          disabled={disabled || isImporting}
          fileList={buildUploadFileList(file, isImporting)}
          maxCount={1}
          multiple={false}
          onRemove={() => {
            onClear();
            return true;
          }}
        >
          <p className="ant-upload-drag-icon">
            {isImporting ? <LoadingOutlined spin /> : <InboxOutlined />}
          </p>
          <p className="ant-upload-text">
            {isImporting ? '正在解析并对齐评语，请稍候' : '拖入或点击选择评语 Excel'}
          </p>
          <p className="ant-upload-hint">支持无表头、非首行表头和任意列顺序的 .xlsx</p>
        </Upload.Dragger>

        {errorMessage ? <Alert showIcon title={errorMessage} type="error" /> : null}

        {result?.status === 'SHEET_SELECTION_REQUIRED' ? (
          <Alert
            showIcon
            description={
              <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                <Select
                  aria-label="选择评语工作表"
                  options={result.sheetOptions.map((option) => ({
                    label: `${option.sheetName}（${option.candidateRowCount} 行）`,
                    value: option.sheetName,
                  }))}
                  placeholder="请选择需要导入的工作表"
                  style={{ width: '100%' }}
                  value={selectedSheet ?? undefined}
                  onChange={onSelectedSheetChange}
                />
                <Button
                  disabled={!selectedSheet || isImporting}
                  loading={isImporting}
                  type="primary"
                  onClick={onContinueSheet}
                >
                  按此工作表继续
                </Button>
              </Space>
            }
            title="检测到多个可识别工作表"
            type="warning"
          />
        ) : null}

        {result?.status === 'IDENTITY_MAPPING_REQUIRED' ? (
          <Alert
            showIcon
            description={
              <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                {identityGroups.map((group) => (
                  <div className="flex flex-col gap-2" key={group.mappingKey}>
                    <span>
                      {group.sourceStudentName}
                      {group.sourceStudentNumber ? ` · 来源学号 ${group.sourceStudentNumber}` : ''}
                      {` · 第 ${group.sourceRows.join('、')} 行`}
                    </span>
                    <Select
                      aria-label={`${group.sourceStudentName}对应学生`}
                      options={group.candidates.map((candidate) => ({
                        label: `${candidate.studentName} · ${candidate.studentId}`,
                        value: candidate.studentId,
                      }))}
                      placeholder="选择当前班级中的学生"
                      style={{ width: '100%' }}
                      value={identitySelections[group.mappingKey]}
                      onChange={(studentId) =>
                        onIdentitySelectionChange(group.mappingKey, studentId)
                      }
                    />
                  </div>
                ))}
                <Button
                  disabled={!mappingsComplete || isImporting}
                  loading={isImporting}
                  type="primary"
                  onClick={onContinueIdentityMappings}
                >
                  确认身份并继续
                </Button>
              </Space>
            }
            title="存在重名学生，请确认对应身份"
            type="warning"
          />
        ) : null}

        {result ? renderNotices('导入提示', 'warning', result.warnings) : null}
        {result ? renderNotices('材料存在阻断问题', 'error', result.blockingErrors) : null}
        {result && (result.status === 'READY_TO_SAVE' || result.status === 'NO_CHANGES') ? (
          <MaterialImportSummary result={result} />
        ) : null}
      </div>
    </Card>
  );
}
