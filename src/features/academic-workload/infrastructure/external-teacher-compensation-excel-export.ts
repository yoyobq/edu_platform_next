// src/features/academic-workload/infrastructure/external-teacher-compensation-excel-export.ts
import type { Cell, CellValue, Row, Worksheet } from 'exceljs';

import { formatAcademicWorkloadTeachingClassMultiline } from '../application/teaching-class-format';

type RichTextRun = {
  font?: Cell['font'];
  text: string;
};

type RichTextCellValue = {
  richText: RichTextRun[];
};

export type ExternalTeacherCompensationExcelRow = {
  actualHours: number | string;
  adjustmentHours: number | string;
  assessmentAllowance?: number | string;
  courseName: string;
  sequence: number | string;
  staffName: string;
  staffRowIndex: number;
  staffRowSpan: number;
  teachingClassName: string;
  transportationAllowance?: number | string;
  weekCount: number | string;
  weeklyHours: number | string;
  coefficient: number | string;
};

export type ExternalTeacherCompensationExcelExportInput = {
  dateRange: {
    endDate: string;
    startDate: string;
  } | null;
  departmentName: string;
  fileName: string;
  rows: ExternalTeacherCompensationExcelRow[];
  schoolYear: number | null;
  summaryLabel: string;
  summaryTotalActualHours: number | string;
  termNumber: number | null;
};

const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const TEMPLATE_PATH = 'templates/external-teacher-compensation.xlsx';
const WORKBOOK_STYLES_PATH = 'xl/styles.xml';
const HEADER_ROW_NUMBER = 4;
const DATA_START_ROW_NUMBER = 5;
const TEMPLATE_FIRST_DETAIL_ROW_NUMBER = 5;
const TEMPLATE_LAST_DETAIL_ROW_NUMBER = 6;
const TEMPLATE_SUMMARY_ROW_NUMBER = 7;
const TEMPLATE_SPACER_ROW_NUMBER = 8;
const TEMPLATE_FIRST_FOOTER_ROW_NUMBER = 9;
const TEMPLATE_LAST_FOOTER_ROW_NUMBER = 10;
const COLUMN_COUNT = 15;
const TEACHING_CLASS_COLUMN_NUMBER = 3;
const ACTUAL_HOURS_COLUMN_NUMBER = 9;
const COURSE_COMPENSATION_COLUMN_NUMBER = 11;
const ASSESSMENT_ALLOWANCE_COLUMN_NUMBER = 12;
const TRANSPORTATION_ALLOWANCE_COLUMN_NUMBER = 13;
const AMOUNT_COLUMN_NUMBER = 14;
const SIGNATURE_COLUMN_NUMBER = 15;
const OBJECT_URL_REVOKE_DELAY_MS = 30_000;
const DEFAULT_TRANSPORTATION_ALLOWANCE = 50;
const EMPTY_TEXT = '-';
const TEMPLATE_NORMAL_FONT_XML =
  '<font><sz val="12"/><name val="宋体"/><family val="3"/><charset val="134"/></font>';
const STAFF_MERGED_COLUMN_NUMBERS = [
  1,
  2,
  ASSESSMENT_ALLOWANCE_COLUMN_NUMBER,
  TRANSPORTATION_ALLOWANCE_COLUMN_NUMBER,
  AMOUNT_COLUMN_NUMBER,
  SIGNATURE_COLUMN_NUMBER,
];
const TERM_NUMBER_LABELS: Record<number, string> = {
  1: '一',
  2: '二',
  3: '三',
};

function sanitizeWorksheetName(value: string) {
  const sanitizedValue = value.replace(/[:\\/?*[\]]/g, ' ').trim();

  return sanitizedValue.slice(0, 31) || '外聘兼课金';
}

function buildTemporaryWorksheetName(input: { existingNames: string[]; targetName: string }) {
  let index = 1;
  let temporaryName = sanitizeWorksheetName(`${input.targetName}-导出`);

  while (input.existingNames.includes(temporaryName)) {
    index += 1;
    temporaryName = sanitizeWorksheetName(`${input.targetName}-导出${index}`);
  }

  return temporaryName;
}

function sanitizeFileName(value: string) {
  const forbiddenCharacters = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);
  const sanitizedValue = Array.from(value)
    .map((character) =>
      forbiddenCharacters.has(character) || character.charCodeAt(0) < 32 ? ' ' : character,
    )
    .join('')
    .trim();

  return sanitizedValue || '兼职教师兼课金结算表.xlsx';
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = sanitizeFileName(fileName);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, OBJECT_URL_REVOKE_DELAY_MS);
}

function clonePlainObject<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function copyCellStyle(sourceCell: Cell, targetCell: Cell) {
  targetCell.style = clonePlainObject(sourceCell.style);
}

function copyRowHeight(sourceRow: Row, targetRow: Row) {
  if (sourceRow.height) {
    targetRow.height = sourceRow.height;
  }
}

function patchWorkbookStylesXml(stylesXml: string) {
  return stylesXml.replace(
    /(<fonts\b[^>]*>)(<font>[\s\S]*?<\/font>)/u,
    `$1${TEMPLATE_NORMAL_FONT_XML}`,
  );
}

async function patchWorkbookDefaultFont(buffer: ArrayBuffer) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const stylesFile = zip.file(WORKBOOK_STYLES_PATH);

  if (!stylesFile) {
    return buffer;
  }

  const stylesXml = await stylesFile.async('string');
  const patchedStylesXml = patchWorkbookStylesXml(stylesXml);

  if (patchedStylesXml === stylesXml) {
    return buffer;
  }

  zip.file(WORKBOOK_STYLES_PATH, patchedStylesXml);

  return zip.generateAsync({ compression: 'DEFLATE', type: 'arraybuffer' });
}

function normalizeTemplateUrl() {
  return `${import.meta.env.BASE_URL}${TEMPLATE_PATH}`;
}

async function loadTemplateWorkbook(ExcelJS: typeof import('exceljs')) {
  const response = await fetch(normalizeTemplateUrl());

  if (!response.ok) {
    throw new Error('暂时无法读取兼职教师兼课金结算表模板。');
  }

  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load(await response.arrayBuffer());

  const templateWorksheet = workbook.worksheets[0];

  if (!templateWorksheet) {
    throw new Error('兼职教师兼课金结算表模板缺少工作表。');
  }

  return {
    templateWorksheet,
    templateWorksheetIds: workbook.worksheets.map((worksheet) => worksheet.id),
    workbook,
  };
}

function getExcelColumnName(columnNumber: number) {
  let currentColumnNumber = columnNumber;
  let columnName = '';

  while (currentColumnNumber > 0) {
    const remainder = (currentColumnNumber - 1) % 26;

    columnName = `${String.fromCharCode(65 + remainder)}${columnName}`;
    currentColumnNumber = Math.floor((currentColumnNumber - 1) / 26);
  }

  return columnName;
}

function forEachColumn(callback: (columnNumber: number) => void) {
  for (let columnNumber = 1; columnNumber <= COLUMN_COUNT; columnNumber += 1) {
    callback(columnNumber);
  }
}

function applyPrintArea(input: { footerRowNumber: number; targetWorksheet: Worksheet }) {
  input.targetWorksheet.pageSetup.printArea = `A1:${getExcelColumnName(COLUMN_COUNT)}${
    input.footerRowNumber
  }`;
}

function applyTemplateColumnWidths(input: {
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
}) {
  forEachColumn((columnNumber) => {
    const templateWidth = input.templateWorksheet.getColumn(columnNumber).width;

    if (templateWidth) {
      input.targetWorksheet.getColumn(columnNumber).width = templateWidth;
    }
  });
}

function copySheetLayout(templateWorksheet: Worksheet, targetWorksheet: Worksheet) {
  const pageSetup = clonePlainObject(templateWorksheet.pageSetup);

  delete pageSetup.scale;
  targetWorksheet.pageSetup = {
    ...pageSetup,
    fitToHeight: 0,
    fitToPage: true,
    fitToWidth: 1,
  };
  targetWorksheet.headerFooter = clonePlainObject(templateWorksheet.headerFooter);
  targetWorksheet.properties = clonePlainObject(templateWorksheet.properties);
  targetWorksheet.views = clonePlainObject(templateWorksheet.views);
}

function hasRichTextValue(value: CellValue): value is RichTextCellValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'richText' in value &&
    Array.isArray(value.richText)
  );
}

function parseExcelNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const normalizedValue = value?.trim().replaceAll(',', '') ?? '';

  if (!normalizedValue) {
    return null;
  }

  const numericValue = Number(normalizedValue);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function toExcelNumber(value: number | string | null | undefined) {
  const numericValue = parseExcelNumber(value);

  return numericValue ?? value ?? '';
}

function buildFormulaValue(formula: string, resultValue?: number | string | null): CellValue {
  const result = parseExcelNumber(resultValue);

  return result === null ? { formula } : { formula, result };
}

function formatTeachingClassExcelValue(value: string) {
  return formatAcademicWorkloadTeachingClassMultiline(value, EMPTY_TEXT);
}

function formatTermNumber(termNumber: number | null) {
  if (termNumber === null) {
    return ' ';
  }

  return TERM_NUMBER_LABELS[termNumber] ?? String(termNumber);
}

function parseIsoDateParts(value: string | null | undefined) {
  const [year, month, day] = (value ?? '').split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return {
    day: String(day),
    month: String(month),
    year: String(year),
  };
}

function createSemesterContextReplacer(input: ExternalTeacherCompensationExcelExportInput) {
  const startDate = parseIsoDateParts(input.dateRange?.startDate);
  const endDate = parseIsoDateParts(input.dateRange?.endDate);
  const schoolStartYear = input.schoolYear === null ? 'yyyy' : String(input.schoolYear);
  const schoolEndYear = input.schoolYear === null ? 'yyyy' : String(input.schoolYear + 1);
  const dateStartYear = startDate?.year ?? 'yyyy';
  let yearTokenIndex = 0;
  let monthTokenIndex = 0;
  let dayTokenIndex = 0;

  return (text: string) =>
    text
      .replaceAll('DEPARTMENT_NAME', input.departmentName)
      .replaceAll('DEPARTMENT', input.departmentName)
      .replace(/yyyy/gi, () => {
        const nextValue =
          yearTokenIndex === 0
            ? schoolStartYear
            : yearTokenIndex === 1
              ? schoolEndYear
              : dateStartYear;

        yearTokenIndex += 1;

        return nextValue;
      })
      .replace(/\bN\b/g, formatTermNumber(input.termNumber))
      .replace(/\bMM\b/g, () => {
        const nextValue = monthTokenIndex === 0 ? startDate?.month : endDate?.month;

        monthTokenIndex += 1;

        return nextValue ?? 'MM';
      })
      .replace(/\bdd\b/g, () => {
        const nextValue = dayTokenIndex === 0 ? startDate?.day : endDate?.day;

        dayTokenIndex += 1;

        return nextValue ?? 'dd';
      });
}

function buildSemesterContextValue(input: {
  cell: Cell;
  exportInput: ExternalTeacherCompensationExcelExportInput;
}) {
  const replaceContextText = createSemesterContextReplacer(input.exportInput);

  if (hasRichTextValue(input.cell.value)) {
    return {
      richText: input.cell.value.richText.map((run) => ({
        ...run,
        font: clonePlainObject(run.font),
        text: replaceContextText(run.text),
      })),
    };
  }

  return replaceContextText(
    typeof input.cell.value === 'string'
      ? input.cell.value
      : '部门（章）： DEPARTMENT_NAME                      yyyy  ～ yyyy 学年 第 N 学期  yyyy 年 MM 月 dd 日~  MM 月 dd 日',
  );
}

function keepSingleLineHeaderCell(cell: Cell) {
  cell.alignment = {
    ...clonePlainObject(cell.alignment),
    horizontal: cell.alignment?.horizontal ?? 'center',
    shrinkToFit: true,
    vertical: cell.alignment?.vertical ?? 'middle',
    wrapText: false,
  };
}

function renderMergedHeaderRow(input: {
  rowNumber: number;
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
  value: CellValue;
}) {
  const templateRow = input.templateWorksheet.getRow(input.rowNumber);
  const targetRow = input.targetWorksheet.getRow(input.rowNumber);
  const targetCell = targetRow.getCell(1);

  copyRowHeight(templateRow, targetRow);
  copyCellStyle(templateRow.getCell(1), targetCell);
  targetCell.value = input.value;
  keepSingleLineHeaderCell(targetCell);
  input.targetWorksheet.mergeCells(input.rowNumber, 1, input.rowNumber, COLUMN_COUNT);
}

function renderStaticHeaderRows(input: {
  exportInput: ExternalTeacherCompensationExcelExportInput;
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
}) {
  renderMergedHeaderRow({
    rowNumber: 1,
    targetWorksheet: input.targetWorksheet,
    templateWorksheet: input.templateWorksheet,
    value: clonePlainObject(input.templateWorksheet.getRow(1).getCell(1).value),
  });
  renderMergedHeaderRow({
    rowNumber: 2,
    targetWorksheet: input.targetWorksheet,
    templateWorksheet: input.templateWorksheet,
    value: clonePlainObject(input.templateWorksheet.getRow(2).getCell(1).value),
  });
  renderMergedHeaderRow({
    rowNumber: 3,
    targetWorksheet: input.targetWorksheet,
    templateWorksheet: input.templateWorksheet,
    value: buildSemesterContextValue({
      cell: input.templateWorksheet.getRow(3).getCell(1),
      exportInput: input.exportInput,
    }),
  });
}

function renderTableHeaderRow(input: { targetWorksheet: Worksheet; templateWorksheet: Worksheet }) {
  const templateRow = input.templateWorksheet.getRow(HEADER_ROW_NUMBER);
  const targetRow = input.targetWorksheet.getRow(HEADER_ROW_NUMBER);

  copyRowHeight(templateRow, targetRow);
  forEachColumn((columnNumber) => {
    const targetCell = targetRow.getCell(columnNumber);
    const templateCell = templateRow.getCell(columnNumber);

    copyCellStyle(templateCell, targetCell);
    targetCell.value = clonePlainObject(templateCell.value);
  });
}

function renderTemplateStyledRow(input: {
  targetRowNumber: number;
  targetWorksheet: Worksheet;
  templateRowNumber: number;
  templateWorksheet: Worksheet;
  values?: CellValue[];
}) {
  const templateRow = input.templateWorksheet.getRow(input.templateRowNumber);
  const targetRow = input.targetWorksheet.getRow(input.targetRowNumber);

  copyRowHeight(templateRow, targetRow);
  forEachColumn((columnNumber) => {
    const targetCell = targetRow.getCell(columnNumber);
    const templateCell = templateRow.getCell(columnNumber);

    copyCellStyle(templateCell, targetCell);
    targetCell.value = input.values?.[columnNumber - 1] ?? '';
  });

  return targetRow;
}

function getGroupFormulaRange(input: {
  columnNumber: number;
  groupEndRowNumber: number;
  groupStartRowNumber: number;
}) {
  const columnName = getExcelColumnName(input.columnNumber);

  return `${columnName}${input.groupStartRowNumber}:${columnName}${input.groupEndRowNumber}`;
}

function getTemplateDetailCellValue(input: { columnNumber: number; templateWorksheet: Worksheet }) {
  return (
    clonePlainObject(
      input.templateWorksheet.getRow(TEMPLATE_FIRST_DETAIL_ROW_NUMBER).getCell(input.columnNumber)
        .value,
    ) ?? ''
  );
}

function getStaffMergedTemplateValue(input: {
  columnNumber: number;
  row: ExternalTeacherCompensationExcelRow;
  templateWorksheet: Worksheet;
  value?: number | string;
}) {
  if (input.row.staffRowIndex !== 0) {
    return '';
  }

  if (input.value !== undefined) {
    return toExcelNumber(input.value);
  }

  return getTemplateDetailCellValue({
    columnNumber: input.columnNumber,
    templateWorksheet: input.templateWorksheet,
  });
}

function getDetailRowValues(input: {
  groupEndRowNumber: number;
  groupStartRowNumber: number;
  row: ExternalTeacherCompensationExcelRow;
  rowNumber: number;
  templateWorksheet: Worksheet;
}): CellValue[] {
  const rowNumber = input.rowNumber;

  return [
    input.row.staffRowIndex === 0 ? input.row.sequence : '',
    input.row.staffRowIndex === 0 ? input.row.staffName : '',
    formatTeachingClassExcelValue(input.row.teachingClassName),
    input.row.courseName,
    toExcelNumber(input.row.weeklyHours),
    toExcelNumber(input.row.weekCount),
    toExcelNumber(input.row.adjustmentHours),
    toExcelNumber(input.row.coefficient),
    buildFormulaValue(
      `E${rowNumber}*F${rowNumber}*H${rowNumber}+G${rowNumber}`,
      input.row.actualHours,
    ),
    getTemplateDetailCellValue({
      columnNumber: 10,
      templateWorksheet: input.templateWorksheet,
    }),
    getTemplateDetailCellValue({
      columnNumber: COURSE_COMPENSATION_COLUMN_NUMBER,
      templateWorksheet: input.templateWorksheet,
    }),
    getStaffMergedTemplateValue({
      columnNumber: ASSESSMENT_ALLOWANCE_COLUMN_NUMBER,
      row: input.row,
      templateWorksheet: input.templateWorksheet,
      value: input.row.assessmentAllowance,
    }),
    getStaffMergedTemplateValue({
      columnNumber: TRANSPORTATION_ALLOWANCE_COLUMN_NUMBER,
      row: input.row,
      templateWorksheet: input.templateWorksheet,
      value: input.row.transportationAllowance ?? DEFAULT_TRANSPORTATION_ALLOWANCE,
    }),
    getTemplateDetailCellValue({
      columnNumber: AMOUNT_COLUMN_NUMBER,
      templateWorksheet: input.templateWorksheet,
    }),
    '',
  ];
}

function applyMergedColumnBottomBorder(input: {
  columnNumber: number;
  targetCell: Cell;
  templateWorksheet: Worksheet;
}) {
  const bottomStyle = input.templateWorksheet
    .getRow(TEMPLATE_LAST_DETAIL_ROW_NUMBER)
    .getCell(input.columnNumber).style;

  input.targetCell.style = {
    ...input.targetCell.style,
    border: {
      ...input.targetCell.style.border,
      bottom: clonePlainObject(bottomStyle.border?.bottom),
    },
  };
}

function renderDetailRows(input: {
  rows: ExternalTeacherCompensationExcelRow[];
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
}) {
  input.rows.forEach((row, rowIndex) => {
    const rowNumber = DATA_START_ROW_NUMBER + rowIndex;
    const groupStartRowNumber = rowNumber - row.staffRowIndex;
    const groupEndRowNumber = groupStartRowNumber + row.staffRowSpan - 1;
    const targetRow = renderTemplateStyledRow({
      targetRowNumber: rowNumber,
      targetWorksheet: input.targetWorksheet,
      templateRowNumber: TEMPLATE_FIRST_DETAIL_ROW_NUMBER,
      templateWorksheet: input.templateWorksheet,
      values: getDetailRowValues({
        groupEndRowNumber,
        groupStartRowNumber,
        row,
        rowNumber,
        templateWorksheet: input.templateWorksheet,
      }),
    });
    const teachingClassCell = targetRow.getCell(TEACHING_CLASS_COLUMN_NUMBER);

    teachingClassCell.alignment = {
      ...clonePlainObject(teachingClassCell.alignment),
      wrapText: true,
    };

    if (row.staffRowIndex === 0 && row.staffRowSpan === 1) {
      STAFF_MERGED_COLUMN_NUMBERS.forEach((columnNumber) => {
        applyMergedColumnBottomBorder({
          columnNumber,
          targetCell: targetRow.getCell(columnNumber),
          templateWorksheet: input.templateWorksheet,
        });
      });
    }
  });

  input.rows.forEach((row, rowIndex) => {
    if (row.staffRowIndex !== 0 || row.staffRowSpan <= 1) {
      return;
    }

    const startRowNumber = DATA_START_ROW_NUMBER + rowIndex;
    const endRowNumber = startRowNumber + row.staffRowSpan - 1;

    STAFF_MERGED_COLUMN_NUMBERS.forEach((columnNumber) => {
      input.targetWorksheet.mergeCells(startRowNumber, columnNumber, endRowNumber, columnNumber);

      applyMergedColumnBottomBorder({
        columnNumber,
        targetCell: input.targetWorksheet.getRow(endRowNumber).getCell(columnNumber),
        templateWorksheet: input.templateWorksheet,
      });
    });
  });
}

function renderSummaryRow(input: {
  exportInput: ExternalTeacherCompensationExcelExportInput;
  rowNumber: number;
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
}) {
  const targetRow = renderTemplateStyledRow({
    targetRowNumber: input.rowNumber,
    targetWorksheet: input.targetWorksheet,
    templateRowNumber: TEMPLATE_SUMMARY_ROW_NUMBER,
    templateWorksheet: input.templateWorksheet,
  });
  const lastDataRowNumber = input.rowNumber - 1;

  targetRow.getCell(1).value = input.exportInput.summaryLabel;
  targetRow.getCell(ACTUAL_HOURS_COLUMN_NUMBER).value = buildFormulaValue(
    `SUM(${getGroupFormulaRange({
      columnNumber: ACTUAL_HOURS_COLUMN_NUMBER,
      groupEndRowNumber: lastDataRowNumber,
      groupStartRowNumber: DATA_START_ROW_NUMBER,
    })})`,
    input.exportInput.summaryTotalActualHours,
  );
  targetRow.getCell(COURSE_COMPENSATION_COLUMN_NUMBER).value = buildFormulaValue(
    `SUM(${getGroupFormulaRange({
      columnNumber: COURSE_COMPENSATION_COLUMN_NUMBER,
      groupEndRowNumber: lastDataRowNumber,
      groupStartRowNumber: DATA_START_ROW_NUMBER,
    })})`,
  );
  input.targetWorksheet.mergeCells(input.rowNumber, 1, input.rowNumber, 8);
}

function renderSpacerRow(input: {
  rowNumber: number;
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
}) {
  renderTemplateStyledRow({
    targetRowNumber: input.rowNumber,
    targetWorksheet: input.targetWorksheet,
    templateRowNumber: TEMPLATE_SPACER_ROW_NUMBER,
    templateWorksheet: input.templateWorksheet,
  });
  input.targetWorksheet.mergeCells(input.rowNumber, 1, input.rowNumber, COLUMN_COUNT);
}

function renderFooterRows(input: {
  firstRowNumber: number;
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
}) {
  for (
    let templateRowNumber = TEMPLATE_FIRST_FOOTER_ROW_NUMBER;
    templateRowNumber <= TEMPLATE_LAST_FOOTER_ROW_NUMBER;
    templateRowNumber += 1
  ) {
    const rowOffset = templateRowNumber - TEMPLATE_FIRST_FOOTER_ROW_NUMBER;
    const targetRowNumber = input.firstRowNumber + rowOffset;

    renderTemplateStyledRow({
      targetRowNumber,
      targetWorksheet: input.targetWorksheet,
      templateRowNumber,
      templateWorksheet: input.templateWorksheet,
    });
    input.targetWorksheet.mergeCells(targetRowNumber, 1, targetRowNumber, 2);
    input.targetWorksheet.mergeCells(targetRowNumber, 5, targetRowNumber, 6);
    input.targetWorksheet.mergeCells(targetRowNumber, 12, targetRowNumber, 13);
  }
}

export async function exportExternalTeacherCompensationExcel(
  input: ExternalTeacherCompensationExcelExportInput,
) {
  const ExcelJS = await import('exceljs');
  const { templateWorksheet, templateWorksheetIds, workbook } = await loadTemplateWorkbook(ExcelJS);
  const targetWorksheetName = sanitizeWorksheetName(templateWorksheet.name);
  const worksheet = workbook.addWorksheet(
    buildTemporaryWorksheetName({
      existingNames: workbook.worksheets.map((workbookWorksheet) => workbookWorksheet.name),
      targetName: targetWorksheetName,
    }),
  );
  const summaryRowNumber = DATA_START_ROW_NUMBER + input.rows.length;
  const spacerRowNumber = summaryRowNumber + 1;
  const firstFooterRowNumber = spacerRowNumber + 1;
  const footerRowNumber =
    firstFooterRowNumber + (TEMPLATE_LAST_FOOTER_ROW_NUMBER - TEMPLATE_FIRST_FOOTER_ROW_NUMBER);

  copySheetLayout(templateWorksheet, worksheet);
  applyTemplateColumnWidths({
    targetWorksheet: worksheet,
    templateWorksheet,
  });
  renderStaticHeaderRows({
    exportInput: input,
    targetWorksheet: worksheet,
    templateWorksheet,
  });
  renderTableHeaderRow({
    targetWorksheet: worksheet,
    templateWorksheet,
  });
  renderDetailRows({
    rows: input.rows,
    targetWorksheet: worksheet,
    templateWorksheet,
  });
  renderSummaryRow({
    exportInput: input,
    rowNumber: summaryRowNumber,
    targetWorksheet: worksheet,
    templateWorksheet,
  });
  renderSpacerRow({
    rowNumber: spacerRowNumber,
    targetWorksheet: worksheet,
    templateWorksheet,
  });
  renderFooterRows({
    firstRowNumber: firstFooterRowNumber,
    targetWorksheet: worksheet,
    templateWorksheet,
  });
  applyPrintArea({
    footerRowNumber,
    targetWorksheet: worksheet,
  });
  templateWorksheetIds.forEach((worksheetId) => {
    workbook.removeWorksheet(worksheetId);
  });
  worksheet.name = targetWorksheetName;
  workbook.calcProperties.fullCalcOnLoad = true;

  const buffer = await workbook.xlsx.writeBuffer();
  const patchedBuffer = await patchWorkbookDefaultFont(buffer as ArrayBuffer);
  const blob = new Blob([patchedBuffer], { type: EXCEL_MIME_TYPE });

  downloadBlob(blob, input.fileName);
}
