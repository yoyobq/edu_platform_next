// src/labs/student-registration-cards/infrastructure/batch-archive.ts
import dayjs from 'dayjs';
import JSZip from 'jszip';

import { BATCH_STATUS, type BatchRow } from '../application/card-batch';

const safeFileName = (name: string) =>
  Array.from(name, (char) => (char.charCodeAt(0) < 32 ? '_' : char))
    .join('')
    .replace(/[\\/:*?"<>|]/g, '_');
const csvCell = (value: string) =>
  `"${(/^[=+@\-\t\r]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;

export async function buildBatchArchive(
  rows: BatchRow[],
  className: string,
  label: (code: string) => string,
) {
  const zip = new JSZip();
  for (const row of rows) {
    if (row.status === 'success' && row.bytes) {
      zip.file(
        safeFileName(row.document?.fileName ?? `${row.studentId}-${row.studentName}-学籍卡.docx`),
        row.bytes,
      );
    }
  }
  const csv = [
    ['学号', '姓名', '导出状态', '材料提醒', '失败原因'],
    ...rows.map((row) => [
      row.studentId,
      row.studentName,
      BATCH_STATUS[row.status],
      row.warnings.map(label).join('、'),
      row.reason.split('、').map(label).join('、'),
    ]),
  ]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
  zip.file('导出结果.csv', `\uFEFF${csv}`);
  return {
    blob: await zip.generateAsync({ type: 'blob' }),
    fileName: `${safeFileName(className)}-学籍卡-${dayjs().format('YYYYMMDD-HHmmss')}.zip`,
  };
}
