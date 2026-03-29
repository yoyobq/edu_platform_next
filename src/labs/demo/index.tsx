import { Card, Tag, Typography } from 'antd';

import { demoLabAccess } from './access';
import { demoLabMeta } from './meta';

export function DemoLabPage() {
  return (
    <Card title="Labs Demo" className="max-w-3xl">
      <div className="space-y-3">
        <Typography.Paragraph className="mb-0">{demoLabMeta.purpose}</Typography.Paragraph>
        <div className="flex flex-wrap gap-2">
          <Tag color="blue">owner: {demoLabMeta.owner}</Tag>
          <Tag color="purple">review: {demoLabMeta.reviewAt}</Tag>
          <Tag color="green">env: {demoLabAccess.env.join(', ')}</Tag>
          <Tag color="gold">roles: {demoLabAccess.roles.join(', ')}</Tag>
        </div>
      </div>
    </Card>
  );
}
