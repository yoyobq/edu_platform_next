// src/features/academic-workload/infrastructure/academic-workload-teacher-total-clipboard.ts
export type AcademicWorkloadTeacherTotalClipboardRow = {
  sequence: number;
  staffName: string;
  totalHours: string;
};

function formatClipboardCell(value: number | string) {
  return String(value).replace(/[\t\r\n]+/gu, ' ');
}

export function buildAcademicWorkloadTeacherTotalsClipboardText(input: {
  rows: readonly AcademicWorkloadTeacherTotalClipboardRow[];
  totalHeader: string;
}) {
  return [
    ['序号', '姓名', input.totalHeader],
    ...input.rows.map((row) => [row.sequence, row.staffName, row.totalHours]),
  ]
    .map((row) => row.map(formatClipboardCell).join('\t'))
    .join('\n');
}

export async function copyAcademicWorkloadTeacherTotals(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy browser copy path when Clipboard API permission is unavailable.
    }
  }

  const textArea = document.createElement('textarea');

  textArea.value = text;
  textArea.setAttribute('readonly', 'true');
  textArea.style.position = 'fixed';
  textArea.style.insetBlockStart = '-9999px';
  textArea.style.opacity = '0';
  document.body.append(textArea);
  textArea.select();

  try {
    if (!document.execCommand('copy')) {
      throw new Error('复制失败');
    }
  } finally {
    textArea.remove();
  }
}
