// src/features/academic-teaching-plan/infrastructure/teaching-plan-excel-export.ts

import type {
  TeachingPlanContentRowDraft,
  TeachingPlanFormalRow,
} from '../application/teaching-plan-sheet';

const EXCEL_MIME_TYPE = 'application/vnd.ms-excel';
const OBJECT_URL_REVOKE_DELAY_MS = 1_000;
const TEACHING_PLAN_COLUMN_WIDTHS = [14.35, 16.35, 22.63, 17.72, 18.44, 30.99, 11.9];

export const TEACHING_PLAN_EXCEL_HEADERS = [
  '授课时间',
  '学时数',
  '节次',
  '授课方式',
  '授课地点',
  '授课章节与内容',
  '课外作业',
] as const;

export type TeachingPlanExcelRow = readonly [
  teachingDate: string,
  teachingHours: number,
  periodsText: string,
  deliveryMode: '线上' | '线下',
  location: string,
  chapterAndContent: string,
  homework: string,
];

export function buildTeachingPlanExcelRows(input: {
  contentRows: readonly (TeachingPlanContentRowDraft | null)[];
  formalRows: readonly TeachingPlanFormalRow[];
}): TeachingPlanExcelRow[] {
  assertTeachingPlanExportRowCount(input);
  return input.formalRows.map((row, index) => [
    row.teachingDate,
    row.teachingHours,
    row.periodsText,
    row.deliveryMode === 'ONLINE' ? '线上' : '线下',
    row.location,
    input.contentRows[index]?.chapterAndContent ?? '',
    input.contentRows[index]?.homework ?? '',
  ]);
}

export function buildTeachingPlanExcelFileName(input: {
  courseName: string;
  teachingClassName: string;
}) {
  const baseName = `${input.teachingClassName}-${input.courseName}-授课计划`;
  const sanitized = Array.from(baseName)
    .map((character) =>
      '<>:"/\\|?*'.includes(character) || character.charCodeAt(0) < 32 ? ' ' : character,
    )
    .join('')
    .replace(/\s+/gu, ' ')
    .trim();

  return `${sanitized || '授课计划'}.xls`;
}

type TeachingPlanExcelExportInput = {
  contentRows: readonly (TeachingPlanContentRowDraft | null)[];
  courseName: string;
  formalRows: readonly TeachingPlanFormalRow[];
  teachingClassName: string;
};

export async function buildTeachingPlanXlsBuffer(input: TeachingPlanExcelExportInput) {
  assertTeachingPlanExportRowCount(input);
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    [...TEACHING_PLAN_EXCEL_HEADERS],
    ...buildTeachingPlanExcelRows(input).map((row) => [...row]),
  ]);
  worksheet['!cols'] = TEACHING_PLAN_COLUMN_WIDTHS.map((width) => ({ width }));
  worksheet['!rows'] = Array.from({ length: input.formalRows.length + 1 }, (_, index) => ({
    hpt: index === 0 ? 26 : 24,
  }));
  worksheet['!autofilter'] = { ref: `A1:G${input.formalRows.length + 1}` };
  workbook.Props = { Author: 'Edu Mate' };
  XLSX.utils.book_append_sheet(workbook, worksheet, '授课计划');

  return XLSX.write(workbook, {
    bookType: 'xls',
    type: 'array',
  }) as ArrayBuffer;
}

export async function exportTeachingPlanExcel(input: TeachingPlanExcelExportInput) {
  const buffer = await buildTeachingPlanXlsBuffer(input);
  const blob = new Blob([buffer], { type: EXCEL_MIME_TYPE });
  downloadBlob(
    blob,
    buildTeachingPlanExcelFileName({
      courseName: input.courseName,
      teachingClassName: input.teachingClassName,
    }),
  );
}

function assertTeachingPlanExportRowCount(input: {
  contentRows: readonly (TeachingPlanContentRowDraft | null)[];
  formalRows: readonly TeachingPlanFormalRow[];
}) {
  const contentRowCount = input.contentRows.filter((row) => row !== null).length;
  if (
    input.formalRows.length === 0 ||
    input.contentRows.length !== input.formalRows.length ||
    contentRowCount !== input.formalRows.length
  ) {
    throw new Error(
      `授课计划内容行数（${contentRowCount}）必须与正式课次数（${input.formalRows.length}）一致，且中间不能留有空位`,
    );
  }
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_REVOKE_DELAY_MS);
}
