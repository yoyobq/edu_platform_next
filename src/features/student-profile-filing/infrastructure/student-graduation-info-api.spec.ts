// src/features/student-profile-filing/infrastructure/student-graduation-info-api.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/shared/graphql', () => ({ executeGraphQL: request }));

import { patchGraduationInfo, readGraduationInfo } from './student-graduation-info-api';

describe('毕业信息请求契约', () => {
  beforeEach(() => {
    request.mockReset();
  });

  it('无主档案只读状态原样保留，不创建快照或调用补录', async () => {
    const view = {
      studentId: 'S1',
      revision: 'ABSENT',
      mainSnapshotPresent: false,
      canEdit: false,
      fields: [],
    };
    request.mockResolvedValue({ studentPrivateProfileGraduationInfo: view });
    await expect(readGraduationInfo('S1')).resolves.toBe(view);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(expect.stringContaining('mainSnapshotPresent'), {
      input: { studentId: 'S1' },
    });
  });

  it('本地保存携带 CAS 而不携带上游会话，冲突交回调用方', async () => {
    const failure = new Error('conflict');
    const input = {
      studentId: 'S1',
      expectedRevision: 'revision-1',
      fields: [{ field: 'GRADUATION_CERTIFICATE_NO', action: 'SET' as const, value: 'LOCAL-1' }],
    };
    request.mockRejectedValue(failure);
    await expect(patchGraduationInfo(input)).rejects.toBe(failure);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('patchStudentPrivateProfileGraduationInfo'),
      { input },
    );
    expect(request.mock.calls[0]?.[0]).not.toContain('upstreamSessionToken');
  });
});
