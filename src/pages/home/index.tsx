import { Flex } from 'antd';

import { ApiHealthStatusPanel } from '@/features/api-health-status';

export function HomePage() {
  return (
    <Flex vertical gap={24}>
      <ApiHealthStatusPanel />
    </Flex>
  );
}
