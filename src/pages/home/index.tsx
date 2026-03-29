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
        <Button type="primary">Ant Design OK</Button>
        <Checkbox
          checked={showOnlyLive}
          onChange={(event) => setShowOnlyLive(event.target.checked)}
        >
          Only live
        </Checkbox>
      </Flex>

      <section className="max-w-5xl">
        <Flex align="center" justify="space-between" gap={16} className="mb-4">
          <div>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              Project Health
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Use this panel to observe which projects are live before changing exposure.
            </Typography.Paragraph>
          </div>

          <Tag color="blue">{visibleProjects.length} visible</Tag>
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
                      <Tag color={isLive ? 'green' : 'default'}>{isLive ? 'LIVE' : 'PAUSED'}</Tag>
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
            <Empty description="No live projects to show." />
          </Card>
        )}
      </section>
    </Flex>
  );
}
