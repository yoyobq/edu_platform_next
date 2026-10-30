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
  departmentId?: string | null;
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
      records: [],
      historyState: 'VERIFIED',
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
        dateEditable: trusted && !coverage().has(round),
        dateBlockers: [],
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
  const timePlan = (key = 'SEMESTER:1') => ({
    key,
    version,
    confirmed: version > 0,
    dates: version ? dates : [],
    suggestedDates: dates,
    sourceVersion: 'source-1',
    fullSemester: key === 'SEMESTER:1',
    canEdit: true,
    earliestDate: '2026-09-01',
    latestDate: '2026-12-31',
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
      !/TeachingInspection|LessonPlanInspection|SyncLessonPlan|(?:Prepare|Save)(?:Progress|LessonPlan|Assignment)Inspection/.test(
        query,
      )
    )
      return route.fallback();
    requests.push({ query, input });
    const lessonResource = (key: string) => ({
      ...resource(key),
      teacherIds: ['T700'],
      grouping: { group: 'FULL' },
      timePlan: { ...timePlan(), group: 'FULL' },
    });
    if (query.includes('LessonPlanInspectionOverview'))
      return reply({
        result: {
          today: '2026-10-18',
          total: 2,
          departmentId: input.departmentId === undefined ? 'ORG0302' : input.departmentId,
          canSelectDepartment: !options.groupLeader,
          departments: [
            { id: 'ORG0302', name: '信息工程系' },
            { id: 'OTHER', name: '其他系' },
          ],
          teachers: [{ staffId: 'T700', name: '测试教师' }],
          roster: [
            { groupId: 'G1', groupName: '测试教研组', staffId: 'EMPTY', name: '无课教师' },
            { groupId: 'G1', groupName: '测试教研组', staffId: 'T700', name: '测试教师' },
          ],
          groupPlans: ['FULL', 'FIRST', 'SECOND'].map((group) => ({ ...timePlan(), group })),
          resources: [lessonResource('1:a'), lessonResource('1:b')],
        },
      });
    if (query.includes('LessonPlanInspectionDetail'))
      return reply({ result: lessonResource(input.resourceKey) });
    if (query.includes('SyncLessonPlanInspectionCounts'))
      return reply({
        result: {
          counts: ['1:a', '1:b'].map((resourceKey) => ({ resourceKey, count: 2 })),
          observedAt: '2026-10-18T04:00:00Z',
          upstreamSessionToken: 'rolled-token',
          expiresAt: null,
        },
      });
    if (query.includes('TeachingInspectionTimeWorkspace'))
      return reply({
        result: {
          total: 2,
          teachers: [{ staffId: 'T700', name: '测试教师' }],
          semesterTimePlan: timePlan(),
          resources: ['1:a', '1:b'].map((key) => ({
            ...resource(key),
            weeks: key === '1:a' ? [1, 17] : [1, 2, 3],
            timePlan: timePlan(key === '1:a' ? 'SEMESTER:1' : 'COURSE:1:b'),
          })),
        },
      });
    if (query.includes('TeachingInspectionTimePreview'))
      return reply({
        result: input.changes.map((change) => ({ ...timePlan(), dates: change.dates })),
      });
    if (query.includes('SaveTeachingInspectionTimePlans')) {
      version++;
      return reply({
        result: input.changes.map((change) => ({ ...timePlan(), dates: change.dates })),
      });
    }
    if (query.includes('TeachingInspectionWorkspace'))
      return reply({
        result: {
          departmentId: input.departmentId === undefined ? 'ORG0302' : input.departmentId,
          canSelectDepartment: !options.groupLeader,
          departments: [
            { id: 'ORG0302', name: '信息工程系' },
            ...(!options.groupLeader ? [{ id: 'OTHER', name: '其他系' }] : []),
          ],
          today: '2026-10-18',
          total: 2,
          teachers: [{ staffId: 'T700', name: '测试教师' }],
          resources: [resource('1:a'), resource('1:b')],
        },
      });
    if (query.includes('RefreshTeachingInspectionStatus')) {
      trusted = true;
      if (count < savedRounds.size)
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            errors: [
              {
                message: '上游数量少于本地确定成功记录，请到上游核实',
                extensions: { code: 'CONFLICT' },
              },
            ],
          }),
        });
      coveredFloor = count;
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
    ).toHaveLength(kind === 'lesson-plan' ? 2 : 3);
    const recovery = await page.evaluate(() =>
      sessionStorage.getItem('teaching-inspection.recovery.v1.700'),
    );
    expect(JSON.parse(recovery!)).toEqual([]);
  });
test('未连接上游时标明本地记录，非法类型规范化，窄屏可浏览与键盘进入检查', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await setup(page, { noSession: true });
  await page.goto(`${path}?kind=invalid&semester=1`);
  await expect(page.getByRole('heading', { name: '教学检查' })).toBeVisible();
  await expect(page).toHaveURL(/kind=lesson-plan/);
  await expect(page.getByText('尚未读取', { exact: false }).first()).toBeVisible();
  expect(
    fixture.requests.every((item) => item.query.includes('LessonPlanInspectionOverview')),
  ).toBe(true);
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
  await page.goto(`${path}?view=dates&kind=assignment&semester=1`);
  await page
    .getByRole('row')
    .filter({ hasText: '全学期课程' })
    .getByRole('button', { name: '确认日期', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: /安排检查日期/ })).toHaveCount(0);
  await expect
    .poll(() =>
      fixture.requests.some((item) => item.query.includes('SaveTeachingInspectionTimePlans')),
    )
    .toBe(true);
  const preview = fixture.requests.find((item) =>
    item.query.includes('TeachingInspectionTimePreview'),
  )!.input;
  const save = fixture.requests.find((item) =>
    item.query.includes('SaveTeachingInspectionTimePlans'),
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
      !body.query.includes('LessonPlanInspectionOverview') ||
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
  await page.getByRole('tab', { name: '学生作业', exact: true }).click();
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
  await page.goto(`${path}?view=dates&kind=lesson-plan&semester=1&teacher=T700&keyword=测试`);
  await expect(page.getByText('本学期检查安排', { exact: true })).toBeVisible();
  await expect(page.getByLabel('日期检查类型')).toHaveCount(0);
  await page.getByRole('tab', { name: '学生作业', exact: true }).click();
  await expect(page).toHaveURL(/kind=assignment/);
  await expect(page.getByText('已选 1 门课程')).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('tab', { name: '检查时间', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('searchbox', { name: '搜索课程' })).toHaveValue('测试');
  await page.goForward();
  await expect(page.getByRole('tab', { name: '学生作业', exact: true })).toHaveAttribute(
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
    if (body.query.includes('TeachingInspectionTimeWorkspace')) {
      const plan = {
        key: 'SEMESTER:1',
        version: currentVersion,
        confirmed: true,
        dates,
        suggestedDates: dates,
        sourceVersion: 'source-1',
        fullSemester: true,
        canEdit: true,
        earliestDate: '2026-09-01',
        latestDate: '2026-12-31',
      };
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            result: {
              total: 1,
              teachers: [],
              semesterTimePlan: plan,
              resources: [{ ...fixture.resource('1:a'), weeks: [1, 17], timePlan: plan }],
            },
          },
        }),
      });
    }
    if (!body.query.includes('SaveTeachingInspectionTimePlans')) return route.fallback();
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
  await page.goto(`${path}?view=dates&kind=lesson-plan&semester=1`);
  const date = page.getByLabel('全学期第1次检查日期');
  await date.fill('2026-09-12');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByRole('button', { name: '重新读取并核对日期', exact: true })).toBeVisible();
  expect(saveCalls).toBe(1);
  await page.getByRole('button', { name: '重新读取并核对日期', exact: true }).click();
  await expect(date).toHaveValue('2026-09-12');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect.poll(() => saveCalls).toBe(2);
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

test('作业数量增长补空轮次，低于确定成功时保留记录并阻止新准备', async ({ page }) => {
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
      .getByRole('dialog', { name: '学生作业 · 查看检查' })
      .getByText('有效覆盖 1 / 3 轮', { exact: true }),
  ).toBeVisible();
  fixture.setCount(2);
  await page.getByRole('button', { name: '刷新检查状态', exact: true }).click();
  await expect(page.getByText('第 1 轮：数量推定', { exact: true })).toBeVisible();
  await expect(page.getByText('第 2 轮：未覆盖', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('dialog', { name: '学生作业 · 查看检查' })
      .getByText('有效覆盖 2 / 3 轮', { exact: true }),
  ).toBeVisible();
  fixture.setCount(0);
  await page.getByRole('button', { name: '刷新检查状态', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: '学生作业 · 查看检查' })
      .getByText('有效覆盖 2 / 3 轮', { exact: true }),
  ).toBeVisible();
  await page.getByRole('radio', { name: '第 1 轮', exact: true }).check();
  await expect(page.getByRole('button', { name: '准备材料', exact: true })).toBeDisabled();
  await page.getByRole('radio', { name: '第 2 轮', exact: true }).check();
  await expect(page.getByRole('button', { name: '准备材料', exact: true })).toBeDisabled();
  await expect(page.getByText(/上游数量少于本地确定成功记录/)).toBeVisible();
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

test('进入工作台自动同步数量并使用滚动凭据，切换类型重新同步', async ({ page }) => {
  const fixture = await setup(page);
  fixture.setCount(1);
  await page.goto(`${path}?kind=progress&semester=1`);
  await expect(page.getByText('已同步上游', { exact: true })).toHaveCount(2);
  await expect(page.getByText('有效覆盖 1 / 3 轮', { exact: true })).toHaveCount(2);
  const reads = fixture.requests.filter((item) =>
    item.query.includes('RefreshTeachingInspectionStatus'),
  );
  expect(reads.map((item) => item.input.resourceKey)).toEqual(['1:a', '1:b']);
  expect((reads[1].input as Input & { upstreamSessionToken: string }).upstreamSessionToken).toBe(
    'rolled-token',
  );
  expect(
    fixture.requests.filter((item) => /mutation (Prepare|Save)/.test(item.query)),
  ).toHaveLength(0);
  await page.getByRole('tab', { name: '学生作业' }).click();
  await expect(page.getByText('已同步上游', { exact: true })).toHaveCount(2);
  await expect
    .poll(
      () =>
        fixture.requests.filter(
          (item) =>
            item.query.includes('RefreshTeachingInspectionStatus') &&
            item.input.kind === 'ASSIGNMENT',
        ).length,
    )
    .toBe(2);
});

test('自动同步失败标明旧记录，重新读取可恢复且不自动准备保存', async ({ page }) => {
  const fixture = await setup(page);
  fixture.setTrusted();
  let fail = true;
  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON() as { query: string };
    if (!fail || !body.query.includes('RefreshTeachingInspectionStatus')) return route.fallback();
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        errors: [{ message: '读取失败', extensions: { code: 'INTERNAL_SERVER_ERROR' } }],
      }),
    });
  });
  await page.goto(`${path}?kind=progress&semester=1`);
  await expect(page.getByText('同步未完成，以下为上次记录', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: '查看检查' }).first().click();
  await expect(page.getByRole('button', { name: '准备材料', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  fail = false;
  fixture.setCount(1);
  await page.getByRole('button', { name: '重新读取工作区' }).click();
  await expect(page.getByText('已同步上游', { exact: true })).toHaveCount(2);
  await expect(page.getByText('有效覆盖 1 / 3 轮', { exact: true })).toHaveCount(2);
  expect(
    fixture.requests.filter((item) => /mutation (Prepare|Save)/.test(item.query)),
  ).toHaveLength(0);
});

test('新入口默认独立检查时间，按课程确认而不触发生成保存', async ({ page }) => {
  const fixture = await setup(page, { assigned: false, noSession: true });
  await page.goto(`${path}?semester=1`);
  await expect(page.getByRole('tab', { name: '检查时间', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page
    .getByRole('row')
    .filter({ hasText: '全学期课程' })
    .getByRole('button', { name: '确认日期', exact: true })
    .click();
  await expect
    .poll(() =>
      fixture.requests.some((item) => item.query.includes('SaveTeachingInspectionTimePlans')),
    )
    .toBe(true);
  const saved = fixture.requests.find((item) =>
    item.query.includes('SaveTeachingInspectionTimePlans'),
  )!;
  expect(saved.input.changes).toHaveLength(1);
  expect(saved.input).not.toHaveProperty('kind');
  expect(
    fixture.requests.some((item) => item.query.includes('RefreshTeachingInspectionStatus')),
  ).toBe(false);
  await expect(page.getByLabel('日期检查类型')).toHaveCount(0);
  expect(saved.input.changes[0]).toMatchObject({
    expectedVersion: 0,
    expectedSourceVersion: 'source-1',
    key: 'SEMESTER:1',
  });
  expect(
    fixture.requests.filter((item) =>
      /mutation (Prepare|Save)(?:Progress|LessonPlan|Assignment)Inspection/.test(item.query),
    ),
  ).toHaveLength(0);
});

test('进度检查时间展示上游实际日期并锁定已提交轮次', async ({ page }) => {
  const fixture = await setup(page);
  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON() as { query: string; variables: { input: Input } };
    if (!body.query.includes('RefreshTeachingInspectionStatus')) return route.fallback();
    const resource = fixture.resource(body.variables.input.resourceKey);
    const record = {
      recordKey: 'progress-1',
      checkDate: '2026-09-20',
      score: 100,
      plannedProgress: 22,
      actualProgress: 22,
      deviation: 0,
    };
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          result: {
            schedule: { ...resource.schedule, records: [record], historyState: 'VERIFIED' },
            status: {
              ...resource.status,
              state: 'TRUSTED',
              upstreamCount: 1,
              observationVersion: 2,
              rounds: resource.status.rounds.map((round) => ({
                ...round,
                dateEditable: round.round !== 1,
              })),
            },
            upstreamSessionToken: 'observed',
            expiresAt: null,
          },
        },
      }),
    });
  });
  await page.goto(`${path}?kind=progress&semester=1`);
  await page.getByRole('button', { name: '查看检查', exact: true }).first().click();
  await page.getByRole('button', { name: '调整进度执行日期' }).click();
  await expect(page.getByLabel('测试课程甲第1轮日期')).toHaveValue('2026-09-20');
  await expect(page.getByLabel('测试课程甲第1轮日期')).toBeDisabled();
  await expect(page.getByLabel('测试课程甲第2轮日期')).toBeEnabled();
  await expect(page.getByText('上游实际检查：2026-09-20 · 100分')).toBeVisible();
  await expect(page.getByRole('button', { name: '预览日期', exact: true })).toBeDisabled();
  await expect(
    page.getByText('后续检查日期必须晚于上游已提交日期，且三轮日期严格递增，请调整后重新预览。'),
  ).toBeVisible();
  await page.getByLabel('测试课程甲第2轮日期').fill('2026-09-21');
  await expect(page.getByRole('button', { name: '预览日期', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '可调整轮次采用建议日期' }).click();
  await expect(page.getByLabel('测试课程甲第1轮日期')).toHaveValue('2026-09-20');
  await expect(page.getByRole('button', { name: '预览日期', exact: true })).toBeDisabled();
});

test('教案历史冲突可明确关联并留原因，不发送上游保存', async ({ page }) => {
  const fixture = await setup(page);
  let resolved: Record<string, unknown> | undefined;
  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON() as { query: string; variables: { input: Input } };
    if (body.query.includes('ResolveTeachingInspectionHistory')) {
      resolved = body.variables.input as unknown as Record<string, unknown>;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: { result: { upstreamSessionToken: 'resolved', expiresAt: null } },
        }),
      });
    }
    if (
      !body.query.includes('RefreshTeachingInspectionStatus') &&
      !body.query.includes('LessonPlanInspectionDetail')
    )
      return route.fallback();
    const resource = fixture.resource(body.variables.input.resourceKey);
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          result: {
            ...resource,
            teacherIds: ['T700'],
            grouping: { group: 'FULL' },
            timePlan: { group: 'FULL', dates, confirmed: true },
            schedule: {
              ...resource.schedule,
              records: [
                {
                  recordKey: 'lesson-existing',
                  checkDate: '2026-09-15',
                  score: 99,
                  chapter: '测试章节',
                },
              ],
              historyState: 'CONFLICT',
            },
            status: {
              ...resource.status,
              state: 'TRUSTED',
              upstreamCount: 1,
              observationVersion: 2,
              rounds: resource.status.rounds.map((round) => ({
                ...round,
                canPrepare: false,
                blockers: ['HISTORY_CONFLICT'],
              })),
            },
            upstreamSessionToken: 'observed',
            expiresAt: null,
          },
        },
      }),
    });
  });
  await page.goto(`${path}?kind=lesson-plan&semester=1`);
  await page.getByRole('button', { name: '查看检查' }).first().click();
  await page.getByRole('combobox', { name: '第1轮历史记录' }).click();
  await page.getByText('2026-09-15 · 99分 · 测试章节', { exact: true }).click();
  await page.getByLabel('历史核对原因').fill('已核对原始检查，关联第一轮');
  await page.getByRole('button', { name: '确认历史关联', exact: true }).click();
  await expect
    .poll(() => resolved)
    .toMatchObject({
      recordKeys: ['lesson-existing', null, null],
      ignoredRecordKeys: [],
      reason: '已核对原始检查，关联第一轮',
    });
  expect(
    fixture.requests.filter((item) =>
      /mutation (Prepare|Save)(?:Progress|LessonPlan|Assignment)Inspection/.test(item.query),
    ),
  ).toHaveLength(0);
});

test('短课单独确认时间，接口不携带检查类型且不改全学期规则', async ({ page }) => {
  const fixture = await setup(page, { noSession: true, assigned: false });
  await page.goto(`${path}?semester=1`);
  await page
    .getByRole('row', { name: /测试课程乙/ })
    .getByRole('button', { name: '处理例外' })
    .click();
  await page.getByRole('button', { name: '设置课程时间', exact: true }).click();
  await page.getByLabel('第1次检查时间').fill('2026-09-11');
  await page.getByRole('button', { name: '保存课程日期', exact: true }).click();
  await expect
    .poll(() =>
      fixture.requests.some((item) => item.query.includes('SaveTeachingInspectionTimePlans')),
    )
    .toBe(true);
  const saved = fixture.requests.find((item) =>
    item.query.includes('SaveTeachingInspectionTimePlans'),
  )!;
  expect(saved.input).not.toHaveProperty('kind');
  expect(saved.input.changes).toEqual([
    expect.objectContaining({
      key: 'COURSE:1:b',
      resourceKey: '1:b',
      dates: ['2026-09-11', dates[1], dates[2]],
    }),
  ]);
  expect(
    fixture.requests.some((item) => item.query.includes('RefreshTeachingInspectionStatus')),
  ).toBe(false);
});

for (const operation of [
  'TeachingInspectionTimeWorkspace',
  'TeachingInspectionTimePreview',
  'SaveTeachingInspectionTimePlans',
]) {
  test(`检查时间 ${operation} 失败显示中文提示且隐藏技术错误`, async ({ page }) => {
    await setup(page, { noSession: true });
    await page.route('**/graphql', async (route) => {
      const body = route.request().postDataJSON() as { query?: string };
      if (!body.query?.includes(operation)) return route.fallback();
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          errors: [
            {
              message: 'private transport implementation detail',
              extensions: { code: 'INTERNAL_SERVER_ERROR' },
            },
          ],
        }),
      });
    });
    await page.goto(`${path}?view=dates&semester=1`);
    if (operation !== 'TeachingInspectionTimeWorkspace') {
      await page.getByLabel('全学期第1次检查日期').fill('2026-09-12');
      await page.getByRole('button', { name: '保存修改', exact: true }).click();
    }
    await expect(page.getByText('请求处理失败，请稍后重试。', { exact: true })).toBeVisible();
    await expect(page.getByText('private transport implementation detail')).toHaveCount(0);
  });
}

test('三组时间先预览再确认，保留旧计划并显示课程日期差异', async ({ page }) => {
  const fixture = await setup(page, { noSession: true });
  let version = 0;
  let saves = 0;
  const groupPlan = (group: string, key: string) => ({
    group,
    key,
    version: 1,
    confirmed: true,
    dates,
    suggestedDates: dates,
    sourceVersion: 'source-1',
    fullSemester: group === 'FULL',
    canEdit: true,
    earliestDate: '2026-09-01',
    latestDate: '2026-12-31',
  });
  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON() as {
      query: string;
      variables?: {
        input: {
          split?: number;
          confirmSuggested?: boolean;
          expectedVersion: number;
          previewToken?: string;
        };
      };
    };
    if (body.query.includes('TeachingInspectionTimeWorkspace'))
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            result: {
              total: 1,
              teachers: [],
              semesterTimePlan: groupPlan('FULL', 'SEMESTER:1'),
              groupPlans: [
                groupPlan('FULL', 'SEMESTER:1'),
                groupPlan('FIRST', 'FIRST:1'),
                groupPlan('SECOND', 'SECOND:1'),
              ],
              grouping: {
                version,
                confirmed: version > 0,
                canEdit: true,
                weeks: 17,
                split: 9,
                recommendedSplit: 9,
                sourceVersion: 'group-source',
              },
              resources: [
                {
                  ...fixture.resource('1:a'),
                  sourceVersion: 'source-1',
                  weeks: [1, 9],
                  timePlan: groupPlan('FIRST', 'FIRST:1'),
                  grouping: {
                    group: null,
                    suggestedGroup: 'FIRST',
                    start: 1,
                    end: 9,
                    needsReview: true,
                    reason: '请确认建议归组',
                    preserved: false,
                  },
                },
              ],
            },
          },
        }),
      });
    if (!body.query.includes('InspectionGrouping(')) return route.fallback();
    if (body.query.startsWith('mutation')) {
      expect(body.variables?.input.expectedVersion).toBe(version);
      expect(body.variables?.input.previewToken).toBe('preview-token');
      version++;
      saves++;
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          result: {
            version,
            split: 9,
            weeks: 17,
            previewToken: 'preview-token',
            skipped: [
              { resourceKey: 'skip', courseName: '需独立设置课程', reason: '日期超出课程周期' },
            ],
            changes: body.variables?.input.confirmSuggested
              ? [
                  {
                    resourceKey: '1:a',
                    courseName: '待归组课程',
                    group: 'FIRST',
                    beforeDates: [],
                    afterDates: dates,
                  },
                ]
              : [],
          },
        },
      }),
    });
  });
  await page.goto(`${path}?view=dates&semester=1`);
  await expect(page.getByText('本学期检查安排', { exact: true })).toBeVisible();
  await expect(page.getByLabel('前半学期第1次检查日期')).toBeDisabled();
  await expect(page.getByRole('dialog', { name: '确认本学期教学分段', exact: true })).toBeVisible();
  expect(saves).toBe(0);
  await page.getByRole('button', { name: '采用推荐分段', exact: true }).click();
  await expect.poll(() => saves).toBe(1);
  await expect(page.getByRole('dialog', { name: '确认本学期教学分段', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByLabel('前半学期第1次检查日期')).toBeEnabled();
  // Ordinary courses require no per-course grouping confirmation.
  await expect(page.getByRole('button', { name: '预览待归组课程', exact: true })).toHaveCount(0);
});

test('未保存归组时全学期课程显示共用建议日期而非独立设置', async ({ page }) => {
  const fixture = await setup(page);
  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON() as { query: string };
    if (!body.query.includes('TeachingInspectionTimeWorkspace')) return route.fallback();
    const plan = {
      key: 'SEMESTER:1',
      group: 'FULL',
      version: 0,
      confirmed: false,
      dates: [],
      suggestedDates: ['2026-10-14', '2026-11-25', '2026-12-30'],
      sourceVersion: 'calendar',
      fullSemester: true,
      canEdit: true,
      earliestDate: '2026-09-07',
      latestDate: '2027-01-03',
    };
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          result: {
            total: 1,
            teachers: [],
            semesterTimePlan: plan,
            resources: [
              {
                ...fixture.resource('1:a'),
                courseName: '1031165G动画概论',
                teacherNames: ['金正'],
                weeks: [2, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
                timePlan: plan,
                grouping: {
                  group: 'FULL',
                  suggestedGroup: 'FULL',
                  start: 2,
                  end: 17,
                  needsReview: true,
                  preserved: false,
                  reason: '请管理员确认全学期共用检查时间',
                },
              },
            ],
          },
        },
      }),
    });
  });
  await page.goto(`${path}?view=dates&semester=1`);
  await expect(page.getByLabel('全学期第1次检查日期')).toHaveValue('2026-10-14');
  await expect(page.getByLabel('全学期第3次检查日期')).toHaveValue('2026-12-30');
  await expect(page.getByText('普通课程等待统一安排，无需逐门确认')).toBeVisible();
  await expect(page.getByRole('button', { name: '设置课程时间', exact: true })).toHaveCount(0);
});

test('共用规则已确认时仍展示课程待复核原因', async ({ page }) => {
  const fixture = await setup(page);
  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON() as { query: string };
    if (!body.query.includes('TeachingInspectionTimeWorkspace')) return route.fallback();
    const plan = {
      key: 'SEMESTER:1',
      group: 'FULL',
      version: 1,
      confirmed: true,
      dates: [],
      suggestedDates: ['2026-10-14', '2026-11-25', '2026-12-30'],
      sourceVersion: 'calendar',
      fullSemester: true,
      canEdit: true,
      earliestDate: '2026-09-07',
      latestDate: '2027-01-03',
    };
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          result: {
            total: 1,
            teachers: [],
            semesterTimePlan: plan,
            resources: [
              {
                ...fixture.resource('1:a'),
                courseName: '1031165G动画概论',
                teacherNames: ['金正'],
                weeks: [2, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
                timePlan: plan,
                grouping: {
                  group: 'FULL',
                  suggestedGroup: 'FULL',
                  start: 2,
                  end: 17,
                  needsReview: true,
                  preserved: false,
                  reason: '未执行的检查日期超出课程原定周期',
                },
              },
            ],
          },
        },
      }),
    });
  });
  await page.goto(`${path}?view=dates&semester=1`);
  await expect(page.getByText('需要处理（1）', { exact: true })).toBeVisible();
  await expect(page.getByText('未执行的检查日期超出课程原定周期')).toBeVisible();
  await page.getByRole('button', { name: '处理例外', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('金正');
  await expect(page.getByRole('button', { name: '设置课程时间', exact: true })).toHaveCount(0);
});

test('检查安排产品流程：原位编辑一次保存、自动校验和草稿保护', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Warning:'))
      warnings.push(message.text());
  });
  const fixture = await setup(page, { noSession: true });
  let saved = false;
  let previewInput: object | undefined;
  let writes = 0;
  const suggested = ['2026-10-14', '2026-11-25', '2026-12-30'];
  const plan = (group: string) => ({
    key: `${group === 'FULL' ? 'SEMESTER' : group}:1`,
    group,
    version: saved ? 1 : 0,
    confirmed: saved,
    dates: saved ? suggested : [],
    suggestedDates: suggested,
    sourceVersion: 'source',
    fullSemester: group === 'FULL',
    canEdit: true,
    earliestDate: '2026-09-07',
    latestDate: '2027-01-03',
  });
  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON() as {
      query: string;
      variables?: { input: { changes: object[] } };
    };
    const reply = (result: object) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { result } }),
      });
    if (body.query.includes('TeachingInspectionTimeWorkspace'))
      return reply({
        total: 21,
        teachers: [],
        semesterTimePlan: plan('FULL'),
        groupPlans: ['FULL', 'FIRST', 'SECOND'].map(plan),
        grouping: {
          version: 1,
          confirmed: true,
          canEdit: true,
          weeks: 17,
          split: 9,
          recommendedSplit: 9,
          sourceVersion: 'source',
        },
        resources: Array.from({ length: 21 }, (_, i) => ({
          ...fixture.resource(`1:${i}`),
          courseName: i === 20 ? '分页末尾独立课程' : `普通课程${i}`,
          timePlan:
            i === 20 ? { ...plan('CUSTOM'), confirmed: false, fullSemester: false } : plan('FULL'),
          grouping: {
            group: i === 20 ? 'CUSTOM' : 'FULL',
            suggestedGroup: 'FULL',
            start: 1,
            end: 17,
            needsReview: i === 20,
            reason: i === 20 ? '请设置独立时间' : '',
            preserved: false,
          },
        })),
      });
    if (body.query.includes('TeachingInspectionTimePreview')) {
      previewInput = body.variables?.input;
      return reply(['FULL', 'FIRST', 'SECOND'].map(plan));
    }
    if (body.query.includes('SaveTeachingInspectionTimePlans')) {
      expect(body.variables?.input).toEqual(previewInput);
      expect(body.variables?.input.changes).toHaveLength(3);
      saved = true;
      writes++;
      return reply(['FULL', 'FIRST', 'SECOND'].map(plan));
    }
    return route.fallback();
  });
  await page.goto(`${path}?view=dates&semester=1`);
  await expect(page.getByText('需要处理（1）', { exact: true })).toBeVisible();
  await expect(page.getByText('分页末尾独立课程', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '预览日期', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('全学期第1次检查日期').fill('2026-10-15');
  await page.getByRole('tab', { name: '教案检查', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '放弃尚未保存的检查时间？' })).toBeVisible();
  await page.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(page.getByLabel('全学期第1次检查日期')).toHaveValue('2026-10-15');
  await page.getByRole('button', { name: '保存全部待确认日期', exact: true }).click();
  await expect(page.getByText('安排已确认', { exact: true })).toBeVisible();
  expect(writes).toBe(1);
  await page.mouse.move(1200, 100);
  await page.getByText('本学期检查安排', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/inspection-product-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await expect(page.getByRole('combobox', { name: '课程范围' })).toBeVisible();
  expect(warnings).toEqual([]);
  await page.mouse.move(380, 100);
  await page.getByText('本学期检查安排', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/inspection-product-mobile.png', fullPage: true });
});

async function mockSplitPrompt(
  page: Page,
  options: { confirmed?: boolean; canEdit?: boolean; failSave?: boolean } = {},
) {
  const fixture = await setup(page, { noSession: true });
  let confirmed = options.confirmed ?? false;
  let version = confirmed ? 1 : 0;
  let writes = 0;
  const canEdit = options.canEdit ?? true;
  const plan = (group: string) => ({
    key: `${group === 'FULL' ? 'SEMESTER' : group}:1`,
    group,
    version: 0,
    confirmed: false,
    dates: [],
    suggestedDates: dates,
    sourceVersion: 'source',
    fullSemester: group === 'FULL',
    canEdit,
    earliestDate: '2026-09-01',
    latestDate: '2027-01-03',
  });
  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON() as {
      query: string;
      variables?: { input: { split?: number; expectedVersion?: number } };
    };
    const reply = (result: object) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { result } }),
      });
    if (body.query.includes('TeachingInspectionTimeWorkspace'))
      return reply({
        total: 1,
        teachers: [],
        semesterTimePlan: plan('FULL'),
        groupPlans: ['FULL', 'FIRST', 'SECOND'].map(plan),
        grouping: {
          version,
          confirmed,
          canEdit,
          weeks: 17,
          split: 9,
          recommendedSplit: 9,
          sourceVersion: 'source',
        },
        resources: [
          {
            ...fixture.resource('1:a'),
            timePlan: plan('FULL'),
            grouping: {
              group: 'FULL',
              suggestedGroup: 'FULL',
              start: 1,
              end: 17,
              needsReview: true,
              reason: '等待统一确认',
              preserved: false,
            },
          },
        ],
      });
    if (body.query.includes('InspectionGrouping(')) {
      if (body.query.startsWith('mutation')) {
        writes++;
        if (options.failSave)
          return route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              errors: [{ message: '安排已变化，请重新核对', extensions: { code: 'CONFLICT' } }],
            }),
          });
        confirmed = true;
        version++;
      }
      return reply({
        version,
        split: body.variables?.input.split ?? 9,
        weeks: 17,
        previewToken: 'preview',
        changes: [],
        skipped: [],
      });
    }
    return route.fallback();
  });
  return { writes: () => writes, requests: fixture.requests };
}

test('分段弹窗：稍后处理不重复打扰，页面保留入口且可以调整', async ({ page }) => {
  const fixture = await mockSplitPrompt(page);
  await page.goto(`${path}?view=dates&semester=1`);
  const prompt = page.getByRole('dialog', { name: '确认本学期教学分段', exact: true });
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText('前半学期 1–9 周');
  await page.getByRole('button', { name: '稍后处理', exact: true }).click();
  await expect(prompt).toHaveCount(0);
  await expect(page.getByRole('button', { name: '确认教学分段', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重新读取检查时间', exact: true }).click();
  await expect(page.getByLabel('全学期第1次检查日期')).toBeEnabled();
  await expect(prompt).toHaveCount(0);
  await page.getByRole('tab', { name: '教案检查', exact: true }).click();
  await page.getByRole('tab', { name: '检查时间', exact: true }).click();
  await expect(page.getByLabel('全学期第1次检查日期')).toBeEnabled();
  await expect(prompt).toHaveCount(0);
  await page.getByRole('button', { name: '确认教学分段', exact: true }).click();
  await page.getByRole('button', { name: '调整分段', exact: true }).click();
  await page.getByRole('spinbutton', { name: '前半学期结束周', exact: true }).fill('8');
  await expect(prompt).toContainText('后半学期：9–17 周');
  expect(fixture.writes()).toBe(0);
  await prompt.getByRole('button', { name: '确认教学分段', exact: true }).click();
  await expect(prompt).toHaveCount(0);
  await expect(
    page.getByText('教学分段已确认，接下来确认三次检查日期', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('后半学期第1次检查日期')).toBeEnabled();
  expect(fixture.writes()).toBe(1);
});

for (const options of [
  { confirmed: true, canEdit: true },
  { confirmed: false, canEdit: false },
]) {
  test(`分段弹窗：confirmed=${options.confirmed} canEdit=${options.canEdit} 不自动弹出`, async ({
    page,
  }) => {
    const fixture = await mockSplitPrompt(page, options);
    await page.goto(`${path}?view=dates&semester=1`);
    await expect(page.getByText('本学期检查安排', { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog', { name: '确认本学期教学分段', exact: true })).toHaveCount(
      0,
    );
    if (!options.canEdit) {
      await expect(page.getByText('等待管理员确认教学分段', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '确认教学分段', exact: true })).toHaveCount(0);
    }
    expect(fixture.writes()).toBe(0);
  });
}

test('分段弹窗：保存冲突后不自动重试，必须重新读取', async ({ page }) => {
  const fixture = await mockSplitPrompt(page, { failSave: true });
  await page.goto(`${path}?view=dates&semester=1`);
  await page.getByRole('button', { name: '采用推荐分段', exact: true }).click();
  await expect(page.getByRole('button', { name: '重新读取学期安排', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '采用推荐分段', exact: true })).toBeDisabled();
  expect(fixture.writes()).toBe(1);
  await page.getByRole('button', { name: '重新读取学期安排', exact: true }).click();
  await expect(page.getByRole('button', { name: '采用推荐分段', exact: true })).toBeEnabled();
  expect(fixture.writes()).toBe(1);
});

test('检查组织：管理员默认信息工程系，切换系或全校时重置教师和分页', async ({ page }) => {
  const fixture = await setup(page, { noSession: true });
  await page.goto(`${path}?kind=progress&semester=1&teacher=T700&page=2`);
  const select = page.getByLabel('检查所属系');
  await expect(select).toBeEnabled();
  await expect(page.getByText('信息工程系', { exact: true })).toBeVisible();
  expect(
    fixture.requests.find((request) => request.query.includes('TeachingInspectionWorkspace'))?.input
      .departmentId,
  ).toBeUndefined();
  await select.click();
  await page.getByText('其他系', { exact: true }).last().click();
  await expect(page).toHaveURL(/department=OTHER/);
  await expect(page).not.toHaveURL(/teacher=|page=/);
  await expect
    .poll(() =>
      fixture.requests.some(
        (request) =>
          request.query.includes('TeachingInspectionWorkspace') &&
          request.input.departmentId === 'OTHER',
      ),
    )
    .toBe(true);
  await page.getByLabel('检查所属系').click();
  await page.getByText('全校（全部系）', { exact: true }).last().click();
  await expect(page).toHaveURL(/department=all/);
  await expect
    .poll(() =>
      fixture.requests.some(
        (request) =>
          request.query.includes('TeachingInspectionWorkspace') &&
          request.input.departmentId === null,
      ),
    )
    .toBe(true);
  expect(fixture.requests.some((request) => /mutation\s+(Prepare|Save)/.test(request.query))).toBe(
    false,
  );
});

test('检查组织：教研组长固定本地所属系，没有跨系选择入口', async ({ page }) => {
  await setup(page, { groupLeader: true, noSession: true });
  await page.goto(`${path}?kind=assignment&semester=1`);
  await expect(page.getByLabel('检查所属系')).toBeDisabled();
  await expect(page.getByText('信息工程系', { exact: true })).toBeVisible();
});

test('教案批次首屏仅本地，标签切换不读取，完整组员无课者在后', async ({ page }) => {
  const fixture = await setup(page);
  await page.goto(`${path}?kind=lesson-plan&semester=1`);
  await expect(page.getByText('测试教研组', { exact: true })).toBeVisible();
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toContainText('测试教师');
  await expect(rows.last()).toContainText('无课教师');
  await expect(page.getByRole('tab', { name: '第3次 · 2026-10-01', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(
    fixture.requests.filter((row) => row.query.includes('LessonPlanInspectionOverview')),
  ).toHaveLength(1);
  expect(
    fixture.requests.some((row) =>
      /RefreshTeachingInspectionStatus|SyncLessonPlanInspectionCounts/.test(row.query),
    ),
  ).toBe(false);
  await page.getByRole('tab', { name: '前半学期', exact: true }).click();
  await expect(page).toHaveURL(/timeGroup=FIRST/);
  await expect(rows.first()).toContainText('本批无课程');
  await page.getByRole('tab', { name: '第1次 · 2026-09-10', exact: true }).click();
  await expect(rows.first()).toContainText('本批无课程');
  expect(
    fixture.requests.filter((row) => row.query.includes('LessonPlanInspectionOverview')),
  ).toHaveLength(1);
  await page.getByRole('button', { name: '同步上游数量', exact: true }).click();
  await expect(page.getByText(/数量同步时间/)).toBeVisible();
  expect(
    fixture.requests.filter((row) => row.query.includes('SyncLessonPlanInspectionCounts')),
  ).toHaveLength(1);
  expect(
    fixture.requests.some((row) => row.query.includes('RefreshTeachingInspectionStatus')),
  ).toBe(false);
});

test('教案组织：默认系切到全校重置筛选并隔离旧数量响应', async ({ page }) => {
  await setup(page);
  let started!: () => void, release!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON() as { query: string };
    if (!body.query.includes('SyncLessonPlanInspectionCounts')) return route.fallback();
    started();
    await released;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          result: {
            counts: [{ resourceKey: '1:a', count: 3 }],
            observedAt: '2026-10-18T04:00:00Z',
            upstreamSessionToken: 'late-old-scope',
            expiresAt: null,
          },
        },
      }),
    });
  });
  await page.goto(`${path}?kind=lesson-plan&semester=1`);
  await page.getByLabel('筛选组员').click();
  await page.getByText('测试教师', { exact: true }).last().click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: '同步上游数量', exact: true }).click();
  await entered;
  try {
    await page.getByLabel('检查所属系').click();
    await page.getByText('全校（全部系）', { exact: true }).last().click();
    await expect(page).toHaveURL(/department=all/);
    await expect(page.locator('tbody tr')).toHaveCount(2);
    const response = page.waitForResponse(
      (value) => value.request().postData()?.includes('SyncLessonPlanInspectionCounts') ?? false,
    );
    release();
    await response;
    await page.getByRole('tab', { name: '前半学期', exact: true }).click();
    await expect(page).toHaveURL(/timeGroup=FIRST/);
    await expect(page.getByText(/数量同步时间/)).toHaveCount(0);
    expect(
      await page.evaluate(() => localStorage.getItem('aigc-friendly-frontend.upstream.session.v2')),
    ).not.toContain('late-old-scope');
  } finally {
    release();
  }
});

for (const firstResult of ['error', 'unknown'] as const) {
  test(`教案同步：首次${firstResult}后手动核对可恢复准备及保存`, async ({ page }) => {
    const fixture = await setup(page);
    fixture.setTrusted();
    let attempts = 0;
    await page.route('**/graphql', async (route) => {
      const body = route.request().postDataJSON() as { query: string };
      if (!body.query.includes('RefreshTeachingInspectionStatus') || ++attempts > 1)
        return route.fallback();
      const resource = fixture.resource('1:a');
      const response =
        firstResult === 'error'
          ? { errors: [{ message: '首次核对失败', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] }
          : {
              data: {
                result: {
                  schedule: resource.schedule,
                  status: { ...resource.status, state: 'UNKNOWN' },
                  upstreamSessionToken: 'unknown-token',
                  expiresAt: null,
                },
              },
            };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
    });
    await page.goto(`${path}?kind=lesson-plan&semester=1`);
    await page.getByRole('button', { name: '查看检查', exact: true }).first().click();
    const prepare = page.getByRole('button', { name: '准备材料', exact: true });
    await expect(prepare).toBeDisabled();
    await page.getByRole('button', { name: '刷新检查状态', exact: true }).click();
    await expect(prepare).toBeEnabled();
    await prepare.click();
    await expect(page.getByText('预填材料，请核对后提交')).toBeVisible();
    await page.getByRole('checkbox', { name: '我已核对课程、日期及上述材料' }).check();
    await expect(
      page.getByRole('button', { name: '确认并保存本条检查', exact: true }),
    ).toBeEnabled();
  });
}
