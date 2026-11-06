// src/labs/student-registration-cards/infrastructure/card-batch-adapter.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GraphQLIngressError } from '@/shared/graphql';

import { BatchSessionExpiredError } from '../application/card-batch.types';

import { CardSessionExpiredError, fetchCard, generateCard, type GeneratedCard } from './api';
import { cardBatchOperations, mapBatchGeneration } from './card-batch-adapter';

vi.mock('./api', () => ({
  CardSessionExpiredError: class extends Error {},
  fetchCard: vi.fn(),
  generateCard: vi.fn(),
}));
const response = (): GeneratedCard => ({
  studentId: 'S1',
  canGenerate: true,
  status: 'WARNING',
  warningCodes: ['FAMILY_MISSING'],
  issueCodes: [],
  missingSections: [],
  scoreOverflows: [],
  termMaterialReadiness: { status: 'READY', terms: [] },
  downloadToken: 'token',
  fileName: ' S1-张三-学籍卡.docx ',
  expiresAt: '2027-01-01T00:00:00Z',
});
beforeEach(() => vi.resetAllMocks());
describe('批量出卡 API 适配', () => {
  it('只向编排层返回内部模型，并转换日期、文件名和提醒', async () => {
    const raw = response();
    vi.mocked(generateCard).mockResolvedValue(raw);
    const result = await cardBatchOperations.generate('S1');
    expect(result).toEqual({
      kind: 'generated',
      warnings: ['FAMILY_MISSING'],
      document: {
        token: 'token',
        fileName: 'S1-张三-学籍卡.docx',
        expiresAtMs: Date.parse(raw.expiresAt!),
      },
    });
    expect(result.warnings).not.toBe(raw.warningCodes);
    await cardBatchOperations.fetch({ token: 'token', fileName: null, expiresAtMs: 0 });
    expect(fetchCard).toHaveBeenCalledWith({ downloadToken: 'token' });
  });
  it.each([{ status: 'BLOCKED' }, { canGenerate: false }, { downloadToken: null }])(
    '阻塞、无权或缺凭证映射为不可出卡：%o',
    (patch) => {
      expect(
        mapBatchGeneration({
          ...response(),
          ...patch,
          issueCodes: ['PRIVATE_PROFILE_SNAPSHOT_MISSING'],
        }),
      ).toEqual({
        kind: 'blocked',
        warnings: ['FAMILY_MISSING'],
        reasons: ['PRIVATE_PROFILE_SNAPSHOT_MISSING'],
      });
    },
  );
  it.each([null, 'invalid-date'])('缺失或无效过期时间按已过期处理：%s', (expiresAt) => {
    expect(mapBatchGeneration({ ...response(), expiresAt })).toMatchObject({
      document: { expiresAtMs: 0 },
    });
  });
  it.each([
    new CardSessionExpiredError('expired'),
    new GraphQLIngressError({ type: 'auth', message: 'expired' }),
  ])('鉴权异常转换为流程错误：%s', async (error) => {
    vi.mocked(generateCard).mockRejectedValueOnce(error);
    await expect(cardBatchOperations.generate('S1')).rejects.toBeInstanceOf(
      BatchSessionExpiredError,
    );
    vi.mocked(fetchCard).mockRejectedValueOnce(error);
    await expect(
      cardBatchOperations.fetch({ token: 'token', expiresAtMs: 0, fileName: null }),
    ).rejects.toBeInstanceOf(BatchSessionExpiredError);
  });
  it('普通下载错误保留原始原因，不误判为登录失效', async () => {
    const error = new Error('network');
    vi.mocked(fetchCard).mockRejectedValueOnce(error);
    await expect(
      cardBatchOperations.fetch({ token: 'token', expiresAtMs: 0, fileName: null }),
    ).rejects.toBe(error);
  });
});
