// src/labs/student-conduct-grade-governance/material-import-panel.spec.ts

import { describe, expect, it } from 'vitest';

import type { StudentConductGradeMaterialImportIssue } from './api';
import { buildMaterialImportIssueGroups } from './material-import-issue-display';

function buildIssue(
  overrides: Partial<StudentConductGradeMaterialImportIssue>,
): StudentConductGradeMaterialImportIssue {
  return {
    code: 'DOCUMENT_TERM_MISMATCH',
    confirmed: false,
    fieldKey: null,
    message: null,
    schoolYear: '2020',
    semester: '2',
    sourceFileDigest: 'digest-1',
    sourceFileIndex: 0,
    sourceFilename: '2020-2021第二学期 电气1904操行审批表、汇总表.docx',
    sourceRow: null,
    sourceSheetOrTable: null,
    studentId: null,
    warningKey: null,
    ...overrides,
  };
}

describe('material import issue display', () => {
  it('aggregates repeated term mismatch signals from the same file', () => {
    const issueGroups = buildMaterialImportIssueGroups(
      [
        buildIssue({
          sourceSheetOrTable: 'paragraph:2',
          warningKey: 'warning-key-1',
        }),
        buildIssue({
          sourceSheetOrTable: 'paragraph:218',
          warningKey: 'warning-key-2',
        }),
      ],
      'warning',
      {
        targetTerm: {
          schoolYear: '2020',
          semester: '2',
        },
      },
    );

    expect(issueGroups).toHaveLength(1);
    expect(issueGroups[0]).toMatchObject({
      message:
        '上传文档中出现 2020-2021学年第二学期 字样，和当前导入学期 2020-2021学年第二学期 不一致。请确认是否仍按当前 tab 导入。',
      positions: ['文档第 1 处', '文档第 2 处'],
      sourceFilename: '2020-2021第二学期 电气1904操行审批表、汇总表.docx',
    });
  });

  it('keeps different document terms as separate confirmation groups', () => {
    const issueGroups = buildMaterialImportIssueGroups(
      [
        buildIssue({
          semester: '2',
          sourceSheetOrTable: 'paragraph:2',
          warningKey: 'warning-key-1',
        }),
        buildIssue({
          semester: '1',
          sourceSheetOrTable: 'paragraph:218',
          warningKey: 'warning-key-2',
        }),
      ],
      'warning',
      {
        targetTerm: {
          label: '2020-2021学年第二学期',
          schoolYear: '2020',
          semester: '2',
        },
      },
    );

    expect(issueGroups).toHaveLength(2);
    expect(issueGroups[0]?.message).toContain('上传文档中出现 2020-2021学年第二学期 字样');
    expect(issueGroups[1]?.message).toContain('上传文档中出现 2020-2021学年第一学期 字样');
    expect(issueGroups[1]?.message).toContain('当前导入学期 2020-2021学年第二学期');
  });

  it('displays page labels when backend provides page locators', () => {
    const issueGroups = buildMaterialImportIssueGroups(
      [
        buildIssue({
          sourceSheetOrTable: 'page:1',
          warningKey: 'warning-key-1',
        }),
        buildIssue({
          sourceSheetOrTable: 'page:2',
          warningKey: 'warning-key-2',
        }),
      ],
      'warning',
      {
        targetTerm: {
          schoolYear: '2020',
          semester: '2',
        },
      },
    );

    expect(issueGroups).toHaveLength(1);
    expect(issueGroups[0]?.positions).toEqual(['第一页', '第二页']);
  });

  it('uses friendly fallback messages instead of exposing issue codes', () => {
    const issueGroups = buildMaterialImportIssueGroups(
      [
        buildIssue({
          message: null,
          sourceSheetOrTable: 'paragraph',
          sourceRow: 2,
          warningKey: 'warning-key-1',
        }),
      ],
      'warning',
      {
        targetTerm: {
          schoolYear: '2020',
          semester: '2',
        },
      },
    );

    expect(issueGroups[0]?.message).toContain('上传文档中出现 2020-2021学年第二学期 字样');
    expect(issueGroups[0]?.message).not.toContain('DOCUMENT_TERM_MISMATCH');
    expect(issueGroups[0]?.positions).toEqual(['文档第 1 处']);
  });
});
