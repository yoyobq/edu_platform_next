// e2e/specs/routing/student-graduation-info-live.spec.ts
import { readFile } from 'node:fs/promises';

import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

// The backend collaboration E2E owns the isolated server, database fixture and credentials.
// Auth bootstrap is a UI fixture; every business request below reaches the real backend guards.
test('真实业务接口完成毕业本地保存、学籍卡预检、生成和授权下载', async ({ page }, testInfo) => {
  const backend = process.env.GRADUATION_REAL_BACKEND_URL;
  const token = process.env.GRADUATION_REAL_BACKEND_TOKEN;
  const studentId = process.env.GRADUATION_REAL_STUDENT_ID;
  const classId = process.env.GRADUATION_REAL_CLASS_ID;
  test.skip(!backend || !token || !studentId || !classId, '由后端隔离 E2E 提供真实业务环境');
  if (!backend || !token || !studentId || !classId) throw new Error('Missing live fixture');
  await mockApiHealth(page);
  await mockAuthGraphQL(page, { currentSession: { accountId: 1, primaryAccessGroup: 'ADMIN' } });
  await seedAuthSession(page, { accountId: 1, primaryAccessGroup: 'ADMIN' });
  let preflightRequests = 0;
  await page.route('**/graphql', async (route) => {
    const query = (route.request().postDataJSON() as { query?: string }).query ?? '';
    if (
      !/studentPrivateProfile|StudentPrivateProfile|studentRegistrationCard|StudentRegistrationCard/.test(
        query,
      )
    ) {
      await route.fallback();
      return;
    }
    if (query.includes('studentRegistrationCardGenerationPreflight')) preflightRequests += 1;
    const response = await route.fetch({
      url: `${backend}/graphql`,
      headers: { ...route.request().headers(), authorization: `Bearer ${token}` },
    });
    await route.fulfill({ response });
  });
  await page.route('**/student-private-profile/registration-card-documents/*', async (route) => {
    const response = await route.fetch({
      url: `${backend}${new URL(route.request().url()).pathname}`,
      headers: { ...route.request().headers(), authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('wordprocessingml.document');
    await route.fulfill({ response });
  });
  await page.goto(
    `/labs/student-registration-cards?classId=${classId}&studentId=${studentId}&inspect=1`,
  );
  await page.getByRole('link', { name: '建档 / 毕业信息（班主任、辅导员）', exact: true }).click();
  await page.getByRole('button', { name: '毕业信息', exact: true }).click();
  const certificate = page.getByLabel('毕业证书编号');
  await expect(certificate).toBeEnabled();
  await certificate.fill('BROWSER-LOCAL-CERTIFICATE');
  await page.evaluate(() => window.history.back());
  await page.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(page).toHaveURL(/student-profile-filing/);
  await expect(certificate).toHaveValue('BROWSER-LOCAL-CERTIFICATE');
  await page.getByRole('button', { name: '本地保存毕业信息' }).click();
  await expect(page.getByText('毕业信息已本地保存')).toBeVisible();
  await page.locator('.ant-drawer-close').click();
  await page.getByRole('button', { name: '毕业信息', exact: true }).click();
  await expect(certificate).toHaveValue('BROWSER-LOCAL-CERTIFICATE');
  await page.locator('.ant-drawer-close').click();
  await page.getByRole('button', { name: /返回学籍卡检查/ }).click();
  await expect(page).toHaveURL(new RegExp(`student-registration-cards.*studentId=${studentId}`));
  await page.getByRole('button', { name: '生成本学生 DOCX', exact: true }).click();
  expect(preflightRequests).toBeGreaterThanOrEqual(2);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载学籍卡 DOCX', exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
  const file = testInfo.outputPath('student-registration-card.docx');
  await download.saveAs(file);
  const bytes = await readFile(file);
  expect(bytes.subarray(0, 2).toString()).toBe('PK');
  expect(bytes.byteLength).toBeGreaterThan(1000);
  await expect(page.getByRole('button', { name: '下载学籍卡 DOCX', exact: true })).toBeEnabled();
  await page.screenshot({
    path: testInfo.outputPath('registration-card-live.png'),
    fullPage: true,
  });
});
