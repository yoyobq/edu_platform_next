// src/labs/demo/page.tsx

import { useMemo, useState } from 'react';
import { ArrowRightOutlined, ExpandOutlined } from '@ant-design/icons';
import { Button, Card, Divider, Space, Tag, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router';

import {
  getThirdWorkspaceDemoArtifactById,
  readThirdWorkspaceDemoArtifactId,
  THIRD_WORKSPACE_DEMO_ARTIFACTS,
  THIRD_WORKSPACE_DEMO_TRIGGER,
  withThirdWorkspaceDemo,
} from '@/shared/third-workspace-demo';

import { demoLabAccess } from './access';
import { demoLabMeta } from './meta';

export function DemoLabPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedArtifactId, setSelectedArtifactId] = useState(
    THIRD_WORKSPACE_DEMO_ARTIFACTS[0]?.id ?? '',
  );

  const selectedArtifact = useMemo(
    () => getThirdWorkspaceDemoArtifactById(selectedArtifactId),
    [selectedArtifactId],
  );
  const openedArtifactId = readThirdWorkspaceDemoArtifactId(location.search);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              第三工作区跳层 Demo
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {demoLabMeta.purpose}
            </Typography.Paragraph>
          </div>

          <div className="flex flex-wrap gap-2">
            <Tag color="blue">负责人：{demoLabMeta.owner}</Tag>
            <Tag color="purple">复核时间：{demoLabMeta.reviewAt}</Tag>
            <Tag color="green">环境：{demoLabAccess.env.join(', ')}</Tag>
            <Tag color="gold">角色：{demoLabAccess.roles.join(', ')}</Tag>
          </div>

          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            这不是正式的 Artifacts Canvas，只是验证当结果物超出 Sidecar 的舒适阅读范围时，
            是否应该临时跳到更宽的第三工作区。在当前 labs demo 的 Sidecar 中输入 demo 验证触发词
            <Typography.Text code>{THIRD_WORKSPACE_DEMO_TRIGGER}</Typography.Text>
            也能直接打开同一个 demo。
          </Typography.Paragraph>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,420px)]">
        <Card title="候选结果物">
          <div className="flex flex-col gap-3">
            {THIRD_WORKSPACE_DEMO_ARTIFACTS.map((artifact) => {
              const isActive = artifact.id === selectedArtifactId;

              return (
                <Card
                  key={artifact.id}
                  hoverable
                  size="small"
                  data-testid={`artifact-card-${artifact.id}`}
                  onClick={() => setSelectedArtifactId(artifact.id)}
                  style={{
                    borderColor: isActive
                      ? 'var(--ant-color-primary)'
                      : 'var(--ant-color-border-secondary)',
                  }}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Typography.Text strong>{artifact.title}</Typography.Text>
                        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                          {artifact.summary}
                        </Typography.Paragraph>
                      </div>
                      {isActive ? <Tag color="blue">当前预览</Tag> : null}
                    </div>

                    <Space wrap>
                      <Button
                        type={isActive ? 'primary' : 'default'}
                        icon={<ExpandOutlined />}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedArtifactId(artifact.id);
                          navigate(
                            {
                              pathname: location.pathname,
                              search: withThirdWorkspaceDemo(location.search, artifact.id),
                            },
                            { replace: false },
                          );
                        }}
                      >
                        跳到第三工作区
                      </Button>
                      <Button
                        type="text"
                        icon={<ArrowRightOutlined />}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedArtifactId(artifact.id);
                        }}
                      >
                        只在页内切换预览
                      </Button>
                    </Space>
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>

        <Card
          title="页内对照预览"
          extra={
            openedArtifactId ? (
              <Tag color="cyan">第三工作区已打开</Tag>
            ) : (
              <Tag color="processing">主区</Tag>
            )
          }
        >
          {selectedArtifact ? (
            <div className="flex flex-col gap-4">
              <div>
                <Typography.Text strong>{selectedArtifact.title}</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  {selectedArtifact.summary}
                </Typography.Paragraph>
              </div>

              {selectedArtifact.sections.map((section) => (
                <Typography.Paragraph key={section} style={{ marginBottom: 0 }}>
                  {section}
                </Typography.Paragraph>
              ))}

              <Divider style={{ marginBlock: 16 }} />

              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                如果这里只是短摘要，放在主区或 Sidecar
                都足够；如果继续展开成更长文档，再跳到第三工作区会更自然。
              </Typography.Paragraph>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
