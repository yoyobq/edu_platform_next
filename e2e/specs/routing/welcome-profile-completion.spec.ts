import { routes } from '../../fixtures/routes';
import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

const pendingRegistrantSession = {
  accessGroup: ['REGISTRANT'] as const,
  displayName: 'pending-user',
  identity: null,
  identityHint: 'STUDENT' as const,
  needsProfileCompletion: true,
  primaryAccessGroup: 'REGISTRANT' as const,
};

const completedStaffSession = {
  accessGroup: ['STAFF'] as const,
  displayName: 'teacher-li',
  identity: {
    kind: 'STAFF' as const,
    name: '李老师',
  },
  identityHint: 'STAFF' as const,
  needsProfileCompletion: false,
  primaryAccessGroup: 'STAFF' as const,
};

test('已登录且需补全时，访问受保护页会被分流到 /welcome', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: pendingRegistrantSession,
  });
  await seedAuthSession(page, pendingRegistrantSession);

  await page.goto(routes.sandboxPlayground);

  await expect(page).toHaveURL(
    new RegExp(`/welcome\\?redirect=${encodeURIComponent(routes.sandboxPlayground)}$`),
  );
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
});

test('已完成补全的用户访问 /welcome 时，会被立即带离', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: completedStaffSession,
  });
  await seedAuthSession(page, completedStaffSession);

  await page.goto(routes.welcome);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: '默认工作台' })).toBeVisible();
});

test('已完成补全的用户访问带 login 回环 redirect 的 /welcome 时，应回退到首页', async ({
  page,
}) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: completedStaffSession,
  });
  await seedAuthSession(page, completedStaffSession);

  await page.goto(
    `${routes.welcome}?redirect=${encodeURIComponent('/login?redirect=%2Fsandbox%2Fplayground')}`,
  );

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: '默认工作台' })).toBeVisible();
});

test('未登录访问 /welcome 时，会按受保护页规则跳到登录页', async ({ page }) => {
  await page.goto(routes.welcome);

  await expect(page).toHaveURL(
    new RegExp(`/login\\?redirect=${encodeURIComponent(routes.welcome)}$`),
  );
  await expect(page.getByRole('heading', { name: '账户登录' })).toBeVisible();
});

test('登录成功且仍需补全时，应先进入 /welcome 而不是首页', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    loginSession: pendingRegistrantSession,
  });

  await page.goto(`${routes.login}?redirect=${encodeURIComponent(routes.sandboxPlayground)}`);
  await page.getByLabel('登录名或邮箱').fill('tester@example.com');
  await page.getByLabel('密码').fill('password');
  await page.getByRole('button', { name: /登\s*录/ }).click();

  await expect(page).toHaveURL(
    new RegExp(`/welcome\\?redirect=${encodeURIComponent(routes.sandboxPlayground)}$`),
  );
  await expect(page.getByText('补齐最小资料后再进入工作台')).toBeVisible();
});

test('登录成功且 redirect 先指向 /welcome 时，应解环并只保留最终站内目标', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    loginSession: pendingRegistrantSession,
  });

  await page.goto(
    `${routes.login}?redirect=${encodeURIComponent('/welcome?redirect=%2Fsandbox%2Fplayground')}`,
  );
  await page.getByLabel('登录名或邮箱').fill('tester@example.com');
  await page.getByLabel('密码').fill('password');
  await page.getByRole('button', { name: /登\s*录/ }).click();

  await expect(page).toHaveURL(
    new RegExp(`/welcome\\?redirect=${encodeURIComponent(routes.sandboxPlayground)}$`),
  );
});

test('welcome 提交成功后，会 refresh 会话并回到原目标页', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    completeProfileSession: completedStaffSession,
    currentSession: pendingRegistrantSession,
  });
  await seedAuthSession(page, pendingRegistrantSession);

  await page.goto(`${routes.welcome}?redirect=${encodeURIComponent(routes.sandboxPlayground)}`);
  await page.getByText('我是教职工').click();
  await page.getByLabel('姓名').fill('李老师');
  await page.getByLabel('昵称').fill('li-teacher');
  await page.getByLabel('手机号').fill('13800138000');
  await page.getByLabel('归属部门 ID').fill('dept-staff-001');
  await page.getByRole('button', { name: '提交并继续' }).click();

  await expect(page).toHaveURL(new RegExp(`${routes.sandboxPlayground}$`));
  await expect(page.getByRole('heading', { name: 'Sandbox 演练场' })).toBeVisible();
});

test('welcome 提交成功后若 refresh 失败，应强制回到登录页', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    completeProfileSession: completedStaffSession,
    currentSession: pendingRegistrantSession,
    refreshErrorMessage: 'TOKEN_INVALID',
  });
  await seedAuthSession(page, pendingRegistrantSession);

  await page.goto(`${routes.welcome}?redirect=${encodeURIComponent(routes.sandboxPlayground)}`);
  await page.getByText('我是教职工').click();
  await page.getByLabel('姓名').fill('李老师');
  await page.getByRole('button', { name: '提交并继续' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: '账户登录' })).toBeVisible();
  await expect(
    page.evaluate(() => window.localStorage.getItem('aigc-friendly-frontend.auth.session.v2')),
  ).resolves.toBeNull();
});

test('welcome 提交成功后若 refresh 后仍需补全，应停留当前页并展示异常反馈', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    completeProfileSession: pendingRegistrantSession,
    currentSession: pendingRegistrantSession,
    refreshSession: pendingRegistrantSession,
  });
  await seedAuthSession(page, pendingRegistrantSession);

  await page.goto(`${routes.welcome}?redirect=${encodeURIComponent(routes.sandboxPlayground)}`);
  await page.getByText('我是学生').click();
  await page.getByLabel('姓名').fill('王同学');
  await page.getByRole('button', { name: '提交并继续' }).click();

  await expect(page).toHaveURL(
    new RegExp(`/welcome\\?redirect=${encodeURIComponent(routes.sandboxPlayground)}$`),
  );
  await expect(page.getByRole('alert')).toContainText(
    '资料已提交，但当前会话仍显示待补全，请联系管理员核查后端收敛。',
  );
});

test('welcome 提交失败时，会停留在当前页并展示错误反馈', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    completeProfileErrorMessage: 'PROFILE_COMPLETION_FAILED',
    currentSession: pendingRegistrantSession,
  });
  await seedAuthSession(page, pendingRegistrantSession);

  await page.goto(routes.welcome);
  await page.getByText('我是学生').click();
  await page.getByLabel('姓名').fill('王同学');
  await page.getByRole('button', { name: '提交并继续' }).click();

  await expect(page).toHaveURL(new RegExp(`${routes.welcome}$`));
  await expect(page.getByRole('alert')).toContainText('PROFILE_COMPLETION_FAILED');
});
