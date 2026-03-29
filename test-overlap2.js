import fs from 'fs';
let content = fs.readFileSync('e2e/specs/smoke/sidecar-main-responsive.spec.ts', 'utf-8');
content = content.replace(
  `const contentColumn = page.locator('[data-main-width-band] > .mx-auto.max-w-7xl.pt-6').first();`,
  `const contentColumn = page.locator('[data-main-width-band] > .mx-auto.max-w-7xl.pt-6').first();
  const headerColumn = page.locator('.ant-layout-header > .mx-auto.max-w-7xl').first();`,
);
content = content.replace(
  `const afterColumnBox = await contentColumn.boundingBox();`,
  `const afterColumnBox = await contentColumn.boundingBox();
  const afterHeaderBox = await headerColumn.boundingBox();
  console.log("Header Right Edge:", (afterHeaderBox?.x ?? 0) + (afterHeaderBox?.width ?? 0));`,
);
fs.writeFileSync('e2e/specs/smoke/sidecar-main-responsive.spec.ts', content);
