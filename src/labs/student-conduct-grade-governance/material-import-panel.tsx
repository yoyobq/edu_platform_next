// src/labs/student-conduct-grade-governance/material-import-panel.tsx

import { useRef } from 'react';
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
  result: StudentConductGradeMaterialImportResult | null;
  warningConfirmationKeys: readonly string[];
  onConfirmWarnings: () => void;
  onFilesChange: (files: File[]) => void;
  onImport: () => void;
  onRejectFile: (fileName: string) => void;
  onRejectTooManyFiles: (limit: number) => void;
};

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

function renderIssueGroup(group: MaterialImportIssueGroup, index: number) {
  const positionText =
    group.positions.length > 0 ? `（出现位置：${group.positions.join('、')}）` : null;

  return (
    <span key={`${group.key}-${index}`}>
      {group.sourceFilename ? `${group.sourceFilename}：` : null}
      {group.message}
      {positionText}
    </span>
  );
}

function renderIssues(
  title: string,
  type: MaterialImportIssueDisplayType,
  issues: readonly StudentConductGradeMaterialImportIssue[],
  result: StudentConductGradeMaterialImportResult,
  context: MaterialImportContext,
) {
  if (issues.length === 0) {
    return null;
  }

  const issueGroups = buildMaterialImportIssueGroups(issues, type, {
    targetTerm: {
      label: context.termLabel,
      schoolYear: result.schoolYear,
      semester: result.semester,
    },
  });

  return (
    <Alert
      showIcon
      type={type}
      title={title}
      description={
        <Space direction="vertical" size={2}>
          {issueGroups.slice(0, 8).map((issueGroup, index) => renderIssueGroup(issueGroup, index))}
          {issueGroups.length > 8 ? (
            <span>另有 {issueGroups.length - 8} 类问题未展开。</span>
          ) : null}
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

    onFilesChange(mergeMaterialFiles(files, supportedSelectedFiles));

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

      {result
        ? renderIssues('需要确认的材料信号', 'warning', result.warnings, result, context)
        : null}
      {result
        ? renderIssues('阻断导入的问题', 'error', result.blockingErrors, result, context)
        : null}
    </div>
  );
}
