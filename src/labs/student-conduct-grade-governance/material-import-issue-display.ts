// src/labs/student-conduct-grade-governance/material-import-issue-display.ts

import type { StudentConductGradeMaterialImportIssue } from './api';

export type MaterialImportIssueDisplayType = 'error' | 'warning';

export type MaterialImportIssueGroup = {
  key: string;
  message: string;
  positions: string[];
  sourceFilename: string | null;
};

type MutableMaterialImportIssueGroup = MaterialImportIssueGroup & {
  positionSet: Set<string>;
};

type MaterialImportIssuePosition = {
  key: string;
  label: string;
};

function resolveMaterialImportIssueMessage(
  issue: StudentConductGradeMaterialImportIssue,
  type: MaterialImportIssueDisplayType,
) {
  const message = issue.message?.trim();

  if (message) {
    return message;
  }

  if (type === 'warning') {
    return '材料中存在需要确认的信息，请确认后继续导入。';
  }

  return '材料中存在阻断导入的问题，请修正后重新上传。';
}

function resolveMaterialImportIssuePosition(
  issue: StudentConductGradeMaterialImportIssue,
  occurrenceNumber: number,
): MaterialImportIssuePosition | null {
  const sourceSheetOrTable = issue.sourceSheetOrTable?.trim() || null;
  const key = `${sourceSheetOrTable ?? ''}:${issue.sourceRow ?? ''}`;

  if (sourceSheetOrTable) {
    const pageNumber = parseSourceLocatorNumber(sourceSheetOrTable, 'page');

    if (pageNumber !== null) {
      return {
        key,
        label: `第${formatChinesePositiveInteger(pageNumber)}页`,
      };
    }

    if (isParagraphLocator(sourceSheetOrTable)) {
      return {
        key,
        label: `文档第 ${occurrenceNumber} 处`,
      };
    }

    const sheetName = parseSourceLocatorText(sourceSheetOrTable, 'sheet');
    if (sheetName) {
      return {
        key,
        label:
          issue.sourceRow !== null
            ? `工作表“${sheetName}”第 ${issue.sourceRow} 行`
            : `工作表“${sheetName}”`,
      };
    }

    const tableNumber = parseSourceLocatorNumber(sourceSheetOrTable, 'table');
    if (tableNumber !== null) {
      return {
        key,
        label:
          issue.sourceRow !== null
            ? `第 ${tableNumber} 个表格第 ${issue.sourceRow} 行`
            : `第 ${tableNumber} 个表格`,
      };
    }
  }

  if (sourceSheetOrTable) {
    return {
      key,
      label:
        issue.sourceRow !== null
          ? `${sourceSheetOrTable} 第 ${issue.sourceRow} 行`
          : sourceSheetOrTable,
    };
  }

  if (issue.sourceRow !== null) {
    return {
      key,
      label: `第 ${issue.sourceRow} 行`,
    };
  }

  return null;
}

function isParagraphLocator(value: string) {
  return /^paragraph(?::\d+)?$/i.test(value);
}

function parseSourceLocatorNumber(value: string, prefix: string) {
  const match = value.match(new RegExp(`^${prefix}:(\\d+)$`, 'i'));

  if (!match) {
    return null;
  }

  const numberValue = Number(match[1]);

  return Number.isSafeInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function parseSourceLocatorText(value: string, prefix: string) {
  const match = value.match(new RegExp(`^${prefix}:(.+)$`, 'i'));
  const text = match?.[1]?.trim();

  return text || null;
}

function formatChinesePositiveInteger(value: number) {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

  if (value > 0 && value < 10) {
    return digits[value];
  }

  if (value === 10) {
    return '十';
  }

  if (value > 10 && value < 20) {
    return `十${digits[value % 10]}`;
  }

  if (value > 19 && value < 100) {
    const ten = Math.floor(value / 10);
    const one = value % 10;

    return `${digits[ten]}十${one > 0 ? digits[one] : ''}`;
  }

  return String(value);
}

export function buildMaterialImportIssueGroups(
  issues: readonly StudentConductGradeMaterialImportIssue[],
  type: MaterialImportIssueDisplayType,
): MaterialImportIssueGroup[] {
  const groupByKey = new Map<string, MutableMaterialImportIssueGroup>();

  issues.forEach((issue) => {
    const message = resolveMaterialImportIssueMessage(issue, type);
    const sourceFilename = issue.sourceFilename?.trim() || null;
    const key = JSON.stringify([
      issue.sourceFileDigest,
      issue.sourceFileIndex,
      sourceFilename,
      issue.code,
      message,
      issue.fieldKey,
      issue.studentId,
    ]);
    let group = groupByKey.get(key);

    if (!group) {
      group = {
        key,
        message,
        positionSet: new Set<string>(),
        positions: [],
        sourceFilename,
      };
      groupByKey.set(key, group);
    }

    const position = resolveMaterialImportIssuePosition(issue, group.positions.length + 1);

    if (position && !group.positionSet.has(position.key)) {
      group.positionSet.add(position.key);
      group.positions.push(position.label);
    }
  });

  return Array.from(groupByKey.values()).map((group) => ({
    key: group.key,
    message: group.message,
    positions: group.positions,
    sourceFilename: group.sourceFilename,
  }));
}
