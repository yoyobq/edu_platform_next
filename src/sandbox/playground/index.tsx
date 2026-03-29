import { Card, Typography } from 'antd';

export function SandboxPlaygroundPage() {
  return (
    <Card title="Sandbox Playground" className="max-w-3xl">
      <Typography.Paragraph className="mb-0">
        Free-form prototype area. Keep it self-contained and dev-only.
      </Typography.Paragraph>
    </Card>
  );
}
