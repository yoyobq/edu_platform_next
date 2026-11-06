// src/labs/student-registration-cards/application/card-batch.ts
import {
  type BatchDocument,
  BatchSessionExpiredError,
  type BatchStudent,
  type CardBatchOperations,
} from './card-batch.types';

export type BatchRow = BatchStudent & {
  status: 'pending' | 'generating' | 'fetching' | 'success' | 'blocked' | 'failed';
  warnings: string[];
  reason: string;
  document?: BatchDocument;
  bytes?: Uint8Array;
};
export const BATCH_STATUS = {
  pending: '待处理',
  generating: '正在生成',
  fetching: '正在收取文档',
  success: '成功',
  blocked: '材料阻塞',
  failed: '失败',
};
export function createBatch(students: BatchStudent[]): BatchRow[] {
  return students.map((student) => ({ ...student, status: 'pending', warnings: [], reason: '' }));
}

export async function runCardBatch(
  rows: BatchRow[],
  shouldStop: () => boolean,
  changed: () => void,
  retry: boolean,
  operations: CardBatchOperations,
) {
  for (const row of rows) {
    if (shouldStop()) break;
    if (row.status === 'success' || (!retry && row.status !== 'pending')) continue;
    row.reason = '';
    try {
      if (!row.document || row.document.expiresAtMs <= Date.now()) {
        row.document = undefined;
        row.status = 'generating';
        changed();
        const result = await operations.generate(row.studentId);
        row.warnings = result.warnings;
        if (result.kind === 'blocked') {
          row.status = 'blocked';
          row.reason = result.reasons.join('、') || '无出卡权限或材料阻塞';
          changed();
          continue;
        }
        row.document = result.document;
      }
      row.status = 'fetching';
      changed();
      row.bytes = await operations.fetch(row.document);
      row.status = 'success';
    } catch (error) {
      row.status = 'failed';
      const expired = error instanceof BatchSessionExpiredError;
      row.reason = expired
        ? '登录已失效，已停止后续导出'
        : row.document
          ? '文档下载失败，可重试'
          : '文档生成失败，可重试';
      changed();
      if (expired) break;
      continue;
    }
    changed();
  }
}
