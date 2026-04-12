// src/features/error-feedback/ui/error-404.tsx

import { CompassOutlined } from '@ant-design/icons';

import { ErrorBlock } from './error-block';

export function Error404() {
  return (
    <ErrorBlock
      statusCode={404}
      tone="neutral"
      icon={<CompassOutlined />}
      title="路由不存在"
      description={'你访问的页面已被移除、重命名，\n或在当前环境中不可用。'}
      actions={[{ label: '返回首页', to: '/' }]}
    />
  );
}
