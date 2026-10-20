// e2e/specs/routing/teaching-inspection.spec.ts
import type { Page } from '@playwright/test';

import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';
const path = '/labs/teaching-inspection';
const dates = ['2026-09-10', '2026-09-20', '2026-10-01'];
const account = {
  accountId: 700,
  displayName: '测试检查人',
  primaryAccessGroup: 'ADMIN' as const,
  identity: { kind: 'STAFF' as const, id: 'T700' },
};
type Input = {
  kind: string;
  semesterId: number;
  resourceKey: string;
  clientRequestId: string;
  previewId: string;
  scheduleVersion: number;
  round: number;
  checkDate: string;
  operationId?: string;
  retryOfOperationId?: string;
  changes: {
    resourceKey: string;
    dates: string[];
    expectedVersion: number;
    expectedSourceVersion: string;
  }[];
};
async function setup(
  page: Page,
  options: {
    assigned?: boolean;
    noStaff?: boolean;
    groupLeader?: boolean;
    authFailure?: boolean;
    dispatchingAuthFailure?: 'PREPARE' | 'SAVE';
    noSession?: boolean;
    unknownSave?: boolean;
  } = {},
) {
  await page.clock.setFixedTime(new Date('2026-10-18T04:00:00Z'));
  await mockApiHealth(page);
  const currentSession = {
    ...account,
    ...(options.noStaff ? { identity: null } : {}),
    ...(options.groupLeader
      ? { primaryAccessGroup: 'STAFF' as const, slotGroup: ['TEACHING_GROUP_LEADER'] }
      : {}),
  };
  await mockAuthGraphQL(page, { currentSession });
  await seedAuthSession(page, currentSession);
  if (!options.noSession)
    await page.addInitScript(() => {
      localStorage.setItem(
        'aigc-friendly-frontend.upstream.session.v2',
        JSON.stringify({
          version: 2,
          accountId: 700,
          upstreamLoginId: 'T700',
          upstreamSessionToken: 'synthetic-session',
          expiresAt: '2030-01-01T00:00:00Z',
        }),
      );
    });
  const requests: { query: string; input: Input }[] = [];
  let retryReady = false,
    count = 0,
    saveAttempts = 0;
  let trusted = false,
    version = options.assigned === false ? 0 : 1,
    coveredFloor = 0;
  const savedRounds = new Set<number>();
  const operations = new Map<
    string,
    {
      id: string;
      accountId: number;
      requestId: string;
      action: string;
      round: number;
      checkDate: string;
      state: string;
      previewId: string | null;
    }
  >();
  const preparations = new Map<string, object>();
  const latestUnknown = () =>
    [...operations.values()]
      .filter((op) => op.state === 'UNKNOWN' || op.state === 'DISPATCHING')
      .at(-1);
  // Fixture models count-only inference around known saves; history evidence is backend-owned.
  const coverage = () => {
    const covered = new Set(savedRounds);
    for (const round of [1, 2, 3]) {
      if (covered.size >= coveredFloor) break;
      covered.add(round);
    }
    return covered;
  };
  const resource = (key: string) => ({
    resourceKey: key,
    sourceVersion: 'source-1',
    courseName: key === '1:a' ? '测试课程甲' : '测试课程乙',
    teacherNames: ['测试教师'],
    suggestedDates: dates,
    earliestDate: '2026-09-01',
    latestDate: '2026-12-31',
    blockers: [],
    schedule: {
      version,
      dates: version ? dates : [],
      rounds: version
        ? dates.map((date, index) => ({
            round: index + 1,
            date,
            operationId: null,
            operationState: savedRounds.has(index + 1) ? 'SAVED' : null,
            savedOperationId: savedRounds.has(index + 1) ? 'saved' : null,
          }))
        : [],
    },
    status: {
      state: trusted ? 'TRUSTED' : 'UNREAD',
      upstreamCount: trusted ? count : null,
      observedAt: trusted ? '2026-10-18T04:00:00Z' : null,
      observationVersion: trusted ? 1 : 0,
      effectiveCoveredCount: coverage().size,
      rounds: [1, 2, 3].map((round) => ({
        round,
        covered: coverage().has(round),
        coverageBasis: savedRounds.has(round) ? ['SAVED'] : coverage().has(round) ? ['COUNT'] : [],
        canPrepare: trusted && version > 0 && !coverage().has(round) && !latestUnknown(),
        blockers: [
          ...(!trusted ? ['STATUS_UNKNOWN'] : []),
          ...(!version ? ['SCHEDULE_REQUIRED'] : []),
          ...(coverage().has(round) ? ['COMPLETED'] : []),
          ...(latestUnknown()
            ? retryReady
              ? round === latestUnknown()?.round
                ? ['RETRY_CONFIRMATION_REQUIRED']
                : []
              : ['PENDING_OPERATION']
            : []),
        ],
        retryAfter: retryReady ? '2026-10-18T03:55:00Z' : null,
        retryWarningOperationId:
          retryReady && round === latestUnknown()?.round ? (latestUnknown()?.id ?? null) : null,
      })),
    },
  });
  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON() as { query: string; variables?: { input: Input } };
    const query = body.query,
      input = body.variables?.input as Input;
    const reply = async (data: object) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) });
    if (query.includes('InspectionSemesters'))
      return reply({
        academicSemesters: [
          {
            id: 1,
            name: '测试学期',
            schoolYear: 2026,
            termNumber: 1,
            isCurrent: true,
            isVisible: true,
          },
        ],
      });
    if (
      !/TeachingInspection|(?:Prepare|Save)(?:Progress|LessonPlan|Assignment)Inspection/.test(query)
    )
      return route.fallback();
    requests.push({ query, input });
    if (query.includes('TeachingInspectionWorkspace'))
      return reply({
        result: {
          today: '2026-10-18',
          total: 2,
          teachers: [{ staffId: 'T700', name: '测试教师' }],
          resources: [resource('1:a'), resource('1:b')],
        },
      });
    if (query.includes('RefreshTeachingInspectionStatus')) {
      trusted = true;
      coveredFloor = Math.max(coveredFloor, Math.min(count, 3));
      return reply({
        result: {
          schedule: resource('1:a').schedule,
          status: resource('1:a').status,
          upstreamSessionToken: 'rolled-token',
          expiresAt: '2030-01-01T00:00:00Z',
        },
      });
    }
    if (query.includes('TeachingInspectionDatePreview'))
      return reply({
        result: input.changes.map((change) => ({
          version: change.expectedVersion,
          dates: change.dates,
          rounds: [],
        })),
      });
    if (query.includes('SaveTeachingInspectionSchedule')) {
      version++;
      return reply({
        result: input.changes.map((change) => ({ version, dates: change.dates, rounds: [] })),
      });
    }
    if (query.includes('mutation CloseUnstartedTeachingInspectionRequest')) {
      const existing = operations.get(input.clientRequestId);
      if (existing) return reply({ result: existing });
      const closed = {
        id: `closed-${operations.size}`,
        accountId: 700,
        requestId: input.clientRequestId,
        action: (input as Input & { action: string }).action,
        round: input.round,
        checkDate: input.checkDate,
        state: 'REJECTED',
        previewId: null,
      };
      operations.set(input.clientRequestId, closed);
      return reply({ result: closed });
    }
    if (query.includes('query TeachingInspectionOperation')) {
      const operation = input.operationId
        ? [...operations.values()].find((op) => op.id === input.operationId)
        : operations.get(input.clientRequestId);
      return operation
        ? reply({ result: operation })
        : route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              errors: [{ message: '暂未查到操作', extensions: { code: 'NOT_FOUND' } }],
            }),
          });
    }
    if (/mutation Prepare/.test(query)) {
      if (preparations.has(input.clientRequestId))
        return reply({ result: preparations.get(input.clientRequestId) });
      if (input.kind === 'PROGRESS') version += 2;
      const operation = {
        id: `op-${operations.size}`,
        accountId: 700,
        requestId: input.clientRequestId,
        action: 'PREPARE',
        round: input.round,
        checkDate: input.checkDate,
        state: 'PREPARED',
        previewId: `preview-${operations.size}`,
      };
      if (options.dispatchingAuthFailure === 'PREPARE') operation.state = 'DISPATCHING';
      operations.set(input.clientRequestId, operation);
      if (options.dispatchingAuthFailure === 'PREPARE')
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            errors: [{ message: '上游认证失败', extensions: { code: 'UNAUTHENTICATED' } }],
          }),
        });
      const result = {
        operation,
        preview: {
          id: operation.previewId,
          round: input.round,
          checkDate: input.checkDate,
          scheduleVersion: version,
          observationVersion: 1,
          expiresAt: '2026-10-18T04:30:00Z',
        },
        blockers: [],
        upstreamSessionToken: 'prepared-token',
        expiresAt: '2030-01-01T00:00:00Z',
        material: {
          lesson:
            input.kind === 'LESSON_PLAN'
              ? {
                  chapter: '测试章节',
                  scores: [4, 95],
                  scoreItems: [
                    { name: '格式', description: '测试格式说明', maximum: 5 },
                    { name: '教学内容', description: '测试内容说明', maximum: 95 },
                  ],
                }
              : null,
          progress:
            input.kind === 'PROGRESS'
              ? { actualProgress: 12, plannedProgress: 12, deviation: 0 }
              : null,
          assignment:
            input.kind === 'ASSIGNMENT'
              ? {
                  assignedBook: '适中',
                  assignmentQuantity: '适量',
                  knowledgeCoverage: '全面',
                  allMarkingStatus: '全部',
                  markingErrors: '有',
                  markingCorrections: '有',
                  markingAndDateDetails: '有',
                  studentCompletionStatus: '完成',
                  studentCorrectionStatus: '正常',
                  checkerOpinion: '测试预填意见',
                }
              : null,
        },
      };
      preparations.set(input.clientRequestId, result);
      return reply({ result });
    }
    if (/mutation Save/.test(query)) {
      saveAttempts++;
      const preparation = [...operations.values()].find(
        (op) => op.action === 'PREPARE' && op.previewId === input.previewId,
      );
      if (!preparation) throw new Error('保存必须引用已准备的快照');
      const operation = {
        id: `op-${operations.size}`,
        accountId: 700,
        requestId: input.clientRequestId,
        action: 'SAVE',
        round: preparation.round,
        checkDate: preparation.checkDate,
        state:
          options.dispatchingAuthFailure === 'SAVE'
            ? 'DISPATCHING'
            : options.authFailure || (options.unknownSave && saveAttempts === 1)
              ? 'UNKNOWN'
              : 'SAVED',
        previewId: input.previewId,
      };
      operations.set(input.clientRequestId, operation);
      if (options.authFailure || options.dispatchingAuthFailure === 'SAVE')
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            errors: [{ message: '请重新连接校园网', extensions: { code: 'UNAUTHENTICATED' } }],
          }),
        });
      if (operation.state === 'SAVED') {
        coveredFloor = Math.min(3, coverage().size + 1);
        savedRounds.add(operation.round);
      }
      version++;
      return reply({
        result: {
          operation,
          upstreamSessionToken: 'saved-token',
          expiresAt: '2030-01-01T00:00:00Z',
        },
      });
    }
    return route.fallback();
  });
  return {
    requests,
    operations,
    resource,
    releaseRetry: () => {
      retryReady = true;
    },
    setCount: (value: number) => {
      count = value;
    },
    setTrusted: () => {
      trusted = true;
    },
  };
}
async function openAndPrepare(page: Page, kind: string) {
  await page.goto(`${path}?kind=${kind}&semester=1`);
  await page.getByRole('button', { name: '查看检查' }).first().click();
  await page.getByRole('button', { name: '刷新检查状态', exact: true }).click();
  await page.getByRole('button', { name: '准备材料', exact: true }).click();
  await expect(page.getByText('预填材料，请核对后提交')).toBeVisible();
}
for (const kind of ['lesson-plan', 'progress', 'assignment'])
  test(`${kind} 核对后单条保存，成功不额外刷新上游`, async ({ page }) => {
    const fixture = await setup(page);
    await openAndPrepare(page, kind);
    if (kind === 'lesson-plan') {
      await page.getByRole('spinbutton', { name: '格式', exact: true }).fill('4.5');
      await expect(page.getByText('合计：99.5 分')).toBeVisible();
    }
    await page.getByRole('checkbox', { name: '我已核对课程、日期及上述材料' }).check();
    await page.getByRole('button', { name: '确认并保存本条检查' }).click();
    await expect(page.getByText('保存成功', { exact: true })).toBeVisible();
    expect(fixture.requests.filter((item) => /mutation Save/.test(item.query))).toHaveLength(1);
    expect(
      fixture.requests.filter((item) => item.query.includes('RefreshTeachingInspectionStatus')),
    ).toHaveLength(1);
    const recovery = await page.evaluate(() =>
      sessionStorage.getItem('teaching-inspection.recovery.v1.700'),
    );
    expect(JSON.parse(recovery!)).toEqual([]);
  });
test('首屏不调用上游，非法类型规范化，窄屏可浏览与键盘进入检查', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await setup(page, { noSession: true });
  await page.goto(`${path}?kind=invalid&semester=1`);
  await expect(page.getByRole('heading', { name: '教学检查' })).toBeVisible();
  await expect(page).toHaveURL(/kind=lesson-plan/);
  await expect(page.getByText('尚未刷新', { exact: false }).first()).toBeVisible();
  expect(fixture.requests.every((item) => item.query.includes('TeachingInspectionWorkspace'))).toBe(
    true,
  );
  await page.getByRole('button', { name: '查看检查' }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '刷新检查状态', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect.poll(async () => (await page.getByRole('dialog').boundingBox())?.x).toBe(0);
  await page.screenshot({ path: '/tmp/teaching-inspection-mobile.png', fullPage: true });
});
test('刷新后按原输入恢复进度材料，原版本不被当前版本替换', async ({ page }) => {
  const fixture = await setup(page);
  await openAndPrepare(page, 'progress');
  const original = fixture.requests.find((item) => /mutation Prepare/.test(item.query))!.input;
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await page.getByRole('button', { name: '查看检查' }).first().click();
  await page.getByRole('button', { name: '恢复材料', exact: true }).click();
  await expect(page.getByText('预填材料，请核对后提交')).toBeVisible();
  const prepares = fixture.requests.filter((item) => /mutation Prepare/.test(item.query));
  expect(prepares).toHaveLength(2);
  expect(prepares[1].input.clientRequestId).toBe(original.clientRequestId);
  expect(prepares[1].input.scheduleVersion).toBe(1);
  expect(fixture.operations.size).toBe(1);
});
test('保存认证失败时不自动重发，重载后可查询 UNKNOWN', async ({ page }) => {
  const fixture = await setup(page, { authFailure: true });
  await openAndPrepare(page, 'assignment');
  await page.getByRole('checkbox', { name: '我已核对课程、日期及上述材料' }).check();
  await page.getByRole('button', { name: '确认并保存本条检查' }).click();
  await expect(
    page.getByText('会话已失效。重新连接后，请先查询操作结果；不会自动重新提交。'),
  ).toBeVisible();
  expect(fixture.requests.filter((item) => /mutation Save/.test(item.query))).toHaveLength(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await page.getByRole('button', { name: '查看检查' }).first().click();
  await expect(page.getByText('保存检查 · 结果未确认')).toBeVisible();
  expect(fixture.requests.filter((item) => /mutation Save/.test(item.query))).toHaveLength(1);
});
test('日期预览与保存复用相同集合、原版本和来源指纹', async ({ page }) => {
  const fixture = await setup(page, { assigned: false });
  await page.goto(`${path}?kind=assignment&semester=1`);
  await page
    .getByRole('row', { name: /测试课程甲/ })
    .getByRole('checkbox')
    .check();
  await page.getByRole('button', { name: '批量安排日期' }).click();
  await page.getByRole('button', { name: '预览日期', exact: true }).click();
  await page.getByRole('button', { name: '确认保存日期' }).click();
  await expect(page.getByRole('dialog', { name: /安排检查日期/ })).toHaveCount(0);
  const preview = fixture.requests.find((item) =>
    item.query.includes('TeachingInspectionDatePreview'),
  )!.input;
  const save = fixture.requests.find((item) =>
    item.query.includes('SaveTeachingInspectionSchedule'),
  )!.input;
  expect(save).toEqual(preview);
  expect(save.changes).toHaveLength(1);
  expect(save.changes[0].expectedVersion).toBe(0);
});
test('恢复存储写入失败时不发送准备请求', async ({ page }) => {
  const fixture = await setup(page);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('teaching-inspection.recovery.')) throw new Error('quota');
      return original.call(this, key, value);
    };
  });
  await page.goto(`${path}?kind=progress&semester=1`);
  await page.getByRole('button', { name: '查看检查' }).first().click();
  await page.getByRole('button', { name: '刷新检查状态', exact: true }).click();
  await page.getByRole('button', { name: '准备材料', exact: true }).click();
  await expect(page.getByText('无法保存恢复标识，已停止新操作。请保留本标签页。')).toBeVisible();
  expect(fixture.requests.filter((item) => /mutation Prepare/.test(item.query))).toHaveLength(0);
});
for (const slotGroup of [[], ['ACADEMIC_OFFICER']])
  test(`staff ${slotGroup.join()} 无组长任职时拒绝进入`, async ({ page }) => {
    const denied = { ...account, primaryAccessGroup: 'STAFF' as const, slotGroup };
    await mockApiHealth(page);
    await mockAuthGraphQL(page, { currentSession: denied });
    await seedAuthSession(page, denied);
    await page.goto(path);
    await expect(page.getByRole('heading', { name: '访问被拒绝' })).toBeVisible();
  });

test('未知保存超时后，明确确认风险才用新请求重试并贯穿风险操作 ID', async ({ page }) => {
  const fixture = await setup(page, { unknownSave: true });
  await openAndPrepare(page, 'assignment');
  await page.getByRole('checkbox', { name: '我已核对课程、日期及上述材料' }).check();
  await page.getByRole('button', { name: '确认并保存本条检查' }).click();
  await expect(page.getByText('结果未确认', { exact: true })).toBeVisible();
  const unknown = [...fixture.operations.values()].find((op) => op.state === 'UNKNOWN')!;
  fixture.releaseRetry();
  await page.getByRole('button', { name: '刷新检查状态', exact: true }).click();
  await expect(page.getByRole('button', { name: '准备材料', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: /我确认承担本次重试风险/ }).check();
  await page.getByRole('button', { name: '准备材料', exact: true }).click();
  await page.getByRole('checkbox', { name: '我已核对课程、日期及上述材料' }).check();
  await page.getByRole('button', { name: '确认并保存本条检查' }).click();
  await expect(page.getByText('保存成功', { exact: true })).toBeVisible();
  const prepares = fixture.requests.filter((item) => /mutation Prepare/.test(item.query));
  const saves = fixture.requests.filter((item) => /mutation Save/.test(item.query));
  expect(prepares).toHaveLength(2);
  expect(saves).toHaveLength(2);
  expect(prepares[1].input.retryOfOperationId).toBe(unknown.id);
  expect(saves[1].input.retryOfOperationId).toBe(unknown.id);
  expect(saves[1].input.clientRequestId).not.toBe(saves[0].input.clientRequestId);
});
test('数量覆盖不能把 UNKNOWN 显示成保存成功', async ({ page }) => {
  const fixture = await setup(page, { unknownSave: true });
  await openAndPrepare(page, 'assignment');
  await page.getByRole('checkbox', { name: '我已核对课程、日期及上述材料' }).check();
  await page.getByRole('button', { name: '确认并保存本条检查' }).click();
  await expect(page.getByText('结果未确认', { exact: true })).toBeVisible();
  fixture.setCount(1);
  fixture.releaseRetry();
  await page.getByRole('button', { name: '刷新检查状态', exact: true }).click();
  await expect(page.getByText('第 1 轮：数量推定')).toBeVisible();
  await expect(page.getByText('结果未确认', { exact: true })).toBeVisible();
  await expect(page.getByText('保存成功', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '准备材料', exact: true })).toBeDisabled();
});
test('明确 operation:null 的阻断清除本次恢复跟踪', async ({ page }) => {
  const fixture = await setup(page);
  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON() as { query: string };
    if (!/mutation Prepare/.test(body.query)) return route.fallback();
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          result: {
            preview: null,
            operation: null,
            material: { lesson: null, progress: null, assignment: null },
            blockers: ['MATERIAL_UNVERIFIED'],
            upstreamSessionToken: 'same',
            expiresAt: '2030-01-01T00:00:00Z',
          },
        },
      }),
    });
  });
  await page.goto(`${path}?kind=lesson-plan&semester=1`);
  await page.getByRole('button', { name: '查看检查' }).first().click();
  await page.getByRole('button', { name: '刷新检查状态', exact: true }).click();
  await page.getByRole('button', { name: '准备材料', exact: true }).click();
  await expect(page.getByText('当前材料无法核验，暂不能提交')).toBeVisible();
  expect(
    JSON.parse(
      (await page.evaluate(() => sessionStorage.getItem('teaching-inspection.recovery.v1.700')))!,
    ),
  ).toEqual([]);
  expect(
    fixture.requests.filter((item) => item.query.includes('TeachingInspectionOperation')),
  ).toHaveLength(0);
});
test('操作暂未查到时保留原请求，禁止另建请求直接重试', async ({ page }) => {
  const fixture = await setup(page);
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'teaching-inspection.recovery.v1.700',
      JSON.stringify([
        {
          accountId: 700,
          semesterId: 1,
          kind: 'PROGRESS',
          resourceKey: '1:a',
          action: 'SAVE',
          clientRequestId: 'uncertain-save-id',
        },
      ]),
    ),
  );
  await page.goto(`${path}?kind=progress&semester=1`);
  await page.getByRole('button', { name: '查看检查' }).first().click();
  await expect(
    page.getByText('部分操作暂未查到结果，请继续查询；查不到不代表没有提交。'),
  ).toBeVisible();
  await page.getByRole('button', { name: '刷新检查状态', exact: true }).click();
  await expect(page.getByRole('button', { name: '准备材料', exact: true })).toBeDisabled();
  expect(
    fixture.requests.filter((item) => /mutation (Prepare|Save)/.test(item.query)),
  ).toHaveLength(0);
});
test('切换类型后，迟到工作区读取不覆盖当前课程', async ({ page }) => {
  const fixture = await setup(page);
  let start!: () => void, release!: () => void;
  const started = new Promise<void>((resolve) => {
    start = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON() as { query: string; variables?: { input: Input } };
    if (
      !body.query.includes('TeachingInspectionWorkspace') ||
      body.variables?.input.kind !== 'LESSON_PLAN'
    )
      return route.fallback();
    start();
    await released;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          result: {
            today: '2026-10-18',
            total: 1,
            teachers: [],
            resources: [{ ...fixture.resource('1:a'), courseName: '迟到旧课程' }],
          },
        },
      }),
    });
  });
  await page.goto(`${path}?kind=lesson-plan&semester=1`);
  await started;
  await page.getByRole('tab', { name: '作业检查', exact: true }).click();
  await expect(page.getByText('测试课程甲')).toBeVisible();
  release();
  await expect(page.getByText('迟到旧课程')).toHaveCount(0);
  await expect(page).toHaveURL(/kind=assignment/);
});
test('管理员可切换校园网教职工，登录弹窗没有组件警告', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await setup(page, { noSession: true });
  await page.goto(`${path}?semester=1`);
  await page.getByRole('button', { name: '连接校园网教职工' }).click();
  const input = page.getByRole('textbox', { name: /工号|学号|账号/ });
  await expect(input).toBeEnabled();
  await input.fill('T701');
  await expect(input).toHaveValue('T701');
  await page.screenshot({ path: '/tmp/teaching-inspection-login.png', fullPage: true });
  expect(errors.filter((error) => error.includes('Warning:'))).toEqual([]);
});

test('深色主题保留类型深链接和前进后退，切换时清空课程勾选', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('color-scheme', 'dark'));
  await setup(page);
  await page.goto(`${path}?kind=lesson-plan&semester=1&teacher=T700&keyword=测试`);
  await page
    .getByRole('row', { name: /测试课程甲/ })
    .getByRole('checkbox')
    .check();
  await expect(page.getByText('已选 1 门课程')).toBeVisible();
  await page.getByRole('tab', { name: '作业检查', exact: true }).click();
  await expect(page).toHaveURL(/kind=assignment/);
  await expect(page.getByText('已选 1 门课程')).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('tab', { name: '教案检查', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('searchbox', { name: '搜索课程' })).toHaveValue('测试');
  await page.goForward();
  await expect(page.getByRole('tab', { name: '作业检查', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: '查看检查' }).first().click();
  await page.getByRole('button', { name: '刷新检查状态', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('button', { name: '准备材料', exact: true })).toBeEnabled();
  await expect.poll(async () => (await page.getByRole('dialog').boundingBox())?.width).toBe(640);
  await page.screenshot({ path: '/tmp/teaching-inspection-dark.png', fullPage: true });
});

test('日期编辑使预览失效，保存冲突须刷新依据再确认且保留草稿', async ({ page }) => {
  const fixture = await setup(page);
  let saveCalls = 0,
    currentVersion = 1;
  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON() as { query: string; variables?: { input: Input } };
    if (body.query.includes('TeachingInspectionWorkspace')) {
      const resource = fixture.resource('1:a');
      resource.schedule.version = currentVersion;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: { result: { today: '2026-10-18', total: 1, teachers: [], resources: [resource] } },
        }),
      });
    }
    if (!body.query.includes('SaveTeachingInspectionSchedule')) return route.fallback();
    saveCalls++;
    if (saveCalls === 1) {
      currentVersion = 2;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          errors: [{ message: '安排已更新，请重新核对', extensions: { code: 'CONFLICT' } }],
        }),
      });
    }
    expect(body.variables?.input.changes[0].expectedVersion).toBe(2);
    expect(body.variables?.input.changes[0].dates[0]).toBe('2026-09-12');
    return route.fallback();
  });
  await page.goto(`${path}?kind=lesson-plan&semester=1`);
  await page
    .getByRole('row', { name: /测试课程甲/ })
    .getByRole('checkbox')
    .check();
  await page.getByRole('button', { name: '批量安排日期' }).click();
  const date = page.getByLabel('测试课程甲第1轮日期');
  await page.getByRole('button', { name: '预览日期', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认保存日期' })).toBeEnabled();
  await date.fill('2026-09-12');
  await expect(page.getByRole('button', { name: '确认保存日期' })).toBeDisabled();
  await page.getByRole('button', { name: '预览日期', exact: true }).click();
  await page.getByRole('button', { name: '确认保存日期' }).click();
  await expect(page.getByRole('button', { name: '预览日期', exact: true })).toBeDisabled();
  expect(saveCalls).toBe(1);
  await page.getByRole('button', { name: '刷新依据并重新核对' }).click();
  await expect(date).toHaveValue('2026-09-12');
  await expect(page.getByRole('button', { name: '确认保存日期' })).toBeDisabled();
  await page.getByRole('button', { name: '预览日期', exact: true }).click();
  await page.getByRole('button', { name: '确认保存日期' }).click();
  await expect(page.getByRole('dialog', { name: /安排检查日期/ })).toHaveCount(0);
  expect(saveCalls).toBe(2);
});

test('未绑定教职工的管理员可从 Labs 菜单打开教学检查', async ({ page }) => {
  await setup(page, { noSession: true, noStaff: true });
  await page.goto('/');
  await page.getByRole('menuitem', { name: /Labs$/ }).click();
  await page.getByRole('menuitem', { name: /教学检查$/ }).click();
  await expect(page).toHaveURL(/\/labs\/teaching-inspection/);
  await expect(page.getByRole('heading', { name: '教学检查', exact: true })).toBeVisible();
});

test('教研组长的上游登录仍锁定本人', async ({ page }) => {
  await setup(page, { noSession: true, groupLeader: true });
  await page.goto(`${path}?semester=1`);
  await page.getByRole('button', { name: '连接本人校园网' }).click();
  const input = page.getByRole('textbox', { name: /工号|学号|账号/ });
  await expect(input).toHaveValue('T700');
  await expect(input).toBeDisabled();
});

test('管理员切换检查人后清空预览，旧检查人的恢复入口不会使用新身份', async ({ page }) => {
  const fixture = await setup(page, { noStaff: true });
  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON() as { query: string };
    if (!body.query.includes('mutation LoginUpstreamSession')) return route.fallback();
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          loginUpstreamSession: {
            expiresAt: '2030-01-01T00:00:00Z',
            upstreamSessionToken: 'other-inspector-token',
          },
        },
      }),
    });
  });
  await openAndPrepare(page, 'assignment');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog').filter({ hasText: '未保存评分会丢弃。' })).toBeVisible();
  await page.getByRole('button', { name: /确.*定/ }).click();
  await page.getByRole('button', { name: '切换校园网教职工' }).click();
  await page.getByRole('textbox', { name: /工号|学号|账号/ }).fill('T701');
  await page.getByPlaceholder('校园网登录密码').fill('synthetic-password');
  await page.getByRole('button', { name: '授权并继续' }).click();
  await expect(page.getByText(/检查人：T701/)).toBeVisible();
  await page.getByRole('button', { name: '查看检查' }).first().click();
  await expect(page.getByText('请切回原检查人后恢复材料；操作结果仍可查询。')).toBeVisible();
  await expect(page.getByRole('button', { name: '恢复材料', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '确认并保存本条检查' })).toHaveCount(0);
  expect(fixture.requests.filter((item) => /mutation Prepare/.test(item.query))).toHaveLength(1);
  expect(fixture.requests.filter((item) => /mutation Save/.test(item.query))).toHaveLength(0);
});

for (const stage of ['prepare', 'save'] as const)
  test(`${stage} 在预检认证失败后，可关闭未执行请求并手动继续`, async ({ page }) => {
    const fixture = await setup(page, { noStaff: true });
    let reject = true;
    await page.route('**/graphql', async (route) => {
      const body = route.request().postDataJSON() as { query: string };
      if (body.query.includes('mutation LoginUpstreamSession'))
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              loginUpstreamSession: {
                expiresAt: '2030-01-01T00:00:00Z',
                upstreamSessionToken: 'valid-new-session',
              },
            },
          }),
        });
      if (
        reject &&
        (stage === 'prepare'
          ? /mutation Prepare/
          : /mutation Save(?:Assignment|Progress|LessonPlan)Inspection/
        ).test(body.query)
      )
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            errors: [{ message: '上游会话已失效', extensions: { code: 'UNAUTHENTICATED' } }],
          }),
        });
      return route.fallback();
    });
    if (stage === 'save') {
      await openAndPrepare(page, 'assignment');
      await page.getByRole('checkbox', { name: '我已核对课程、日期及上述材料' }).check();
      await page.getByRole('button', { name: '确认并保存本条检查' }).click();
    } else {
      await page.goto(`${path}?kind=assignment&semester=1`);
      await page.getByRole('button', { name: '查看检查' }).first().click();
      await page.getByRole('button', { name: '刷新检查状态', exact: true }).click();
      await page.getByRole('button', { name: '准备材料', exact: true }).click();
    }
    await expect(page.getByPlaceholder('校园网登录密码')).toBeVisible();
    reject = false;
    await page
      .getByRole('textbox', { name: /工号|学号|账号/ })
      .fill(stage === 'save' ? 'T700' : 'T701');
    await page.getByPlaceholder('校园网登录密码').fill('synthetic-password');
    await page.getByRole('button', { name: '授权并继续' }).click();
    await expect(page.getByText(stage === 'save' ? /检查人：T700/ : /检查人：T701/)).toBeVisible();
    await page.getByRole('button', { name: '查看检查' }).first().click();
    await expect(
      page.getByText('部分操作暂未查到结果，请继续查询；查不到不代表没有提交。'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '准备材料', exact: true })).toBeDisabled();
    const count = fixture.requests.filter((item) =>
      /mutation (Prepare|Save)(?:Assignment|Progress|LessonPlan)Inspection/.test(item.query),
    ).length;
    await page.getByRole('button', { name: '核对并关闭未执行请求', exact: true }).click();
    await page.getByRole('button', { name: /确.*定/ }).click();
    await expect(page.getByText('未执行，已关闭', { exact: true })).toBeVisible();
    expect(
      fixture.requests.filter((item) =>
        /mutation (Prepare|Save)(?:Assignment|Progress|LessonPlan)Inspection/.test(item.query),
      ),
    ).toHaveLength(count);
    if (stage === 'prepare')
      await page.getByRole('button', { name: '准备材料', exact: true }).click();
    else await page.getByRole('button', { name: '恢复材料', exact: true }).click();
    await expect(page.getByText('预填材料，请核对后提交')).toBeVisible();
    await page.getByRole('checkbox', { name: '我已核对课程、日期及上述材料' }).check();
    await page.getByRole('button', { name: '确认并保存本条检查' }).click();
    await expect(page.getByText('已收到保存成功结果，数量尚未增加也无需再次提交。')).toBeVisible();
  });

test('关闭未执行请求若查到 UNKNOWN，仍保留原请求并阻止直接重试', async ({ page }) => {
  const fixture = await setup(page);
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'teaching-inspection.recovery.v1.700',
      JSON.stringify([
        {
          accountId: 700,
          semesterId: 1,
          kind: 'PROGRESS',
          resourceKey: '1:a',
          action: 'SAVE',
          clientRequestId: 'late-save-request',
          round: 1,
          checkDate: '2026-09-10',
        },
      ]),
    ),
  );
  await page.goto(`${path}?kind=progress&semester=1`);
  await page.getByRole('button', { name: '查看检查' }).first().click();
  await expect(
    page.getByText('部分操作暂未查到结果，请继续查询；查不到不代表没有提交。'),
  ).toBeVisible();
  fixture.operations.set('late-save-request', {
    id: 'late-save',
    accountId: 700,
    requestId: 'late-save-request',
    action: 'SAVE',
    round: 1,
    checkDate: '2026-09-10',
    state: 'UNKNOWN',
    previewId: null,
  });
  await page.getByRole('button', { name: '核对并关闭未执行请求', exact: true }).click();
  await page.getByRole('button', { name: /确.*定/ }).click();
  await expect(
    page.getByText('操作结果与数量覆盖分别保留。请查询核对，不要自动重复提交。'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '准备材料', exact: true })).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem('teaching-inspection.recovery.v1.700') || '[]').length,
    ),
  ).toBe(1);
  expect(fixture.operations.get('late-save-request')?.state).toBe('UNKNOWN');
});

test('先保存第3轮时按证据覆盖，数量增长只补空轮次且下降不释放覆盖', async ({ page }) => {
  const fixture = await setup(page);
  await page.goto(`${path}?kind=assignment&semester=1`);
  await page.getByRole('button', { name: '查看检查' }).first().click();
  await page.getByRole('button', { name: '刷新检查状态', exact: true }).click();
  await page.getByRole('radio', { name: '第 3 轮', exact: true }).check();
  await page.getByRole('button', { name: '准备材料', exact: true }).click();
  await page.getByRole('checkbox', { name: '我已核对课程、日期及上述材料' }).check();
  await page.getByRole('button', { name: '确认并保存本条检查' }).click();
  await expect(page.getByText('保存成功', { exact: true })).toBeVisible();
  expect([...fixture.operations.values()].find((op) => op.action === 'SAVE')).toMatchObject({
    round: 3,
    checkDate: dates[2],
    state: 'SAVED',
  });
  fixture.setCount(1);
  await page.getByRole('button', { name: '刷新检查状态', exact: true }).click();
  await expect(page.getByText('第 3 轮：已知保存成功', { exact: true })).toBeVisible();
  await expect(page.getByText('第 1 轮：未覆盖', { exact: true })).toBeVisible();
  await expect(page.getByText('第 2 轮：未覆盖', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('dialog', { name: '作业检查 · 查看检查' })
      .getByText('有效覆盖 1 / 3 轮', { exact: true }),
  ).toBeVisible();
  fixture.setCount(2);
  await page.getByRole('button', { name: '刷新检查状态', exact: true }).click();
  await expect(page.getByText('第 1 轮：数量推定', { exact: true })).toBeVisible();
  await expect(page.getByText('第 2 轮：未覆盖', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('dialog', { name: '作业检查 · 查看检查' })
      .getByText('有效覆盖 2 / 3 轮', { exact: true }),
  ).toBeVisible();
  fixture.setCount(0);
  await page.getByRole('button', { name: '刷新检查状态', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: '作业检查 · 查看检查' })
      .getByText('有效覆盖 2 / 3 轮', { exact: true }),
  ).toBeVisible();
  await page.getByRole('radio', { name: '第 1 轮', exact: true }).check();
  await expect(page.getByRole('button', { name: '准备材料', exact: true })).toBeDisabled();
  await page.getByRole('radio', { name: '第 2 轮', exact: true }).check();
  await expect(page.getByRole('button', { name: '准备材料', exact: true })).toBeEnabled();
});

for (const stage of ['PREPARE', 'SAVE'] as const)
  test(`${stage} 认证失败且结果未落库时，应保留 DISPATCHING 并禁止自动重发`, async ({ page }) => {
    const fixture = await setup(page, { dispatchingAuthFailure: stage });
    if (stage === 'SAVE') {
      await openAndPrepare(page, 'assignment');
      await page.getByRole('checkbox', { name: '我已核对课程、日期及上述材料' }).check();
      await page.getByRole('button', { name: '确认并保存本条检查' }).click();
    } else {
      await page.goto(`${path}?kind=progress&semester=1`);
      await page.getByRole('button', { name: '查看检查' }).first().click();
      await page.getByRole('button', { name: '刷新检查状态', exact: true }).click();
      await page.getByRole('button', { name: '准备材料', exact: true }).click();
    }
    await expect(
      page.getByText('会话已失效。重新连接后，请先查询操作结果；不会自动重新提交。'),
    ).toBeVisible();
    const sent = fixture.requests.filter((item) =>
      /mutation (Prepare|Save)/.test(item.query),
    ).length;
    page.once('dialog', (dialog) => dialog.accept());
    await page.reload();
    await page.getByRole('button', { name: '查看检查' }).first().click();
    await expect(
      page.getByText(`${stage === 'SAVE' ? '保存检查' : '准备材料'} · 等待确认`),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '准备材料', exact: true })).toBeDisabled();
    await expect(
      page.getByRole('button', { name: '核对并关闭未执行请求', exact: true }),
    ).toHaveCount(0);
    const pending = [...fixture.operations.values()].find((op) => op.state === 'DISPATCHING')!;
    expect(
      await page.evaluate(() => sessionStorage.getItem('teaching-inspection.recovery.v1.700')),
    ).toContain(pending.requestId);
    expect(
      fixture.requests.filter((item) => /mutation (Prepare|Save)/.test(item.query)),
    ).toHaveLength(sent);
  });
