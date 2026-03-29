import fs from 'fs';
let content = fs.readFileSync('e2e/specs/smoke/sidecar-main-responsive.spec.ts', 'utf-8');
content = content.replace(
  `const sidecar = page.getByRole('dialog', { name: '从这里开始' }).locator('..').locator('..');`,
  `const sidecar = page.getByRole('dialog', { name: '从这里开始' });`,
);
fs.writeFileSync('e2e/specs/smoke/sidecar-main-responsive.spec.ts', content);
