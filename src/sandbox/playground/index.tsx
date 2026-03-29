import { Card, Typography } from 'antd';

export function SandboxPlaygroundPage() {
  return (
    <Card className="max-w-3xl">
      <div className="space-y-3">
        <Typography.Title level={3} className="mb-0">
          Sandbox Playground
        </Typography.Title>
        <Typography.Paragraph className="mb-0">
          Free-form prototype area. Keep it self-contained and dev-only.
        </Typography.Paragraph>
      </div>
    </Card>
  );
}
