// src/labs/student-conduct-grade-governance/material-import-panel.tsx

import { type ReactNode, useRef } from 'react';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import { Alert, Button, Space, Tag, Upload } from 'antd';

import {
  CONDUCT_GRADE_MATERIAL_IMPORT_MAX_FILES,
  type StudentConductGradeMaterialImportIssue,
  type StudentConductGradeMaterialImportResult,
} from './api';
import {
  buildMaterialImportIssueGroups,
  type MaterialImportIssueDisplayType,
  type MaterialImportIssueGroup,
} from './material-import-issue-display';

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
  patchActionBar: ReactNode;
  result: StudentConductGradeMaterialImportResult | null;
  warningConfirmationKeys: readonly string[];
  onConfirmWarnings: () => void;
  onFilesChange: (files: File[]) => void;
  onFilesSelected: (files: File[]) => void;
  onRejectFile: (fileName: string) => void;
  onRejectTooManyFiles: (limit: number) => void;
};

const MATERIAL_IMPORT_SOURCE_FILENAME_PREFIX_LENGTH = 15;

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

function formatMaterialImportSourceFilename(filename: string) {
  const text = filename.trim();
  const extensionMatch = text.match(/(\.[^.]+)$/);
  const extension = extensionMatch?.[1] ?? '';
  const basename = extension ? text.slice(0, -extension.length) : text;
  const basenameChars = Array.from(basename);

  if (basenameChars.length <= MATERIAL_IMPORT_SOURCE_FILENAME_PREFIX_LENGTH) {
    return text;
  }

  const prefix = basenameChars.slice(0, MATERIAL_IMPORT_SOURCE_FILENAME_PREFIX_LENGTH).join('');

  return `${prefix}...${extension}`;
}

function renderIssueGroup(group: MaterialImportIssueGroup, index: number) {
  const positionText =
    group.positions.length > 0 ? `（出现位置：${group.positions.join('、')}）` : null;
  const sourceFilename = group.sourceFilename?.trim() || null;

  return (
    <span className="student-conduct-grade-governance-import-issue" key={`${group.key}-${index}`}>
      {group.message}
      {positionText}
      {sourceFilename ? (
        <>
          {' '}
          <span className="student-conduct-grade-governance-import-issue-source">
            <Tag title={sourceFilename}>{formatMaterialImportSourceFilename(sourceFilename)}</Tag>
          </span>
        </>
      ) : null}
    </span>
  );
}

function renderIssues(
  title: string,
  type: MaterialImportIssueDisplayType,
  issues: readonly StudentConductGradeMaterialImportIssue[],
  action?: ReactNode,
) {
  if (issues.length === 0) {
    return null;
  }

  const issueGroups = buildMaterialImportIssueGroups(issues, type);

  return (
    <div className="student-conduct-grade-governance-import-issue-alert">
      <Alert
        showIcon
        action={action}
        type={type}
        title={title}
        description={
          <Space direction="vertical" size={2}>
            {issueGroups
              .slice(0, 8)
              .map((issueGroup, index) => renderIssueGroup(issueGroup, index))}
            {issueGroups.length > 8 ? (
              <span>另有 {issueGroups.length - 8} 类问题未展开。</span>
            ) : null}
          </Space>
        }
      />
    </div>
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
  patchActionBar,
  result,
  warningConfirmationKeys,
  onConfirmWarnings,
  onFilesChange,
  onFilesSelected,
  onRejectFile,
  onRejectTooManyFiles,
}: StudentConductGradeMaterialImportPanelProps) {
  const rejectedFileKeysRef = useRef(new Set<string>());
  const uploadFileList = buildUploadFileList(files);
  const notifyRejectedFile = (file: File) => {
    const fileKey = buildMaterialFileKey(file);

    if (rejectedFileKeysRef.current.has(fileKey)) {
      return;
    }

    rejectedFileKeysRef.current.add(fileKey);
    onRejectFile(file.name);
    window.setTimeout(() => {
      rejectedFileKeysRef.current.delete(fileKey);
    }, 500);
  };
  const beforeUpload: UploadProps['beforeUpload'] = (file, selectedFiles) => {
    if (!isSupportedMaterialFile(file.name)) {
      notifyRejectedFile(file);

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

    if (supportedSelectedFiles[0] === file) {
      onFilesSelected(mergeMaterialFiles(files, supportedSelectedFiles));
    }

    return false;
  };
  const handleDrop: UploadProps['onDrop'] = (event) => {
    if (disabled || isImporting) {
      return;
    }

    Array.from(event.dataTransfer.files)
      .filter((file) => !isSupportedMaterialFile(file.name))
      .forEach((file) => {
        notifyRejectedFile(file);
      });
  };
  const handleRemove: UploadProps['onRemove'] = (file) => {
    const nextFiles = files.filter((currentFile, index) => {
      const uid = `${currentFile.name}-${currentFile.lastModified}-${index}`;

      return uid !== file.uid;
    });

    onFilesChange(nextFiles);

    return true;
  };
  const warningConfirmationAction =
    warningConfirmationKeys.length > 0 ? (
      <Button
        disabled={disabled || isImporting}
        loading={isImporting}
        size="small"
        type="primary"
        onClick={onConfirmWarnings}
      >
        我已确认
      </Button>
    ) : null;
  const hasBlockingIssues = (result?.blockingErrors.length ?? 0) > 0;

  return (
    <div className="student-conduct-grade-governance-import-panel">
      <div className="student-conduct-grade-governance-import-head">
        <div>
          <span>补录材料导入</span>
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
        onDrop={handleDrop}
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
          {isImporting
            ? `正在比对 ${files.length} 个文件`
            : files.length > 0
              ? `已选择 ${files.length} 个文件`
              : `未选择文件，最多 ${CONDUCT_GRADE_MATERIAL_IMPORT_MAX_FILES} 个`}
        </span>
      </div>

      {result && !hasBlockingIssues
        ? renderIssues('导入前请确认', 'warning', result.warnings, warningConfirmationAction)
        : null}
      {result ? renderIssues('材料存在阻断问题', 'error', result.blockingErrors) : null}

      {patchActionBar}
    </div>
  );
}
