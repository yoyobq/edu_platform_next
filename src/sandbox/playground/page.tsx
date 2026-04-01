// src/sandbox/playground/page.tsx

import { Card, Typography } from 'antd';

export function SandboxPlaygroundPage() {
  return (
    <div className="max-w-3xl">
      <Card>
        <div className="flex flex-col gap-3">
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            Sandbox 演练场
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            自由原型试验区。保持自包含，并仅限 dev / test 环境使用。
          </Typography.Paragraph>
        </div>
      </Card>
    </div>
  );
}
