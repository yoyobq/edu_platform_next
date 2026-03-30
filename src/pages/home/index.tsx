import { Button, Flex } from 'antd';

import { ProjectStatusPanel } from '@/features/project-catalog';

export function HomePage() {
  return (
    <Flex vertical gap={24}>
      <div>
        <Button type="primary">Ant Design 正常</Button>
      </div>
      <ProjectStatusPanel />
    </Flex>
  );
}
