// e2e/specs/routing/student-registration-cards.spec.ts
import type { Page } from '@playwright/test';

import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

async function setup(
  page: Page,
  options: {
    readonly?: boolean;
    blocked?: boolean;
    failDownload?: boolean;
    failPreflight?: boolean;
  } = {},
) {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, { currentSession: { accountId: 1, primaryAccessGroup: 'ADMIN' } });
  await seedAuthSession(page, { accountId: 1, primaryAccessGroup: 'ADMIN' });
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
