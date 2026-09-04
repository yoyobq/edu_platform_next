// src/features/academic-workload/infrastructure/academic-workload-teacher-total-clipboard.spec.ts
import { describe, expect, it } from 'vitest';

import {
  buildAcademicWorkloadTeacherTotalsClipboardText,
  buildAcademicWorkloadTeacherTotalsWithStaffIdClipboardText,
} from './academic-workload-teacher-total-clipboard';

describe('buildAcademicWorkloadTeacherTotalsClipboardText', () => {
  it('按一位教师一行生成可直接粘贴到 Excel 的三列纯文本', () => {
    expect(
      buildAcademicWorkloadTeacherTotalsClipboardText({
        rows: [
          { sequence: 1, staffName: '张老师', totalHours: '32.00' },
          { sequence: 2, staffName: '李老师', totalHours: '24.50' },
        ],
        totalHeader: '总课时',
      }),
    ).toBe('序号\t姓名\t总课时\n1\t张老师\t32.00\n2\t李老师\t24.50');
  });

  it('支持不同报表的合计列表头', () => {
    expect(
      buildAcademicWorkloadTeacherTotalsClipboardText({
        rows: [{ sequence: 1, staffName: '王老师', totalHours: '-2' }],
        totalHeader: '扣课合计',
      }),
    ).toBe('序号\t姓名\t扣课合计\n1\t王老师\t-2');
  });

  it('为工作量预报在序号和姓名之间加入工号列', () => {
    expect(
      buildAcademicWorkloadTeacherTotalsWithStaffIdClipboardText({
        rows: [
          { sequence: 1, staffId: 'T-001', staffName: '张老师', totalHours: '32.00' },
          { sequence: 2, staffId: 'T-002', staffName: '李老师', totalHours: '24.50' },
        ],
        totalHeader: '总课时',
      }),
    ).toBe('序号\t工号\t姓名\t总课时\n1\tT-001\t张老师\t32.00\n2\tT-002\t李老师\t24.50');
  });

  it('移除单元格中的制表符和换行，避免粘贴时产生额外行列', () => {
    expect(
      buildAcademicWorkloadTeacherTotalsClipboardText({
        rows: [{ sequence: 1, staffName: '张\t老师\n一', totalHours: '32.00' }],
        totalHeader: '总课时',
      }),
    ).toBe('序号\t姓名\t总课时\n1\t张 老师 一\t32.00');
  });
});
