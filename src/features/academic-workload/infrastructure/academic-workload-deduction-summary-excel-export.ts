// src/features/academic-workload/infrastructure/academic-workload-deduction-summary-excel-export.ts
import type { Cell, CellValue, Row, Style, Worksheet } from 'exceljs';

type RichTextRun = {
  font?: Cell['font'];
  text: string;
};

type RichTextCellValue = {
  richText: RichTextRun[];
};

export type AcademicWorkloadDeductionExcelRow = {
  baselineTeachingWeekCount: number | string;
  baselineWeeklyHours: string;
  courseName: string;
  dateValues: string[];
  sequence: number | string;
  staffId: string;
  staffName: string;
  staffRowIndex: number;
  staffRowSpan: number;
  staffTotal: string;
  subtotal: string;
  teachingClassName: string;
};

export type AcademicWorkloadDeductionExcelExportInput = {
  dateHeaders: string[];
  departmentName: string;
  fileName: string;
  rows: AcademicWorkloadDeductionExcelRow[];
  schoolYear: number | null;
  sheetName: string;
  summaryLabel: string;
  summaryTotal: string;
  termNumber: number | null;
};

const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const TEMPLATE_PATH = 'templates/workload-deductions.xlsx';
const WORKBOOK_STYLES_PATH = 'xl/styles.xml';
const HEADER_ROW_NUMBER = 4;
const DATA_START_ROW_NUMBER = 5;
const TEMPLATE_HEADER_ROW_NUMBER = 4;
const TEMPLATE_FIRST_DETAIL_ROW_NUMBER = 5;
const TEMPLATE_LAST_DETAIL_ROW_NUMBER = 6;
const TEMPLATE_SUMMARY_ROW_NUMBER = 7;
const TEMPLATE_SPACER_ROW_NUMBER = 8;
const TEMPLATE_FOOTER_ROW_NUMBER = 9;
const TEMPLATE_DATE_COLUMN_NUMBER = 8;
const TEMPLATE_RIGHT_SIGNATURE_COLUMN_NUMBER = 10;
const TEMPLATE_SUBTOTAL_COLUMN_NUMBER = 13;
const TEMPLATE_TOTAL_COLUMN_NUMBER = 14;
const FIXED_COLUMN_COUNT = 7;
const TRAILING_COLUMN_COUNT = 2;
const MIN_DATE_COLUMN_COUNT = TEMPLATE_SUBTOTAL_COLUMN_NUMBER - TEMPLATE_DATE_COLUMN_NUMBER;
const OBJECT_URL_REVOKE_DELAY_MS = 30_000;
const TEMPLATE_NORMAL_FONT_XML =
  '<font><sz val="12"/><name val="宋体"/><family val="3"/><charset val="134"/></font>';
const TABLE_HEADER_LABELS = ['序号', '工号', '姓名', '任课班级', '课程', '周课\n时', '上课\n周数'];
const PUBLIC_WELFARE_POST_SHEET_NAME = '公益性岗位';
const DOCUMENT_CODE_MIDDLE_GAP_WIDTH = 78;
const DOCUMENT_CODE_MIDDLE_GAP = ' '.repeat(DOCUMENT_CODE_MIDDLE_GAP_WIDTH);
const SEMESTER_CONTEXT_MIN_MIDDLE_GAP = 16;
const SEMESTER_CONTEXT_TRAILING_GAP = ' ';
const SEMESTER_CONTEXT_WIDTH_SAFETY = 4;
const TERM_NUMBER_LABELS: Record<number, string> = {
  1: '一',
  2: '二',
  3: '三',
};

function sanitizeWorksheetName(value: string) {
  const sanitizedValue = value.replace(/[:\\/?*[\]]/g, ' ').trim();

  return sanitizedValue.slice(0, 31) || '教师扣课汇总';
}

function sanitizeFileName(value: string) {
  const forbiddenCharacters = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);
  const sanitizedValue = Array.from(value)
    .map((character) =>
      forbiddenCharacters.has(character) || character.charCodeAt(0) < 32 ? ' ' : character,
    )
    .join('')
    .trim();

  return sanitizedValue || '教师扣课汇总.xlsx';
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
    throw new Error('暂时无法读取教师扣课汇总模板。');
  }

  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load(await response.arrayBuffer());

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('教师扣课汇总模板缺少工作表。');
  }

  return { templateWorksheet: worksheet, workbook };
}

function getTemplateColumnNumber(columnNumber: number, totalColumnCount: number) {
  const subtotalColumnNumber = totalColumnCount - 1;

  if (columnNumber <= FIXED_COLUMN_COUNT) {
    return columnNumber;
  }

  if (columnNumber === subtotalColumnNumber) {
    return TEMPLATE_SUBTOTAL_COLUMN_NUMBER;
  }

  if (columnNumber === totalColumnCount) {
    return TEMPLATE_TOTAL_COLUMN_NUMBER;
  }

  return TEMPLATE_DATE_COLUMN_NUMBER;
}

function forEachGeneratedColumn(
  totalColumnCount: number,
  callback: (columnNumber: number) => void,
) {
  for (let columnNumber = 1; columnNumber <= totalColumnCount; columnNumber += 1) {
    callback(columnNumber);
  }
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

function applyPrintArea(input: {
  footerRowNumber: number;
  targetWorksheet: Worksheet;
  totalColumnCount: number;
}) {
  input.targetWorksheet.pageSetup.printArea = `A1:${getExcelColumnName(
    input.totalColumnCount,
  )}${input.footerRowNumber}`;
}

function normalizeDateHeaders(dateHeaders: string[]) {
  const dateColumnCount = Math.max(dateHeaders.length, MIN_DATE_COLUMN_COUNT);

  return Array.from({ length: dateColumnCount }, (_, index) => dateHeaders[index] ?? '');
}

function normalizeDateValues(dateValues: string[], dateColumnCount: number) {
  return Array.from({ length: dateColumnCount }, (_, index) =>
    index < dateValues.length ? dateValues[index] : '',
  );
}

function getTemplateCell(input: {
  columnNumber: number;
  rowNumber: number;
  templateWorksheet: Worksheet;
  totalColumnCount: number;
}) {
  return input.templateWorksheet
    .getRow(input.rowNumber)
    .getCell(getTemplateColumnNumber(input.columnNumber, input.totalColumnCount));
}

function renderTemplateStyledRow(input: {
  targetRowNumber: number;
  targetWorksheet: Worksheet;
  templateRowNumber: number;
  templateWorksheet: Worksheet;
  totalColumnCount: number;
  values?: CellValue[];
}) {
  const templateRow = input.templateWorksheet.getRow(input.templateRowNumber);
  const targetRow = input.targetWorksheet.getRow(input.targetRowNumber);

  copyRowHeight(templateRow, targetRow);
  forEachGeneratedColumn(input.totalColumnCount, (columnNumber) => {
    const targetCell = targetRow.getCell(columnNumber);
    const templateCell = getTemplateCell({
      columnNumber,
      rowNumber: input.templateRowNumber,
      templateWorksheet: input.templateWorksheet,
      totalColumnCount: input.totalColumnCount,
    });

    copyCellStyle(templateCell, targetCell);
    targetCell.value = input.values?.[columnNumber - 1] ?? '';
  });

  return targetRow;
}

function applyTemplateColumnWidths(input: {
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
  totalColumnCount: number;
}) {
  forEachGeneratedColumn(input.totalColumnCount, (columnNumber) => {
    const templateColumnNumber = getTemplateColumnNumber(columnNumber, input.totalColumnCount);
    const templateWidth = input.templateWorksheet.getColumn(templateColumnNumber).width;

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
  targetWorksheet.views = clonePlainObject(templateWorksheet.views).map((view) => ({
    ...view,
    activeCell: 'A1',
    topLeftCell: 'A5',
  }));
}

function buildTitleValue(templateValue: CellValue, sheetName: string) {
  const templateText =
    typeof templateValue === 'string'
      ? templateValue
      : '江苏省苏州技师学院系部教师节假日扣课时统计表(teacherEngagementType)';

  if (templateText.includes('(teacherEngagementType)')) {
    return templateText.replace('(teacherEngagementType)', `(${sheetName})`);
  }

  return `${templateText}(${sheetName})`;
}

function buildSummaryLabelValue(input: {
  fallbackLabel: string;
  sheetName: string;
  templateValue: CellValue;
}) {
  const templateText = getCellText(input.templateValue);

  if (templateText.includes('teacherEngagementType')) {
    return templateText.replaceAll('teacherEngagementType', input.sheetName);
  }

  return input.fallbackLabel;
}

function formatTermNumber(termNumber: number | null) {
  if (termNumber === null) {
    return ' ';
  }

  return TERM_NUMBER_LABELS[termNumber] ?? String(termNumber);
}

function hasRichTextValue(value: CellValue): value is RichTextCellValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'richText' in value &&
    Array.isArray(value.richText)
  );
}

function replaceDocumentCodeSuffix(text: string, sheetName: string) {
  if (sheetName !== PUBLIC_WELFARE_POST_SHEET_NAME) {
    return text;
  }

  return text.replace(/-1(\s*)$/u, '-2$1');
}

function getCellText(value: CellValue) {
  if (typeof value === 'string') {
    return value;
  }

  if (hasRichTextValue(value)) {
    return value.richText.map((run) => run.text).join('');
  }

  return '';
}

function getTextDisplayWidth(value: string) {
  return Array.from(value).reduce((total, character) => {
    const codePoint = character.codePointAt(0) ?? 0;

    return total + (codePoint > 255 ? 2 : 1);
  }, 0);
}

function getSemesterContextTargetWidth(input: {
  templateWorksheet: Worksheet;
  totalColumnCount: number;
}) {
  let totalWidth = 0;

  forEachGeneratedColumn(input.totalColumnCount, (columnNumber) => {
    const templateColumnNumber = getTemplateColumnNumber(columnNumber, input.totalColumnCount);

    totalWidth += input.templateWorksheet.getColumn(templateColumnNumber).width ?? 0;
  });

  return Math.max(
    SEMESTER_CONTEXT_MIN_MIDDLE_GAP,
    Math.floor(totalWidth) - SEMESTER_CONTEXT_WIDTH_SAFETY,
  );
}

function buildDocumentCodeParts(input: { sheetName: string; templateValue: CellValue }) {
  const text = replaceDocumentCodeSuffix(getCellText(input.templateValue), input.sheetName).trim();
  const parts = text
    .split(/[\s\u3000]{2,}/u)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    left: parts[0] ?? text,
    right: parts.length >= 2 ? (parts.at(-1) ?? '') : '',
  };
}

function buildDocumentCodeValue(input: { sheetName: string; templateValue: CellValue }) {
  const documentCodeParts = buildDocumentCodeParts({
    sheetName: input.sheetName,
    templateValue: input.templateValue,
  });

  return `${documentCodeParts.left}${DOCUMENT_CODE_MIDDLE_GAP}${documentCodeParts.right}`;
}

function replaceSemesterContextText(
  text: string,
  input: AcademicWorkloadDeductionExcelExportInput,
  context: { endYear: string; startYear: string; termLabel: string; yearTokenIndex: number },
) {
  const withDepartment = text
    .replaceAll('DEPARTMENT_NAME', input.departmentName)
    .replaceAll('DEPARTMENT', input.departmentName)
    .replaceAll('TERM_NUMBER_CN', context.termLabel)
    .replaceAll('TERM_CN', context.termLabel);
  const withSchoolYear = withDepartment.replace(/YYYY/g, () => {
    const year = context.yearTokenIndex === 0 ? context.startYear : context.endYear;

    context.yearTokenIndex += 1;

    return year;
  });

  return withSchoolYear.replace(/\bN\b/g, context.termLabel);
}

function balanceSemesterContextRichText(runs: RichTextRun[], targetWidth: number) {
  if (runs.length === 0) {
    return [{ text: SEMESTER_CONTEXT_TRAILING_GAP }];
  }

  const balancedRuns = runs.map((run) => ({
    ...run,
    text: run.text,
  }));
  const firstRun = balancedRuns[0];
  const lastRun = balancedRuns.at(-1);

  if (!lastRun) {
    return balancedRuns;
  }

  firstRun.text = firstRun.text.replace(/[ \u3000]+$/u, '');
  lastRun.text = lastRun.text.replace(/[ \u3000]+$/u, '');

  const currentWidth = balancedRuns.reduce(
    (total, run) => total + getTextDisplayWidth(run.text),
    0,
  );
  const middleGapWidth = Math.max(SEMESTER_CONTEXT_MIN_MIDDLE_GAP, targetWidth - currentWidth);

  firstRun.text = `${firstRun.text}${' '.repeat(middleGapWidth)}`;
  lastRun.text = `${lastRun.text}${SEMESTER_CONTEXT_TRAILING_GAP}`;

  return balancedRuns;
}

function buildFallbackSemesterContextText(
  input: AcademicWorkloadDeductionExcelExportInput,
  targetWidth: number,
) {
  const leftText = `部门(章）：  ${input.departmentName}`;
  const startYear = input.schoolYear === null ? 'YYYY' : String(input.schoolYear);
  const endYear = input.schoolYear === null ? 'YYYY' : String(input.schoolYear + 1);
  const rightText = `${startYear}  ~  ${endYear}   学年     第  ${formatTermNumber(
    input.termNumber,
  )} 学期`;
  const middleGapWidth = Math.max(
    SEMESTER_CONTEXT_MIN_MIDDLE_GAP,
    targetWidth - getTextDisplayWidth(leftText) - getTextDisplayWidth(rightText),
  );

  return `${leftText}${' '.repeat(middleGapWidth)}${rightText}${SEMESTER_CONTEXT_TRAILING_GAP}`;
}

function padSemesterContextText(text: string) {
  return ` ${text} `;
}

function padSemesterContextRichText(runs: RichTextRun[]) {
  if (runs.length === 0) {
    return [{ text: '  ' }];
  }

  return runs.map((run, index) => {
    const nextRun = { ...run };

    if (index === 0) {
      nextRun.text = ` ${nextRun.text}`;
    }

    if (index === runs.length - 1) {
      nextRun.text = `${nextRun.text} `;
    }

    return nextRun;
  });
}

function buildSemesterContextValue(input: {
  cell: Cell;
  exportInput: AcademicWorkloadDeductionExcelExportInput;
  targetWidth: number;
}) {
  const context = {
    endYear:
      input.exportInput.schoolYear === null ? 'YYYY' : String(input.exportInput.schoolYear + 1),
    startYear:
      input.exportInput.schoolYear === null ? 'YYYY' : String(input.exportInput.schoolYear),
    termLabel: formatTermNumber(input.exportInput.termNumber),
    yearTokenIndex: 0,
  };

  if (hasRichTextValue(input.cell.value)) {
    return {
      richText: padSemesterContextRichText(
        balanceSemesterContextRichText(
          input.cell.value.richText.map((run) => ({
            ...run,
            font: clonePlainObject(run.font),
            text: replaceSemesterContextText(run.text, input.exportInput, context),
          })),
          input.targetWidth,
        ),
      ),
    };
  }

  const templateText =
    typeof input.cell.value === 'string'
      ? input.cell.value
      : buildFallbackSemesterContextText(input.exportInput, input.targetWidth);

  return padSemesterContextText(
    replaceSemesterContextText(templateText, input.exportInput, context),
  );
}

function keepSingleLineHeaderCell(
  cell: Cell,
  options: {
    horizontal?: NonNullable<Cell['alignment']>['horizontal'];
    shrinkToFit?: boolean;
  } = {},
) {
  cell.alignment = {
    ...clonePlainObject(cell.alignment),
    horizontal: options.horizontal ?? cell.alignment?.horizontal ?? 'center',
    shrinkToFit: options.shrinkToFit ?? true,
    vertical: cell.alignment?.vertical ?? 'middle',
    wrapText: false,
  };
}

function renderDocumentCodeHeaderRow(input: {
  exportInput: AcademicWorkloadDeductionExcelExportInput;
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
  totalColumnCount: number;
}) {
  const templateRow = input.templateWorksheet.getRow(1);
  const targetRow = input.targetWorksheet.getRow(1);
  const targetCell = targetRow.getCell(1);

  copyRowHeight(templateRow, targetRow);
  copyCellStyle(templateRow.getCell(1), targetCell);
  targetCell.value = buildDocumentCodeValue({
    sheetName: input.exportInput.sheetName,
    templateValue: templateRow.getCell(1).value,
  });
  keepSingleLineHeaderCell(targetCell, { shrinkToFit: false });
  input.targetWorksheet.mergeCells(1, 1, 1, input.totalColumnCount);
}

function renderStaticHeaderRows(input: {
  exportInput: AcademicWorkloadDeductionExcelExportInput;
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
  totalColumnCount: number;
}) {
  renderDocumentCodeHeaderRow(input);

  for (let rowNumber = 2; rowNumber <= 3; rowNumber += 1) {
    const templateRow = input.templateWorksheet.getRow(rowNumber);
    const targetRow = input.targetWorksheet.getRow(rowNumber);
    const targetCell = targetRow.getCell(1);

    copyRowHeight(templateRow, targetRow);
    copyCellStyle(templateRow.getCell(1), targetCell);

    if (rowNumber === 2) {
      targetCell.value = buildTitleValue(templateRow.getCell(1).value, input.exportInput.sheetName);
    } else if (rowNumber === 3) {
      targetCell.value = buildSemesterContextValue({
        cell: templateRow.getCell(1),
        exportInput: input.exportInput,
        targetWidth: getSemesterContextTargetWidth({
          templateWorksheet: input.templateWorksheet,
          totalColumnCount: input.totalColumnCount,
        }),
      });
      keepSingleLineHeaderCell(targetCell, { shrinkToFit: false });
    } else {
      targetCell.value = clonePlainObject(templateRow.getCell(1).value);
    }

    input.targetWorksheet.mergeCells(rowNumber, 1, rowNumber, input.totalColumnCount);
  }
}

function renderTableHeaderRow(input: {
  dateHeaders: string[];
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
  totalColumnCount: number;
}) {
  renderTemplateStyledRow({
    targetRowNumber: HEADER_ROW_NUMBER,
    targetWorksheet: input.targetWorksheet,
    templateRowNumber: TEMPLATE_HEADER_ROW_NUMBER,
    templateWorksheet: input.templateWorksheet,
    totalColumnCount: input.totalColumnCount,
    values: [...TABLE_HEADER_LABELS, ...input.dateHeaders, '小计', '合计'],
  });
}

function toExcelNumber(value: number | string) {
  if (typeof value === 'number') {
    return value;
  }

  if (value === '') {
    return value;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : value;
}

function getDetailRowValues(input: {
  dateColumnCount: number;
  row: AcademicWorkloadDeductionExcelRow;
  totalColumnCount: number;
}): CellValue[] {
  return [
    input.row.staffRowIndex === 0 ? input.row.sequence : '',
    input.row.staffRowIndex === 0 ? input.row.staffId : '',
    input.row.staffRowIndex === 0 ? input.row.staffName : '',
    input.row.teachingClassName,
    input.row.courseName,
    toExcelNumber(input.row.baselineWeeklyHours),
    toExcelNumber(input.row.baselineTeachingWeekCount),
    ...normalizeDateValues(input.row.dateValues, input.dateColumnCount).map(toExcelNumber),
    toExcelNumber(input.row.subtotal),
    input.row.staffRowIndex === 0 ? toExcelNumber(input.row.staffTotal) : '',
  ].slice(0, input.totalColumnCount);
}

function mergeStyleWithBottomBorder(style: Partial<Style>, bottomBorderStyle: Partial<Style>) {
  return {
    ...style,
    border: {
      ...style.border,
      bottom: clonePlainObject(bottomBorderStyle.border?.bottom),
    },
  };
}

function renderDetailRows(input: {
  dateColumnCount: number;
  rows: AcademicWorkloadDeductionExcelRow[];
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
  totalColumnCount: number;
}) {
  input.rows.forEach((row, rowIndex) => {
    const rowNumber = DATA_START_ROW_NUMBER + rowIndex;
    const targetRow = renderTemplateStyledRow({
      targetRowNumber: rowNumber,
      targetWorksheet: input.targetWorksheet,
      templateRowNumber: TEMPLATE_FIRST_DETAIL_ROW_NUMBER,
      templateWorksheet: input.templateWorksheet,
      totalColumnCount: input.totalColumnCount,
      values: getDetailRowValues({
        dateColumnCount: input.dateColumnCount,
        row,
        totalColumnCount: input.totalColumnCount,
      }),
    });

    forEachGeneratedColumn(input.totalColumnCount, (columnNumber) => {
      if (
        row.staffRowIndex === 0 &&
        (columnNumber <= 3 || columnNumber === input.totalColumnCount)
      ) {
        const bottomStyle = getTemplateCell({
          columnNumber,
          rowNumber: TEMPLATE_LAST_DETAIL_ROW_NUMBER,
          templateWorksheet: input.templateWorksheet,
          totalColumnCount: input.totalColumnCount,
        }).style;

        targetRow.getCell(columnNumber).style = mergeStyleWithBottomBorder(
          targetRow.getCell(columnNumber).style,
          bottomStyle,
        );
      }
    });
  });

  input.rows.forEach((row, rowIndex) => {
    if (row.staffRowIndex !== 0 || row.staffRowSpan <= 1) {
      return;
    }

    const startRowNumber = DATA_START_ROW_NUMBER + rowIndex;
    const endRowNumber = startRowNumber + row.staffRowSpan - 1;

    [1, 2, 3, input.totalColumnCount].forEach((columnNumber) => {
      input.targetWorksheet.mergeCells(startRowNumber, columnNumber, endRowNumber, columnNumber);

      const bottomStyle = getTemplateCell({
        columnNumber,
        rowNumber: TEMPLATE_LAST_DETAIL_ROW_NUMBER,
        templateWorksheet: input.templateWorksheet,
        totalColumnCount: input.totalColumnCount,
      }).style;
      const endCell = input.targetWorksheet.getRow(endRowNumber).getCell(columnNumber);

      endCell.style = {
        ...endCell.style,
        border: {
          ...endCell.style.border,
          bottom: clonePlainObject(bottomStyle.border?.bottom),
        },
      };
    });
  });

  input.rows.forEach((_, rowIndex) => {
    copyRowHeight(
      input.templateWorksheet.getRow(TEMPLATE_FIRST_DETAIL_ROW_NUMBER),
      input.targetWorksheet.getRow(DATA_START_ROW_NUMBER + rowIndex),
    );
  });
}

function renderSummaryRow(input: {
  exportInput: AcademicWorkloadDeductionExcelExportInput;
  rowNumber: number;
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
  totalColumnCount: number;
}) {
  const templateRow = input.templateWorksheet.getRow(TEMPLATE_SUMMARY_ROW_NUMBER);
  const targetRow = renderTemplateStyledRow({
    targetRowNumber: input.rowNumber,
    targetWorksheet: input.targetWorksheet,
    templateRowNumber: TEMPLATE_SUMMARY_ROW_NUMBER,
    templateWorksheet: input.templateWorksheet,
    totalColumnCount: input.totalColumnCount,
  });
  const subtotalColumnNumber = input.totalColumnCount - 1;

  targetRow.getCell(1).value = buildSummaryLabelValue({
    fallbackLabel: input.exportInput.summaryLabel,
    sheetName: input.exportInput.sheetName,
    templateValue: templateRow.getCell(1).value,
  });
  targetRow.getCell(input.totalColumnCount).value = toExcelNumber(input.exportInput.summaryTotal);
  input.targetWorksheet.mergeCells(input.rowNumber, 1, input.rowNumber, subtotalColumnNumber);

  const summaryEndCell = targetRow.getCell(subtotalColumnNumber);
  const summaryEndStyle = templateRow.getCell(TEMPLATE_SUBTOTAL_COLUMN_NUMBER).style;

  summaryEndCell.style = {
    ...summaryEndCell.style,
    border: {
      ...summaryEndCell.style.border,
      right: clonePlainObject(summaryEndStyle.border?.right),
    },
  };
}

function renderSpacerRow(input: {
  rowNumber: number;
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
  totalColumnCount: number;
}) {
  renderTemplateStyledRow({
    targetRowNumber: input.rowNumber,
    targetWorksheet: input.targetWorksheet,
    templateRowNumber: TEMPLATE_SPACER_ROW_NUMBER,
    templateWorksheet: input.templateWorksheet,
    totalColumnCount: input.totalColumnCount,
  });
}

function renderFooterRow(input: {
  rowNumber: number;
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
  totalColumnCount: number;
}) {
  const templateRow = input.templateWorksheet.getRow(TEMPLATE_FOOTER_ROW_NUMBER);
  const targetRow = input.targetWorksheet.getRow(input.rowNumber);
  const rightSignatureColumnNumber = Math.max(8, input.totalColumnCount - 4);
  const rightSignatureStartColumnNumber = Math.max(7, rightSignatureColumnNumber - 2);

  copyRowHeight(templateRow, targetRow);

  forEachGeneratedColumn(input.totalColumnCount, (columnNumber) => {
    const templateColumnNumber =
      columnNumber === rightSignatureColumnNumber
        ? TEMPLATE_RIGHT_SIGNATURE_COLUMN_NUMBER
        : Math.min(columnNumber, TEMPLATE_TOTAL_COLUMN_NUMBER);
    const targetCell = targetRow.getCell(columnNumber);

    copyCellStyle(templateRow.getCell(templateColumnNumber), targetCell);
    targetCell.value = '';
  });

  targetRow.getCell(1).value = clonePlainObject(templateRow.getCell(1).value);
  targetRow.getCell(5).value = clonePlainObject(templateRow.getCell(5).value);
  targetRow.getCell(rightSignatureStartColumnNumber).value = clonePlainObject(
    templateRow.getCell(TEMPLATE_RIGHT_SIGNATURE_COLUMN_NUMBER).value,
  );
  copyCellStyle(
    templateRow.getCell(TEMPLATE_RIGHT_SIGNATURE_COLUMN_NUMBER),
    targetRow.getCell(rightSignatureStartColumnNumber),
  );
  input.targetWorksheet.mergeCells(input.rowNumber, 1, input.rowNumber, 3);
  input.targetWorksheet.mergeCells(input.rowNumber, 5, input.rowNumber, 6);
  input.targetWorksheet.mergeCells(
    input.rowNumber,
    rightSignatureStartColumnNumber,
    input.rowNumber,
    rightSignatureColumnNumber,
  );
}

export async function exportAcademicWorkloadDeductionExcel(
  input: AcademicWorkloadDeductionExcelExportInput,
) {
  const ExcelJS = await import('exceljs');
  const { templateWorksheet, workbook } = await loadTemplateWorkbook(ExcelJS);
  const worksheet = workbook.addWorksheet(sanitizeWorksheetName(input.sheetName));
  const dateHeaders = normalizeDateHeaders(input.dateHeaders);
  const totalColumnCount = FIXED_COLUMN_COUNT + dateHeaders.length + TRAILING_COLUMN_COUNT;
  const summaryRowNumber = DATA_START_ROW_NUMBER + input.rows.length;
  const spacerRowNumber = summaryRowNumber + 1;
  const footerRowNumber = spacerRowNumber + 1;

  copySheetLayout(templateWorksheet, worksheet);
  applyTemplateColumnWidths({
    targetWorksheet: worksheet,
    templateWorksheet,
    totalColumnCount,
  });
  renderStaticHeaderRows({
    exportInput: input,
    targetWorksheet: worksheet,
    templateWorksheet,
    totalColumnCount,
  });
  renderTableHeaderRow({
    dateHeaders,
    targetWorksheet: worksheet,
    templateWorksheet,
    totalColumnCount,
  });
  renderDetailRows({
    dateColumnCount: dateHeaders.length,
    rows: input.rows,
    targetWorksheet: worksheet,
    templateWorksheet,
    totalColumnCount,
  });
  renderSummaryRow({
    exportInput: input,
    rowNumber: summaryRowNumber,
    targetWorksheet: worksheet,
    templateWorksheet,
    totalColumnCount,
  });
  renderSpacerRow({
    rowNumber: spacerRowNumber,
    targetWorksheet: worksheet,
    templateWorksheet,
    totalColumnCount,
  });
  renderFooterRow({
    rowNumber: footerRowNumber,
    targetWorksheet: worksheet,
    templateWorksheet,
    totalColumnCount,
  });
  applyPrintArea({
    footerRowNumber,
    targetWorksheet: worksheet,
    totalColumnCount,
  });
  workbook.removeWorksheet(templateWorksheet.id);

  const buffer = await workbook.xlsx.writeBuffer();
  const patchedBuffer = await patchWorkbookDefaultFont(buffer as ArrayBuffer);
  const blob = new Blob([patchedBuffer], { type: EXCEL_MIME_TYPE });

  downloadBlob(blob, input.fileName);
}
