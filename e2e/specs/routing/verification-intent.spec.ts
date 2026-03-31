import { routes } from '../../fixtures/routes';
import { expect, test } from '../../test';

const verificationCases = [
  {
    title: '邀请入口应通过 path-first 路由落到 public entry 分支',
    path: routes.invite('workspace', 'invite-code-001'),
    heading: '邀请入口',
    assertions: ['邀请类型', 'workspace', '验证代码', 'invite-code-001'],
  },
  {
    title: '邮箱验证入口应通过 path-first 路由落到 public entry 分支',
    path: routes.verifyEmail('verify-email-001'),
    heading: '邮箱验证入口',
    assertions: ['验证代码', 'verify-email-001'],
  },
  {
    title: '重置密码入口应通过 path-first 路由落到 public entry 分支',
    path: routes.resetPassword('reset-password-001'),
    heading: '重置密码入口',
    assertions: ['验证代码', 'reset-password-001'],
  },
  {
    title: 'Magic Link 入口应通过 path-first 路由落到 public entry 分支',
    path: routes.magicLink('magic-link-001'),
    heading: 'Magic Link 入口',
    assertions: ['验证代码', 'magic-link-001'],
  },
] as const;

for (const verificationCase of verificationCases) {
  test(verificationCase.title, async ({ page }) => {
    await page.goto(verificationCase.path);

    await expect(page).toHaveURL(new RegExp(`${verificationCase.path}$`));
    await expect(page.getByRole('heading', { name: verificationCase.heading })).toBeVisible();
    await expect(page.getByText('Public Entry')).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(0);

    for (const assertion of verificationCase.assertions) {
      await expect(page.getByText(assertion)).toBeVisible();
    }
  });
}
