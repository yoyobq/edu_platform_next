import { Card, Typography } from 'antd';

export function SandboxPlaygroundPage() {
  return (
    <div className="max-w-3xl">
      <Card>
        <div className="space-y-3">
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            Sandbox Playground
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            Free-form prototype area. Keep it self-contained and dev-only.
          </Typography.Paragraph>
        </div>
      </Card>
    </div>
  );
}
