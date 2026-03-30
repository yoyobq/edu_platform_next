// src/shared/third-workspace-demo/canvas.tsx

import { CloseOutlined } from '@ant-design/icons';
import { Button, Card, Divider, Typography } from 'antd';

import type { ThirdWorkspaceDemoArtifact } from './model';

export function ThirdWorkspaceDemoCanvas({
  artifact,
  onClose,
}: {
  artifact: ThirdWorkspaceDemoArtifact;
  onClose: () => void;
}) {
  return (
    <div className="h-full w-full p-4 md:p-6">
      <div className="h-full overflow-hidden rounded-3xl shadow-2xl">
        <Card
          data-testid="third-workspace-canvas"
          styles={{
            body: {
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              padding: 24,
            },
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Typography.Text type="secondary">第三工作区 / Artifacts Canvas Demo</Typography.Text>
              <Typography.Title level={3} style={{ marginBottom: 4, marginTop: 4 }}>
                {artifact.title}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {artifact.summary}
              </Typography.Paragraph>
            </div>

            <Button
              type="text"
              shape="circle"
              icon={<CloseOutlined />}
              aria-label="关闭第三工作区"
              onClick={onClose}
            />
          </div>

          <Divider />

          <div className="grid flex-1 gap-6 overflow-y-auto lg:grid-cols-[minmax(0,1.5fr)_280px]">
            <div className="space-y-4">
              {artifact.sections.map((section) => (
                <Card key={section} size="small">
                  <Typography.Paragraph style={{ marginBottom: 0 }}>{section}</Typography.Paragraph>
                </Card>
              ))}
            </div>

            <div className="h-fit">
              <Card size="small">
                <div className="space-y-3">
                  <Typography.Text strong>为什么要跳层</Typography.Text>
                  <Typography.Paragraph style={{ marginBottom: 0 }}>
                    这块内容故意比 Sidecar 更长、更宽，用来验证“大结果物是否值得暂时脱离右侧侧栏”。
                  </Typography.Paragraph>
                  <Typography.Paragraph style={{ marginBottom: 0 }}>
                    当前 demo 只验证空间关系、进入/退出节奏与阅读密度，不代表正式编辑器能力。
                  </Typography.Paragraph>
                </div>
              </Card>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
