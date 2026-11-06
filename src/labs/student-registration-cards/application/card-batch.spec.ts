// src/labs/student-registration-cards/application/card-batch.spec.ts
import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildBatchArchive } from '../infrastructure/batch-archive';

import { createBatch, runCardBatch } from './card-batch';
import {
  type BatchGeneration,
  BatchSessionExpiredError,
  type CardBatchOperations,
} from './card-batch.types';

const generateCard = vi.fn<CardBatchOperations['generate']>();
const fetchCard = vi.fn<CardBatchOperations['fetch']>();
const operations: CardBatchOperations = { generate: generateCard, fetch: fetchCard };
const students = [1, 2, 3].map((id) => ({ studentId: String(id), studentName: `学生${id}` }));
const card = (id: string): Extract<BatchGeneration, { kind: 'generated' }> => ({
  kind: 'generated',
  warnings: ['FAMILY_MISSING'],
  document: {
    token: id,
    fileName: `${id}-学生${id}-学籍卡.docx`,
    expiresAtMs: Date.parse('2099-01-01T00:00:00Z'),
  },
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(generateCard).mockImplementation(async (id) => card(id));
  vi.mocked(fetchCard).mockResolvedValue(new Uint8Array([80, 75]));
});
describe('学籍卡批量导出', () => {
  it('严格逐人生成后收取，材料提醒继续，ZIP 包含独立文档及结果 CSV', async () => {
    const rows = createBatch(students);
    const order: string[] = [];
    vi.mocked(generateCard).mockImplementation(async (id) => {
      order.push(`生成${id}`);
      return card(id);
    });
    vi.mocked(fetchCard).mockImplementation(async (result) => {
      order.push(`收取${result.token}`);
      return new Uint8Array([80, 75]);
    });
    await runCardBatch(
      rows,
      () => false,
      () => {},
      false,
      operations,
    );
    expect(order).toEqual(['生成1', '收取1', '生成2', '收取2', '生成3', '收取3']);
    const archive = await buildBatchArchive(rows, '测试班', () => '缺家庭信息');
    const zip = await JSZip.loadAsync(await archive.blob.arrayBuffer());
    expect(Object.keys(zip.files)).toEqual([
      '1-学生1-学籍卡.docx',
      '2-学生2-学籍卡.docx',
      '3-学生3-学籍卡.docx',
      '导出结果.csv',
    ]);
    expect(await zip.file('导出结果.csv')?.async('string')).toContain('缺家庭信息');
    expect(archive.fileName).toMatch(/^测试班-学籍卡-\d{8}-\d{6}\.zip$/);
  });
  it('单个阻塞和生成失败不影响后续学生', async () => {
    vi.mocked(generateCard)
      .mockResolvedValueOnce({
        kind: 'blocked',
        warnings: [],
        reasons: ['PRIVATE_PROFILE_SNAPSHOT_MISSING'],
      })
      .mockRejectedValueOnce(new Error('failed'));
    const rows = createBatch(students);
    await runCardBatch(
      rows,
      () => false,
      () => {},
      false,
      operations,
    );
    expect(rows.map((row) => row.status)).toEqual(['blocked', 'failed', 'success']);
    await runCardBatch(
      rows,
      () => false,
      () => {},
      true,
      operations,
    );
    expect(generateCard).toHaveBeenCalledTimes(5);
    expect(rows.map((row) => row.status)).toEqual(['success', 'success', 'success']);
  });
  it('停止等待当前学生收取完，继续时跳过成功项', async () => {
    let stop = false;
    vi.mocked(fetchCard).mockImplementationOnce(async () => {
      stop = true;
      return new Uint8Array([1]);
    });
    const rows = createBatch(students);
    await runCardBatch(
      rows,
      () => stop,
      () => {},
      false,
      operations,
    );
    expect(rows.map((row) => row.status)).toEqual(['success', 'pending', 'pending']);
    await runCardBatch(
      rows,
      () => false,
      () => {},
      false,
      operations,
    );
    expect(generateCard).toHaveBeenCalledTimes(3);
  });
  it('下载失败优先复用凭证，凭证过期才重新生成', async () => {
    const rows = createBatch(students.slice(0, 1));
    vi.mocked(fetchCard).mockRejectedValueOnce(new Error('download'));
    await runCardBatch(
      rows,
      () => false,
      () => {},
      false,
      operations,
    );
    await runCardBatch(
      rows,
      () => false,
      () => {},
      true,
      operations,
    );
    expect(generateCard).toHaveBeenCalledTimes(1);
    expect(rows[0].status).toBe('success');
    rows[0].status = 'failed';
    rows[0].document!.expiresAtMs = 0;
    await runCardBatch(
      rows,
      () => false,
      () => {},
      true,
      operations,
    );
    expect(generateCard).toHaveBeenCalledTimes(2);
  });
  it.each([new BatchSessionExpiredError('expired')])(
    '登录失效后停止后续请求：%s',
    async (error) => {
      vi.mocked(fetchCard).mockRejectedValueOnce(error);
      const rows = createBatch(students);
      await runCardBatch(
        rows,
        () => false,
        () => {},
        false,
        operations,
      );
      expect(generateCard).toHaveBeenCalledTimes(1);
      expect(rows.map((row) => row.status)).toEqual(['failed', 'pending', 'pending']);
    },
  );
});
