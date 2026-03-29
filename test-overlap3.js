import fs from 'fs';
let content = fs.readFileSync('e2e/specs/smoke/sidecar-main-responsive.spec.ts', 'utf-8');
content = content.replace(
  `expect(afterColumnBox?.width).toBeLessThan(
    beforeColumnBox?.width ?? Number.POSITIVE_INFINITY,
  );`,
  `expect(afterColumnBox?.width).toBeLessThan(
    beforeColumnBox?.width ?? Number.POSITIVE_INFINITY,
  );
  expect((afterColumnBox?.x ?? 0) + (afterColumnBox?.width ?? 0)).toBeLessThan(sidecarBox?.x ?? 0);
  expect((afterHeaderBox?.x ?? 0) + (afterHeaderBox?.width ?? 0)).toBeLessThan(sidecarBox?.x ?? 0);`,
);
fs.writeFileSync('e2e/specs/smoke/sidecar-main-responsive.spec.ts', content);
