// src/labs/student-conduct-grade-governance/material-import-panel.tsx

import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import { Alert, Button, Descriptions, Space, Tag, Upload } from 'antd';

import {
  CONDUCT_GRADE_MATERIAL_IMPORT_MAX_FILES,
  type StudentConductGradeMaterialImportIssue,
  type StudentConductGradeMaterialImportResult,
} from './api';

type MaterialImportContext = {
  classLabel: string;
  termLabel: string;
};

type StudentConductGradeMaterialImportPanelProps = {
  context: MaterialImportContext;
  disabled: boolean;
  errorMessage: string | null;
  files: readonly File[];
  isImporting: boolean;
  result: StudentConductGradeMaterialImportResult | null;
  warningConfirmationKeys: readonly string[];
  onConfirmWarnings: () => void;
  onFilesChange: (files: File[]) => void;
  onImport: () => void;
  onRejectFile: (fileName: string) => void;
  onRejectTooManyFiles: (limit: number) => void;
};

const MATERIAL_IMPORT_SUMMARY_LABELS: Record<string, string> = {
  affectedStudents: '影响学生',
  clearedUpstreamFieldCount: '清理旧补正字段',
  createdSectionCount: '新建操行区块',
  emptyFieldCount: '空字段',
  skippedUpstreamFieldCount: '校园网非空跳过字段',
  totalFiles: '文件数',
  totalParsedRows: '解析行',
  totalResolvedRows: '匹配行',
  totalSkippedTables: '跳过表格',
  unchangedFieldCount: '未变化字段',
  unchangedStudentCount: '未变化学生',
  writtenFieldCount: '写入字段',
  writtenStudentCount: '写入学生',
};

function formatSummaryLabel(key: string) {
  const label = MATERIAL_IMPORT_SUMMARY_LABELS[key];

  if (label) {
    return label;
  }

  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
}

function formatSummaryValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
}

function resolveStatusTag(result: StudentConductGradeMaterialImportResult | null) {
  if (!result) {
    return null;
  }

  if (result.status === 'WARNING_CONFIRMATION_REQUIRED') {
    return <Tag color="gold">需要确认</Tag>;
  }

  if (result.status === 'BLOCKED') {
    return <Tag color="red">已阻断</Tag>;
  }

  if (result.status === 'NO_CHANGES') {
    return <Tag>无变化</Tag>;
  }

  return <Tag color="green">已导入</Tag>;
}

function renderIssue(issue: StudentConductGradeMaterialImportIssue, index: number) {
  const sourceParts = [
    issue.sourceFilename,
    issue.sourceSheetOrTable,
    issue.sourceRow !== null ? `第 ${issue.sourceRow} 行` : null,
  ].filter(Boolean);

  return (
    <span key={`${issue.code}-${index}`}>
      {sourceParts.length > 0 ? `${sourceParts.join(' / ')}：` : null}
      {issue.code}
      {issue.message ? `，${issue.message}` : null}
    </span>
  );
}

function renderIssues(
  title: string,
  type: 'error' | 'warning',
  issues: readonly StudentConductGradeMaterialImportIssue[],
) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <Alert
      showIcon
      type={type}
      title={title}
      description={
        <Space direction="vertical" size={2}>
          {issues.slice(0, 8).map((issue, index) => renderIssue(issue, index))}
          {issues.length > 8 ? <span>另有 {issues.length - 8} 条未展开。</span> : null}
        </Space>
      }
    />
  );
}

function buildUploadFileList(files: readonly File[]): UploadFile[] {
  return files.map((file, index) => ({
    name: file.name,
    size: file.size,
    status: 'done' as const,
    uid: `${file.name}-${file.lastModified}-${index}`,
  }));
}

function buildMaterialFileKey(file: File) {
  return `${file.name}-${file.lastModified}-${file.size}`;
}

function mergeMaterialFiles(currentFiles: readonly File[], nextFiles: readonly File[]) {
  const mergedFiles = [...currentFiles];
  const fileKeys = new Set(mergedFiles.map((file) => buildMaterialFileKey(file)));

  nextFiles.forEach((file) => {
    const fileKey = buildMaterialFileKey(file);

    if (fileKeys.has(fileKey) || mergedFiles.length >= CONDUCT_GRADE_MATERIAL_IMPORT_MAX_FILES) {
      return;
    }

    fileKeys.add(fileKey);
    mergedFiles.push(file);
  });

  return mergedFiles;
}

function isSupportedMaterialFile(fileName: string) {
  const extension = fileName.split('.').pop()?.trim().toLowerCase();

  return extension === 'docx' || extension === 'xlsx';
}

export function StudentConductGradeMaterialImportPanel({
  context,
  disabled,
  errorMessage,
  files,
  isImporting,
  result,
  warningConfirmationKeys,
  onConfirmWarnings,
  onFilesChange,
  onImport,
  onRejectFile,
  onRejectTooManyFiles,
}: StudentConductGradeMaterialImportPanelProps) {
  const uploadFileList = buildUploadFileList(files);
  const beforeUpload: UploadProps['beforeUpload'] = (file, selectedFiles) => {
    if (!isSupportedMaterialFile(file.name)) {
      onRejectFile(file.name);

      return Upload.LIST_IGNORE;
    }

    const supportedSelectedFiles = selectedFiles.filter((selectedFile) =>
      isSupportedMaterialFile(selectedFile.name),
    );

    if (
      supportedSelectedFiles[0] === file &&
      files.length + supportedSelectedFiles.length > CONDUCT_GRADE_MATERIAL_IMPORT_MAX_FILES
    ) {
      onRejectTooManyFiles(CONDUCT_GRADE_MATERIAL_IMPORT_MAX_FILES);
    }

    onFilesChange(mergeMaterialFiles(files, supportedSelectedFiles));

    return false;
  };
  const handleRemove: UploadProps['onRemove'] = (file) => {
    const nextFiles = files.filter((currentFile, index) => {
      const uid = `${currentFile.name}-${currentFile.lastModified}-${index}`;

      return uid !== file.uid;
    });

    onFilesChange(nextFiles);

    return true;
  };
  const summaryEntries = result
    ? Object.entries(result.summary).filter(([, value]) => value !== undefined)
    : [];

  return (
    <div className="student-conduct-grade-governance-import-panel">
      <div className="student-conduct-grade-governance-import-head">
        <div>
          <span>材料导入</span>
          <small>
            {context.classLabel} / {context.termLabel}
          </small>
        </div>
        {resolveStatusTag(result)}
      </div>

      {errorMessage ? <Alert showIcon title={errorMessage} type="error" /> : null}

      <Upload.Dragger
        accept=".docx,.xlsx"
        beforeUpload={beforeUpload}
        disabled={disabled || isImporting}
        fileList={uploadFileList}
        maxCount={CONDUCT_GRADE_MATERIAL_IMPORT_MAX_FILES}
        multiple
        onRemove={handleRemove}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">拖入 Word 或 Excel 操行材料</p>
        <p className="ant-upload-hint">支持 .docx / .xlsx</p>
      </Upload.Dragger>

      <div className="student-conduct-grade-governance-import-actions">
        <span>
          {files.length > 0
            ? `已选择 ${files.length} 个文件`
            : `未选择文件，最多 ${CONDUCT_GRADE_MATERIAL_IMPORT_MAX_FILES} 个`}
        </span>
        <Space size="small" wrap>
          <Button
            disabled={disabled || isImporting || files.length === 0}
            loading={isImporting}
            type="primary"
            onClick={onImport}
          >
            导入材料
          </Button>
          {warningConfirmationKeys.length > 0 ? (
            <Button
              disabled={disabled || isImporting || files.length === 0}
              loading={isImporting}
              onClick={onConfirmWarnings}
            >
              确认导入
            </Button>
          ) : null}
        </Space>
      </div>

      {result && summaryEntries.length > 0 ? (
        <Descriptions bordered column={2} size="small" title="导入摘要">
          {summaryEntries.map(([key, value]) => (
            <Descriptions.Item key={key} label={formatSummaryLabel(key)}>
              {formatSummaryValue(value)}
            </Descriptions.Item>
          ))}
        </Descriptions>
      ) : null}

      {result ? renderIssues('需要确认的材料信号', 'warning', result.warnings) : null}
      {result ? renderIssues('阻断导入的问题', 'error', result.blockingErrors) : null}
    </div>
  );
}
