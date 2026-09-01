import type { TeachingPlanSheetRow } from '../application/teaching-plan-sheet';

const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const OBJECT_URL_REVOKE_DELAY_MS = 1_000;

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

export function buildTeachingPlanExcelRows(
  rows: readonly TeachingPlanSheetRow[],
): TeachingPlanExcelRow[] {
  return rows.map((row) => [
    row.teachingDate,
    row.teachingHours,
    row.periodsText,
    row.deliveryMode === 'ONLINE' ? '线上' : '线下',
    row.location,
    row.chapterAndContent,
    row.homework,
  ]);
}

export function buildTeachingPlanExcelFileName(input: {
  courseName: string;
  teachingClassName: string;
}) {
  const baseName = `${input.teachingClassName}-${input.courseName}-教学计划`;
  const sanitized = Array.from(baseName)
    .map((character) =>
      '<>:"/\\|?*'.includes(character) || character.charCodeAt(0) < 32 ? ' ' : character,
    )
    .join('')
    .replace(/\s+/gu, ' ')
    .trim();

  return `${sanitized || '教学计划'}.xlsx`;
}

export async function exportTeachingPlanExcel(input: {
  courseName: string;
  rows: readonly TeachingPlanSheetRow[];
  teachingClassName: string;
}) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('教学计划');

  workbook.creator = 'Edu Mate';
  worksheet.columns = [
    { width: 14.35 },
    { width: 16.35 },
    { width: 22.63 },
    { width: 17.72 },
    { width: 18.44 },
    { width: 30.99 },
    { width: 11.9 },
  ];
  worksheet.addRow([...TEACHING_PLAN_EXCEL_HEADERS]);
  worksheet.addRows(buildTeachingPlanExcelRows(input.rows).map((row) => [...row]));
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = 'A1:G1';
  worksheet.pageSetup = {
    fitToPage: true,
    fitToWidth: 1,
    orientation: 'landscape',
    paperSize: 9,
  };

  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    row.height = rowNumber === 1 ? 26 : 24;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.alignment = {
        horizontal: columnNumber <= 5 ? 'center' : 'left',
        vertical: 'middle',
        wrapText: true,
      };
      cell.border = {
        bottom: { color: { argb: 'FFBFBFBF' }, style: 'thin' },
        left: { color: { argb: 'FFBFBFBF' }, style: 'thin' },
        right: { color: { argb: 'FFBFBFBF' }, style: 'thin' },
        top: { color: { argb: 'FFBFBFBF' }, style: 'thin' },
      };
      cell.font = {
        bold: rowNumber === 1,
        name: 'Microsoft YaHei',
        size: 11,
      };
      if (rowNumber === 1) {
        cell.fill = {
          fgColor: { argb: 'FFE7E6E6' },
          pattern: 'solid',
          type: 'pattern',
        };
      }
    });
  });

  for (let rowNumber = 2; rowNumber <= input.rows.length + 1; rowNumber += 1) {
    worksheet.getCell(rowNumber, 4).dataValidation = {
      allowBlank: false,
      error: '请选择“线上”或“线下”',
      errorTitle: '授课方式无效',
      formulae: ['"线上,线下"'],
      showErrorMessage: true,
      type: 'list',
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], { type: EXCEL_MIME_TYPE });
  downloadBlob(
    blob,
    buildTeachingPlanExcelFileName({
      courseName: input.courseName,
      teachingClassName: input.teachingClassName,
    }),
  );
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
