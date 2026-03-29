import { Card, Tag, Typography } from 'antd';

import { demoLabAccess } from './access';
import { demoLabMeta } from './meta';

export function DemoLabPage() {
  return (
    <div className="max-w-3xl">
      <Card>
        <div className="space-y-3">
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            Labs 示例页
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            {demoLabMeta.purpose}
          </Typography.Paragraph>
          <div className="flex flex-wrap gap-2">
            <Tag color="blue">负责人：{demoLabMeta.owner}</Tag>
            <Tag color="purple">复核时间：{demoLabMeta.reviewAt}</Tag>
            <Tag color="green">环境：{demoLabAccess.env.join(', ')}</Tag>
            <Tag color="gold">角色：{demoLabAccess.roles.join(', ')}</Tag>
          </div>
        </div>
      </Card>
    </div>
  );
}
