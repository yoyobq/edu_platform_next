import { Sender } from '@ant-design/x';
import { Button, ConfigProvider, Flex, Typography } from 'antd';

export function App() {
  return (
    <ConfigProvider>
      <div className="min-h-screen p-8">
        <Flex vertical gap={16}>
          <Typography.Title level={2}>aigc-friendly-frontend</Typography.Title>

          <Button type="primary">Ant Design OK</Button>

          <div className="max-w-xl rounded-2xl border p-4">
            <Sender placeholder="Ant Design X OK" />
          </div>
        </Flex>
      </div>
    </ConfigProvider>
  );
}
