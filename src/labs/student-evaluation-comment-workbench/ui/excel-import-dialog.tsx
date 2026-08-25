import { InboxOutlined, LoadingOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import { Alert, Button, Modal, Select, Space, Tag, Upload } from 'antd';

import { STUDENT_EVALUATION_COMMENT_MATERIAL_MAX_FILE_BYTES } from '../infrastructure/api';
import type {
  StudentEvaluationCommentMaterialImportResult,
  StudentEvaluationCommentMaterialNotice,
} from '../types';

type ExcelImportDialogProps = {
  className: string;
  errorMessage: string | null;
  file: File | null;
  identitySelections: Readonly<Record<string, string>>;
  isImporting: boolean;
  open: boolean;
  result: StudentEvaluationCommentMaterialImportResult | null;
  selectedSheet: string | null;
  termLabel: string;
  onClose: () => void;
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

function formatNoticePosition(notice: StudentEvaluationCommentMaterialNotice) {
  const sheet = notice.sourceSheet ? `工作表“${notice.sourceSheet}”` : '';
  const rows = notice.sourceRows?.length ? `第 ${notice.sourceRows.join('、')} 行` : '';

  return [sheet, rows].filter(Boolean).join(' ');
}

function NoticeList({
  notices,
  title,
  type,
}: {
  notices: readonly StudentEvaluationCommentMaterialNotice[];
  title: string;
  type: 'error' | 'warning';
}) {
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

export function StudentEvaluationCommentExcelImportDialog({
  className,
  errorMessage,
  file,
  identitySelections,
  isImporting,
  open,
  result,
  selectedSheet,
  termLabel,
  onClose,
  onContinueIdentityMappings,
  onContinueSheet,
  onFileSelected,
  onIdentitySelectionChange,
  onRejectFile,
  onSelectedSheetChange,
}: ExcelImportDialogProps) {
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
    <Modal
      destroyOnHidden
      footer={null}
      open={open}
      title="从 Excel 导入评语"
      width={680}
      onCancel={onClose}
    >
      <div className="flex flex-col gap-4 pt-3">
        <Alert
          showIcon
          description={`${className} · ${termLabel}。解析结果会先成为工作台草稿，确认无误后再统一保存为正式评语。`}
          title="导入范围"
          type="info"
        />

        <Upload.Dragger
          accept=".xlsx"
          beforeUpload={beforeUpload}
          disabled={isImporting}
          fileList={buildUploadFileList(file, isImporting)}
          maxCount={1}
          multiple={false}
          onRemove={() => {
            onClose();
            return true;
          }}
        >
          <p className="ant-upload-drag-icon">
            {isImporting ? <LoadingOutlined spin /> : <InboxOutlined />}
          </p>
          <p className="ant-upload-text">
            {isImporting ? '正在解析并匹配学生' : '拖入或点击选择评语 Excel'}
          </p>
          <p className="ant-upload-hint">
            仅支持单个 .xlsx，最多 1 MiB；支持多工作表和重名学生人工对齐
          </p>
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

        {result ? <NoticeList notices={result.warnings} title="导入提示" type="warning" /> : null}
        {result ? (
          <NoticeList notices={result.blockingErrors} title="材料存在阻断问题" type="error" />
        ) : null}
        {result?.status === 'NO_CHANGES' ? (
          <Alert
            showIcon
            description={`解析 ${result.summary.parsedRows} 行，匹配 ${result.summary.matchedRows} 行；其中 ${result.summary.unchangedCount} 条与正式评语一致。`}
            title="Excel 中没有需要预填的变化"
            type="success"
          />
        ) : null}
        {result?.status === 'BLOCKED' ? <Tag color="error">未修改工作台草稿</Tag> : null}
      </div>
    </Modal>
  );
}
