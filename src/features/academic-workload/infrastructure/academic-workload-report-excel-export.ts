// src/features/academic-workload/infrastructure/academic-workload-report-excel-export.ts
import type { Cell, CellValue, Row, Worksheet } from 'exceljs';

type RichTextRun = {
  font?: Cell['font'];
  text: string;
};

type RichTextCellValue = {
  richText: RichTextRun[];
};

export type AcademicWorkloadReportExcelRow = {
  coefficient: number | string;
  courseName: string;
  hours: number | string;
  sequence: number | string;
  staffName: string;
  staffRowIndex: number;
  staffRowSpan: number;
  staffTotal: number | string;
  teachingClassName: string;
  weekCount: number | string;
  weeklyHours: number | string;
};

export type AcademicWorkloadReportExcelExportInput = {
  departmentName: string;
  fileName: string;
  rows: AcademicWorkloadReportExcelRow[];
  schoolYear: number | null;
  sheetName: string;
  summaryLabel: string;
  summaryTotal: string;
  termNumber: number | null;
};

const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const TEMPLATE_PATH = 'templates/workload-report.xlsx';
const WORKBOOK_STYLES_PATH = 'xl/styles.xml';
const HEADER_START_ROW_NUMBER = 4;
const HEADER_END_ROW_NUMBER = 5;
const DATA_START_ROW_NUMBER = 6;
const TEMPLATE_FIRST_DETAIL_ROW_NUMBER = 6;
const TEMPLATE_LAST_DETAIL_ROW_NUMBER = 7;
const TEMPLATE_SUMMARY_ROW_NUMBER = 8;
const TEMPLATE_SPACER_ROW_NUMBER = 9;
const TEMPLATE_FOOTER_ROW_NUMBER = 10;
const COLUMN_COUNT = 11;
const TEACHING_CLASS_COLUMN_NUMBER = 3;
const DETAIL_HOURS_COLUMN_NUMBER = 8;
const STAFF_TOTAL_COLUMN_NUMBER = 9;
const EMPTY_TEXT = '-';
const OBJECT_URL_REVOKE_DELAY_MS = 30_000;
const TEMPLATE_NORMAL_FONT_XML =
  '<font><sz val="12"/><name val="宋体"/><family val="3"/><charset val="134"/></font>';
const TABLE_HEADER_LABELS = [
  '序号',
  '姓名',
  '任课班级',
  '课程',
  '周课时',
  '周数',
  '系数',
  '课时',
  '总课时（节）',
  '签名',
  '备注',
];
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

  return sanitizedValue.slice(0, 31) || '教师工作量预报';
}

function sanitizeFileName(value: string) {
  const forbiddenCharacters = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);
  const sanitizedValue = Array.from(value)
    .map((character) =>
      forbiddenCharacters.has(character) || character.charCodeAt(0) < 32 ? ' ' : character,
    )
    .join('')
    .trim();

  return sanitizedValue || '教师工作量预报.xlsx';
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
    throw new Error('暂时无法读取教师工作量预报模板。');
  }

  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load(await response.arrayBuffer());

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('教师工作量预报模板缺少工作表。');
  }

  return { templateWorksheet: worksheet, workbook };
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
  targetWorksheet.views = clonePlainObject(templateWorksheet.views).map((view) => ({
    ...view,
    activeCell: 'A1',
    topLeftCell: 'A6',
  }));
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

function hasRichTextValue(value: CellValue): value is RichTextCellValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'richText' in value &&
    Array.isArray(value.richText)
  );
}

function buildTitleValue(templateValue: CellValue, sheetName: string) {
  const templateText =
    typeof templateValue === 'string'
      ? templateValue
      : '江苏省苏州技师学院系部教师工作量预报统计表(teacherEngagementType)';

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

function replaceDocumentCodeSuffix(text: string, sheetName: string) {
  if (sheetName !== PUBLIC_WELFARE_POST_SHEET_NAME) {
    return text;
  }

  return text.replace(/-1(\s*)$/u, '-2$1');
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
  input: AcademicWorkloadReportExcelExportInput,
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

function getTextDisplayWidth(value: string) {
  return Array.from(value).reduce((total, character) => {
    const codePoint = character.codePointAt(0) ?? 0;

    return total + (codePoint > 255 ? 2 : 1);
  }, 0);
}

function getSemesterContextTargetWidth(templateWorksheet: Worksheet) {
  let totalWidth = 0;

  forEachColumn((columnNumber) => {
    totalWidth += templateWorksheet.getColumn(columnNumber).width ?? 0;
  });

  return Math.max(
    SEMESTER_CONTEXT_MIN_MIDDLE_GAP,
    Math.floor(totalWidth) - SEMESTER_CONTEXT_WIDTH_SAFETY,
  );
}

function balanceSemesterContextRichText(
  runs: RichTextRun[],
  targetWidth: number,
  options: { gapAfterRunIndex?: number } = {},
) {
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

  lastRun.text = lastRun.text.replace(/[ \u3000]+$/u, '');

  const currentWidth = balancedRuns.reduce(
    (total, run) => total + getTextDisplayWidth(run.text),
    0,
  );
  const middleGapWidth = Math.max(0, targetWidth - currentWidth);

  if (middleGapWidth > 0) {
    const requestedGapRunIndex =
      options.gapAfterRunIndex === undefined ? 0 : options.gapAfterRunIndex + 1;
    const gapRunIndex = Math.min(Math.max(requestedGapRunIndex, 0), balancedRuns.length - 1);
    const gapRun = balancedRuns[gapRunIndex] ?? firstRun;
    const middleGap = ' '.repeat(middleGapWidth);

    gapRun.text =
      gapRun.text.trim() === '' ? `${gapRun.text}${middleGap}` : `${middleGap}${gapRun.text}`;
  }

  lastRun.text = `${lastRun.text}${SEMESTER_CONTEXT_TRAILING_GAP}`;

  return balancedRuns;
}

function buildFallbackSemesterContextText(
  input: AcademicWorkloadReportExcelExportInput,
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
  exportInput: AcademicWorkloadReportExcelExportInput;
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
    const departmentNameRunIndex = input.cell.value.richText.findIndex((run) =>
      run.text.includes('DEPARTMENT_NAME'),
    );

    return {
      richText: padSemesterContextRichText(
        balanceSemesterContextRichText(
          input.cell.value.richText.map((run) => ({
            ...run,
            font: clonePlainObject(run.font),
            text: replaceSemesterContextText(run.text, input.exportInput, context),
          })),
          input.targetWidth,
          {
            gapAfterRunIndex: departmentNameRunIndex >= 0 ? departmentNameRunIndex : undefined,
          },
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

function keepSingleLineHeaderCell(cell: Cell, options: { shrinkToFit?: boolean } = {}) {
  cell.alignment = {
    ...clonePlainObject(cell.alignment),
    horizontal: cell.alignment?.horizontal ?? 'center',
    shrinkToFit: options.shrinkToFit ?? true,
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
  keepSingleLineHeaderCell(targetCell, { shrinkToFit: input.rowNumber !== 1 });
  input.targetWorksheet.mergeCells(input.rowNumber, 1, input.rowNumber, COLUMN_COUNT);
}

function renderStaticHeaderRows(input: {
  exportInput: AcademicWorkloadReportExcelExportInput;
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
}) {
  const firstRow = input.templateWorksheet.getRow(1);
  const titleRow = input.templateWorksheet.getRow(2);
  const semesterContextRow = input.templateWorksheet.getRow(3);

  renderMergedHeaderRow({
    rowNumber: 1,
    targetWorksheet: input.targetWorksheet,
    templateWorksheet: input.templateWorksheet,
    value: buildDocumentCodeValue({
      sheetName: input.exportInput.sheetName,
      templateValue: firstRow.getCell(1).value,
    }),
  });
  renderMergedHeaderRow({
    rowNumber: 2,
    targetWorksheet: input.targetWorksheet,
    templateWorksheet: input.templateWorksheet,
    value: buildTitleValue(titleRow.getCell(1).value, input.exportInput.sheetName),
  });
  renderMergedHeaderRow({
    rowNumber: 3,
    targetWorksheet: input.targetWorksheet,
    templateWorksheet: input.templateWorksheet,
    value: buildSemesterContextValue({
      cell: semesterContextRow.getCell(1),
      exportInput: input.exportInput,
      targetWidth: getSemesterContextTargetWidth(input.templateWorksheet),
    }),
  });
}

function renderTableHeaderRows(input: {
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
}) {
  for (
    let rowNumber = HEADER_START_ROW_NUMBER;
    rowNumber <= HEADER_END_ROW_NUMBER;
    rowNumber += 1
  ) {
    const templateRow = input.templateWorksheet.getRow(rowNumber);
    const targetRow = input.targetWorksheet.getRow(rowNumber);

    copyRowHeight(templateRow, targetRow);
    forEachColumn((columnNumber) => {
      const targetCell = targetRow.getCell(columnNumber);

      copyCellStyle(templateRow.getCell(columnNumber), targetCell);
      targetCell.value =
        rowNumber === HEADER_START_ROW_NUMBER ? TABLE_HEADER_LABELS[columnNumber - 1] : '';
    });
  }

  forEachColumn((columnNumber) => {
    input.targetWorksheet.mergeCells(
      HEADER_START_ROW_NUMBER,
      columnNumber,
      HEADER_END_ROW_NUMBER,
      columnNumber,
    );
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

function parseExcelNumber(value: number | string) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const normalizedValue = value.trim().replaceAll(',', '');

  if (!normalizedValue) {
    return null;
  }

  const numericValue = Number(normalizedValue);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function toExcelNumber(value: number | string) {
  const numericValue = parseExcelNumber(value);

  return numericValue ?? value;
}

function formatTeachingClassExcelValue(value: string) {
  const teachingClassNames = value
    .split(/[,，、;；]/u)
    .map((item) => item.trim())
    .filter(Boolean);

  return teachingClassNames.length > 0 ? teachingClassNames.join('\n') : EMPTY_TEXT;
}

function buildFormulaValue(formula: string, resultValue: number | string): CellValue {
  const result = parseExcelNumber(resultValue);

  return result === null ? { formula } : { formula, result };
}

function getDetailRowValues(input: {
  groupEndRowNumber: number;
  groupStartRowNumber: number;
  row: AcademicWorkloadReportExcelRow;
  rowNumber: number;
}): CellValue[] {
  return [
    input.row.staffRowIndex === 0 ? input.row.sequence : '',
    input.row.staffRowIndex === 0 ? input.row.staffName : '',
    formatTeachingClassExcelValue(input.row.teachingClassName),
    input.row.courseName,
    toExcelNumber(input.row.weeklyHours),
    toExcelNumber(input.row.weekCount),
    toExcelNumber(input.row.coefficient),
    buildFormulaValue(
      `E${input.rowNumber}*F${input.rowNumber}*G${input.rowNumber}`,
      input.row.hours,
    ),
    input.row.staffRowIndex === 0
      ? buildFormulaValue(
          `SUM(H${input.groupStartRowNumber}:H${input.groupEndRowNumber})`,
          input.row.staffTotal,
        )
      : '',
    '',
    '',
  ];
}

function renderDetailRows(input: {
  rows: AcademicWorkloadReportExcelRow[];
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
      }),
    });
    const teachingClassCell = targetRow.getCell(TEACHING_CLASS_COLUMN_NUMBER);

    teachingClassCell.alignment = {
      ...clonePlainObject(teachingClassCell.alignment),
      wrapText: true,
    };

    if (row.staffRowIndex === 0) {
      [1, 2, STAFF_TOTAL_COLUMN_NUMBER, 10, 11].forEach((columnNumber) => {
        const bottomStyle = input.templateWorksheet
          .getRow(TEMPLATE_LAST_DETAIL_ROW_NUMBER)
          .getCell(columnNumber).style;
        const targetCell = targetRow.getCell(columnNumber);

        targetCell.style = {
          ...targetCell.style,
          border: {
            ...targetCell.style.border,
            bottom: clonePlainObject(bottomStyle.border?.bottom),
          },
        };
      });
    }
  });

  input.rows.forEach((row, rowIndex) => {
    if (row.staffRowIndex !== 0 || row.staffRowSpan <= 1) {
      return;
    }

    const startRowNumber = DATA_START_ROW_NUMBER + rowIndex;
    const endRowNumber = startRowNumber + row.staffRowSpan - 1;

    [1, 2, STAFF_TOTAL_COLUMN_NUMBER, 10, 11].forEach((columnNumber) => {
      input.targetWorksheet.mergeCells(startRowNumber, columnNumber, endRowNumber, columnNumber);

      const bottomStyle = input.templateWorksheet
        .getRow(TEMPLATE_LAST_DETAIL_ROW_NUMBER)
        .getCell(columnNumber).style;
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
}

function renderSummaryRow(input: {
  exportInput: AcademicWorkloadReportExcelExportInput;
  rowNumber: number;
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
}) {
  const templateRow = input.templateWorksheet.getRow(TEMPLATE_SUMMARY_ROW_NUMBER);
  const targetRow = renderTemplateStyledRow({
    targetRowNumber: input.rowNumber,
    targetWorksheet: input.targetWorksheet,
    templateRowNumber: TEMPLATE_SUMMARY_ROW_NUMBER,
    templateWorksheet: input.templateWorksheet,
  });
  const lastDataRowNumber = input.rowNumber - 1;

  targetRow.getCell(1).value = buildSummaryLabelValue({
    fallbackLabel: input.exportInput.summaryLabel,
    sheetName: input.exportInput.sheetName,
    templateValue: templateRow.getCell(1).value,
  });
  targetRow.getCell(STAFF_TOTAL_COLUMN_NUMBER).value = buildFormulaValue(
    `SUM(${getExcelColumnName(STAFF_TOTAL_COLUMN_NUMBER)}${DATA_START_ROW_NUMBER}:` +
      `${getExcelColumnName(STAFF_TOTAL_COLUMN_NUMBER)}${lastDataRowNumber})`,
    input.exportInput.summaryTotal,
  );
  input.targetWorksheet.mergeCells(input.rowNumber, 1, input.rowNumber, DETAIL_HOURS_COLUMN_NUMBER);
  input.targetWorksheet.mergeCells(
    input.rowNumber,
    STAFF_TOTAL_COLUMN_NUMBER,
    input.rowNumber,
    COLUMN_COUNT,
  );

  const summaryLabelEndCell = targetRow.getCell(DETAIL_HOURS_COLUMN_NUMBER);
  const summaryTotalEndCell = targetRow.getCell(COLUMN_COUNT);

  summaryLabelEndCell.style = {
    ...summaryLabelEndCell.style,
    border: {
      ...summaryLabelEndCell.style.border,
      right: clonePlainObject(templateRow.getCell(DETAIL_HOURS_COLUMN_NUMBER).border?.right),
    },
  };
  summaryTotalEndCell.style = {
    ...summaryTotalEndCell.style,
    border: {
      ...summaryTotalEndCell.style.border,
      right: clonePlainObject(templateRow.getCell(COLUMN_COUNT).border?.right),
    },
  };
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
}

function renderFooterRow(input: {
  rowNumber: number;
  targetWorksheet: Worksheet;
  templateWorksheet: Worksheet;
}) {
  const templateRow = input.templateWorksheet.getRow(TEMPLATE_FOOTER_ROW_NUMBER);
  const targetRow = input.targetWorksheet.getRow(input.rowNumber);

  copyRowHeight(templateRow, targetRow);
  forEachColumn((columnNumber) => {
    const targetCell = targetRow.getCell(columnNumber);

    copyCellStyle(templateRow.getCell(columnNumber), targetCell);
    targetCell.value = columnNumber === 1 ? clonePlainObject(templateRow.getCell(1).value) : '';
  });
  input.targetWorksheet.mergeCells(input.rowNumber, 1, input.rowNumber, COLUMN_COUNT);
}

export async function exportAcademicWorkloadReportExcel(
  input: AcademicWorkloadReportExcelExportInput,
) {
  const ExcelJS = await import('exceljs');
  const { templateWorksheet, workbook } = await loadTemplateWorkbook(ExcelJS);
  const worksheet = workbook.addWorksheet(sanitizeWorksheetName(input.sheetName));
  const summaryRowNumber = DATA_START_ROW_NUMBER + input.rows.length;
  const spacerRowNumber = summaryRowNumber + 1;
  const footerRowNumber = spacerRowNumber + 1;

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
  renderTableHeaderRows({
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
  renderFooterRow({
    rowNumber: footerRowNumber,
    targetWorksheet: worksheet,
    templateWorksheet,
  });
  applyPrintArea({
    footerRowNumber,
    targetWorksheet: worksheet,
  });
  workbook.removeWorksheet(templateWorksheet.id);

  const buffer = await workbook.xlsx.writeBuffer();
  const patchedBuffer = await patchWorkbookDefaultFont(buffer as ArrayBuffer);
  const blob = new Blob([patchedBuffer], { type: EXCEL_MIME_TYPE });

  downloadBlob(blob, input.fileName);
}
