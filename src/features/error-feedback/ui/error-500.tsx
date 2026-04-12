// src/features/error-feedback/ui/error-500.tsx

import { ThunderboltOutlined } from '@ant-design/icons';

import { ErrorBlock } from './error-block';

export function Error500() {
  return (
    <ErrorBlock
      statusCode={500}
      tone="error"
      icon={<ThunderboltOutlined />}
      title="服务异常"
      description={'服务端在处理请求时遇到了意外错误。\n请稍后重试，或联系技术支持。'}
      actions={[{ label: '返回首页', to: '/' }]}
    />
  );
}
