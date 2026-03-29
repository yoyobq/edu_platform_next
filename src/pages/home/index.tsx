import { useState } from 'react';
import { Button, Card, Checkbox, Empty, Flex, Tag, Typography } from 'antd';

import { demoProjects, isProjectLive } from '@/entities/project';

export function HomePage() {
  const [showOnlyLive, setShowOnlyLive] = useState(false);

  const visibleProjects = demoProjects.filter((project) => {
    if (!showOnlyLive) {
      return true;
    }

    return isProjectLive(project);
  });

  return (
    <Flex vertical gap={24}>
      <Flex wrap gap={12}>
        <Button type="primary">Ant Design 正常</Button>
        <Checkbox
          checked={showOnlyLive}
          onChange={(event) => setShowOnlyLive(event.target.checked)}
        >
          只看上线项目
        </Checkbox>
      </Flex>

      <section className="max-w-5xl">
        <Flex align="center" justify="space-between" gap={16} className="mb-4">
          <div>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              项目状态面板
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              在调整暴露范围前，可先用这里观察哪些项目当前处于上线状态。
            </Typography.Paragraph>
          </div>

          <Tag color="blue">当前可见 {visibleProjects.length} 项</Tag>
        </Flex>

        {visibleProjects.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {visibleProjects.map((project) => {
              const isLive = isProjectLive(project);

              return (
                <Card
                  key={project.id}
                  data-testid={`project-card-${project.id}`}
                  title={
                    <Flex align="center" justify="space-between" gap={12}>
                      <span>{project.name}</span>
                      <Tag color={isLive ? 'green' : 'default'}>{isLive ? '已上线' : '已暂停'}</Tag>
                    </Flex>
                  }
                >
                  <Flex vertical gap={8}>
                    <Typography.Paragraph style={{ marginBottom: 0 }}>
                      {project.summary}
                    </Typography.Paragraph>
                    <Typography.Text strong>{project.monthlyPrice} / month</Typography.Text>
                    <Typography.Text type="secondary">
                      Updated at {project.updatedAt}
                    </Typography.Text>
                  </Flex>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <Empty description="当前没有可展示的上线项目。" />
          </Card>
        )}
      </section>
    </Flex>
  );
}
