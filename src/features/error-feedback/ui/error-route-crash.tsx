// src/features/error-feedback/ui/error-route-crash.tsx

import { BugOutlined } from '@ant-design/icons';

import { ErrorBlock } from './error-block';

export function ErrorRouteCrash() {
  return (
    <ErrorBlock
      statusCode="ERR"
      tone="error"
      icon={<BugOutlined />}
      title="路由渲染异常"
      description={'页面在渲染前发生了未预期的错误。\n这通常是一个临时问题，刷新页面即可恢复。'}
      actions={[{ label: '返回首页', to: '/' }]}
    />
  );
}
