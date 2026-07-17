// src/features/student-conduct-alignment/application/material-import-issue-display.spec.ts

import { describe, expect, it } from 'vitest';

import {
  buildMaterialImportIssueGroups,
  type MaterialImportIssueDisplayInput,
  resolveStudentConductGradeIssueMessage,
} from './material-import-issue-display';

function buildIssue(
  overrides: Partial<MaterialImportIssueDisplayInput>,
): MaterialImportIssueDisplayInput {
  return {
    code: 'DOCUMENT_TERM_MISMATCH',
    fieldKey: null,
    message: '上传文档中出现 2020-2021学年第二学期 字样，与当前学期不一致。',
    sourceFileDigest: 'digest-1',
    sourceFileIndex: 0,
    sourceFilename: '2020-2021第二学期 电气1904操行审批表、汇总表.docx',
    sourceRow: null,
    sourceSheetOrTable: null,
    studentId: null,
    ...overrides,
  };
}

describe('material import issue display', () => {
  it('uses target-term roster wording for canonical roster failures', () => {
    expect(
      resolveStudentConductGradeIssueMessage(
        {
          code: 'STUDENT_NOT_IN_TERM_ROSTER',
          message: null,
        },
        'fallback',
      ),
    ).toBe('学生不属于目标学期正式名单。');
    expect(
      resolveStudentConductGradeIssueMessage(
        {
          reasonCode: 'DETAIL_STUDENT_NOT_IN_CLASS',
          reasonMessage: '学生不在当前班级',
        },
        'fallback',
      ),
    ).toBe('学生不在该批次对应学期的正式名单。');
  });

  it('aggregates repeated term mismatch signals from the same file', () => {
    const issueGroups = buildMaterialImportIssueGroups(
      [
        buildIssue({
          sourceSheetOrTable: 'paragraph:2',
        }),
        buildIssue({
          sourceSheetOrTable: 'paragraph:218',
        }),
      ],
      'warning',
    );

    expect(issueGroups).toHaveLength(1);
    expect(issueGroups[0]).toMatchObject({
      message: '上传文档中出现 2020-2021学年第二学期 字样，与当前学期不一致。',
      positions: ['文档第 1 处', '文档第 2 处'],
      sourceFilename: '2020-2021第二学期 电气1904操行审批表、汇总表.docx',
    });
  });

  it('keeps different backend messages as separate confirmation groups', () => {
    const issueGroups = buildMaterialImportIssueGroups(
      [
        buildIssue({
          message: '上传文档中出现 2020-2021学年第二学期 字样，与当前学期不一致。',
          sourceSheetOrTable: 'paragraph:2',
        }),
        buildIssue({
          message: '上传文档中出现 2020-2021学年第一学期 字样，与当前学期不一致。',
          sourceSheetOrTable: 'paragraph:218',
        }),
      ],
      'warning',
    );

    expect(issueGroups).toHaveLength(2);
    expect(issueGroups[0]?.message).toContain('上传文档中出现 2020-2021学年第二学期 字样');
    expect(issueGroups[1]?.message).toContain('上传文档中出现 2020-2021学年第一学期 字样');
  });

  it('displays page labels when backend provides page locators', () => {
    const issueGroups = buildMaterialImportIssueGroups(
      [
        buildIssue({
          sourceSheetOrTable: 'page:1',
        }),
        buildIssue({
          sourceSheetOrTable: 'page:2',
        }),
      ],
      'warning',
    );

    expect(issueGroups).toHaveLength(1);
    expect(issueGroups[0]?.positions).toEqual(['第一页', '第二页']);
  });

  it('aggregates the same backend message across material positions', () => {
    const issueGroups = buildMaterialImportIssueGroups(
      [
        buildIssue({
          message: '上传文档中出现 2020-2021学年第二学期 字样，与当前学期不一致。',
          sourceSheetOrTable: 'page:1',
        }),
        buildIssue({
          message: '上传文档中出现 2020-2021学年第二学期 字样，与当前学期不一致。',
          sourceSheetOrTable: 'page:2',
        }),
      ],
      'warning',
    );

    expect(issueGroups).toHaveLength(1);
    expect(issueGroups[0]?.positions).toEqual(['第一页', '第二页']);
  });

  it('uses generic fallback messages instead of exposing issue codes', () => {
    const issueGroups = buildMaterialImportIssueGroups(
      [
        buildIssue({
          message: null,
          sourceSheetOrTable: 'paragraph',
          sourceRow: 2,
        }),
      ],
      'warning',
    );

    expect(issueGroups[0]?.message).toBe('材料中存在需要确认的信息，请确认后继续导入。');
    expect(issueGroups[0]?.message).not.toContain('DOCUMENT_TERM_MISMATCH');
    expect(issueGroups[0]?.positions).toEqual(['文档第 1 处']);
  });
});
