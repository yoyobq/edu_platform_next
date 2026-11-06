// e2e/specs/routing/student-registration-cards.spec.ts
import type { Page } from '@playwright/test';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';

import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

async function setup(
  page: Page,
  options: {
    readonly?: boolean;
    blocked?: boolean;
    failDownload?: boolean;
    failPreflight?: boolean;
    adviser?: boolean;
  } = {},
) {
  await mockApiHealth(page);
  const identity = options.adviser
    ? { accountId: 1, primaryAccessGroup: 'STAFF' as const, slotGroup: ['CLASS_ADVISER'] }
    : { accountId: 1, primaryAccessGroup: 'ADMIN' as const };
  await mockAuthGraphQL(page, { currentSession: identity });
  await seedAuthSession(page, identity);
  const inspections: string[] = [];
  const generations: string[] = [];
  let downloads = 0;
  const material = (studentId: string) => ({
    studentId,
    canGenerate: !options.readonly,
    status: options.blocked ? 'BLOCKED' : 'WARNING',
    issueCodes: options.blocked ? ['PRIVATE_PROFILE_SNAPSHOT_MISSING'] : [],
    warningCodes: ['FAMILY_MISSING'],
    missingSections: ['family'],
    scoreOverflows: [],
    termMaterialReadiness: { status: 'COMPLETE', terms: [] },
  });
  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as {
      query?: string;
      variables?: { input?: { studentId?: string } };
    };
    const query = payload.query ?? '';
    const studentId = payload.variables?.input?.studentId ?? '';
    let field = '';
    let value: unknown;
    if (query.includes('studentPrivateProfileClassOptions')) {
      field = 'studentPrivateProfileClassOptions';
      value = [{ id: 'A', classCode: '2401', className: '出卡测试班' }];
    } else if (query.includes('studentPrivateProfileClassStudentOptions')) {
      field = 'studentPrivateProfileClassStudentOptions';
      value = [
        { studentId: 'S1', studentName: '张同学' },
        { studentId: 'S2', studentName: '李同学' },
      ];
    } else if (query.includes('studentRegistrationCardGenerationPreflight')) {
      inspections.push(studentId);
      if (options.failPreflight && inspections.length === 1) {
        await route.fulfill({ json: { errors: [{ message: 'preflight failed' }] } });
        return;
      }
      field = 'studentRegistrationCardGenerationPreflight';
      value = material(studentId);
    } else if (query.includes('generateStudentRegistrationCardDocument')) {
      generations.push(studentId);
      field = 'generateStudentRegistrationCardDocument';
      value = {
        ...material(studentId),
        downloadToken: `card-${studentId}`,
        fileName: `${studentId}.docx`,
        expiresAt: '2099-01-01T00:00:00Z',
      };
    }
    if (!field) return route.fallback();
    await route.fulfill({ json: { data: { [field]: value } } });
  });
  await page.route('**/student-private-profile/registration-card-documents/*', async (route) => {
    downloads += 1;
    await route.fulfill({
      status: options.failDownload && downloads === 1 ? 500 : 200,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      body: 'mock document',
    });
  });
  await page.goto('/labs/student-registration-cards?classId=A');
  return { inspections, generations };
}

test('点击名单学生自动检查，生成后直接下载，切换学生清除旧下载入口', async ({ page }, testInfo) => {
  const scenario = await setup(page);
  await page.getByRole('button', { name: '张同学', exact: true }).click();
  await expect(page.getByText('缺家庭信息', { exact: true })).toBeVisible();
  expect(scenario.inspections).toEqual(['S1']);
  expect(scenario.generations).toEqual([]);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '生成并下载', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe('S1.docx');
  await expect(page.getByRole('button', { name: '重新下载', exact: true })).toBeEnabled();
  expect(scenario.generations).toEqual(['S1']);

  await page.getByLabel('搜索学籍卡学生').fill('S2');
  await expect(page.getByRole('button', { name: '张同学', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '李同学', exact: true }).click();
  await expect(page.getByRole('button', { name: '生成并下载', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '重新下载', exact: true })).toHaveCount(0);
  expect(scenario.inspections).toEqual(['S1', 'S2']);
  const secondDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '生成并下载', exact: true }).click();
  expect((await secondDownload).suggestedFilename()).toBe('S2.docx');
  expect(scenario.generations).toEqual(['S1', 'S2']);
  await page.screenshot({ path: testInfo.outputPath('cards-wide.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('cards-narrow.png'), fullPage: true });
});

test('自动下载失败后保留结果，重新下载无需重复生成', async ({ page }) => {
  const scenario = await setup(page, { failDownload: true });
  await page.getByRole('button', { name: '张同学', exact: true }).click();
  await page.getByRole('button', { name: '生成并下载', exact: true }).click();
  await expect(page.getByText('文档已生成，自动下载失败。请点击“重新下载”重试。')).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '重新下载', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe('S1.docx');
  expect(scenario.generations).toEqual(['S1']);
});

test('材料检查失败可直接重新检查，不生成文档', async ({ page }) => {
  const scenario = await setup(page, { failPreflight: true });
  await page.getByRole('button', { name: '张同学', exact: true }).click();
  await expect(page.getByText('材料检查失败，请点击“重新检查材料”重试。')).toBeVisible();
  await page.getByRole('button', { name: '重新检查材料', exact: true }).click();
  await expect(page.getByRole('button', { name: '生成并下载', exact: true })).toBeEnabled();
  expect(scenario.inspections).toEqual(['S1', 'S1']);
  expect(scenario.generations).toEqual([]);
});

test('只读检查结果不显示生成入口', async ({ page }) => {
  const scenario = await setup(page, { readonly: true });
  await page.getByRole('button', { name: '张同学', exact: true }).click();
  await expect(page.getByText('只读材料状态，请由教务员生成文档。')).toBeVisible();
  await expect(page.getByRole('button', { name: '生成并下载', exact: true })).toHaveCount(0);
  expect(scenario.generations).toEqual([]);
});

test('材料阻塞时禁止生成和下载', async ({ page }) => {
  const scenario = await setup(page, { blocked: true });
  await page.getByRole('button', { name: '张同学', exact: true }).click();
  await expect(page.getByText('材料阻塞', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '生成并下载', exact: true })).toBeDisabled();
  expect(scenario.generations).toEqual([]);
});

test('全班批量导出仅下载一个 ZIP，失败重试复用已生成文档并保留成功项', async ({
  page,
}, testInfo) => {
  const scenario = await setup(page, { failDownload: true });
  await page.getByRole('button', { name: '全选当前班级', exact: true }).click();
  const firstDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '批量导出（2 人）', exact: true }).click();
  expect((await firstDownload).suggestedFilename()).toMatch(/学籍卡.*zip$/);
  await expect(page.getByText('已处理 2/2，成功 1，阻塞 0，失败 1', { exact: true })).toBeVisible();
  expect(scenario.generations).toEqual(['S1', 'S2']);
  const retryDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '重试未完成项', exact: true }).click();
  const download = await retryDownload;
  const file = testInfo.outputPath('cards.zip');
  await download.saveAs(file);
  const zip = await JSZip.loadAsync(await readFile(file));
  expect(Object.keys(zip.files)).toEqual(['S1.docx', 'S2.docx', '导出结果.csv']);
  expect(await zip.file('导出结果.csv')?.async('string')).toContain('缺家庭信息');
  expect(scenario.generations).toEqual(['S1', 'S2']);
});

test('搜索结果全选与查看材料独立，隐藏行的勾选仍保留', async ({ page }) => {
  const scenario = await setup(page);
  await page.getByRole('button', { name: '全选当前班级', exact: true }).click();
  await page.getByLabel('搜索学籍卡学生').fill('S1');
  await expect(page.getByRole('button', { name: '批量导出（2 人）', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '张同学', exact: true }).click();
  await expect(page.getByRole('button', { name: '生成并下载', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '批量导出（2 人）', exact: true })).toBeEnabled();
  expect(scenario.generations).toEqual([]);
  await page.getByRole('button', { name: '清空选择', exact: true }).click();
  await expect(page.getByRole('button', { name: '批量导出（0 人）', exact: true })).toBeDisabled();
});

test('班主任可检查材料，不能选择批量出卡', async ({ page }) => {
  await setup(page, { readonly: true, adviser: true });
  await page.getByRole('button', { name: '张同学', exact: true }).click();
  await expect(page.getByText('只读材料状态，请由教务员生成文档。')).toBeVisible();
  await expect(page.getByRole('button', { name: '全选当前班级', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
});

test('停止批量导出完成当前学生，保护导航且继续时不重新生成成功项', async ({ page }) => {
  const scenario = await setup(page);
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as {
      query?: string;
      variables?: { input?: { studentId?: string } };
    };
    if (
      payload.query?.includes('mutation CardLabGenerate') &&
      payload.variables?.input?.studentId === 'S1'
    ) {
      started = true;
      await pending;
    }
    await route.fallback();
  });
  try {
    await page.getByRole('button', { name: '张同学', exact: true }).click();
    await expect(page.getByRole('button', { name: '生成并下载', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '全选当前班级', exact: true }).click();
    await page.getByRole('button', { name: '批量导出（2 人）', exact: true }).click();
    await expect.poll(() => started).toBe(true);
    await page.getByRole('button', { name: '停止后续导出', exact: true }).click();
    await page.getByRole('link', { name: '操行治理', exact: true }).click();
    await expect(
      page
        .getByRole('dialog', { name: '正在生成，请稍后离开', exact: true })
        .getByRole('button', { name: '继续离开' }),
    ).toBeDisabled();
    const first = page.waitForEvent('download');
    release();
    await first;
    await page
      .getByRole('dialog', { name: '生成请求已结束，是否继续离开？', exact: true })
      .getByRole('button', { name: '留在当前页', exact: true })
      .click();
    await expect(page.getByRole('button', { name: '继续导出', exact: true })).toBeEnabled();
    expect(scenario.generations).toEqual(['S1']);
    const second = page.waitForEvent('download');
    await page.getByRole('button', { name: '继续导出', exact: true }).click();
    await second;
    expect(scenario.generations).toEqual(['S1', 'S2']);
  } finally {
    release();
  }
});
