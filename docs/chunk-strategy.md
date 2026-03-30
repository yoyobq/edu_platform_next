<!-- docs/chunk-strategy.md -->

# Chunk Strategy

本文件是构建 chunk 拆分与体积治理的实施约定。
它用于指导后续落地，不是正式规则文档。

## 目标

- 首屏更轻
- 非首页路由按需加载
- 不为了压 `vite` warning 牺牲主链路稳定性

## 默认策略

- 首页主链路默认保持 eager：
  - `AppLayout`
  - `HomePage`
  - 全局 provider
  - Sidecar / Overlay / Third Workspace host
  - 路由错误边界
- 非首页路由默认优先采用 route-level `lazy`
- `labs` 优先于 `sandbox` 进入按需加载治理
- `sandbox` 不是当前首批优化对象，除非它反向拖重首屏

## 拆分优先级

1. 先拆非首页正式路由
2. 再拆低频但可能进入生产的 `labs`
3. 最后才考虑 bundler 层面的 `manualChunks`

## 禁止项

- 不为了消除 warning，把强耦合模块硬拆成多个松散 chunk
- 不把首页壳层拆成多段串行请求
- 不把本来很小的页面切成过多碎 chunk

## 验证口径

- 必须查看 build 产物体积变化
- 必须至少回归首页、Sidecar、`labs/demo`
- 若改动涉及路由加载方式，必须回归对应 smoke E2E

## 落地入口

### 路由层负责

- 页面级 `lazy`
- 非首页页面的按需加载
- `labs` 路由的按需加载

### `vite.config.ts` 负责

- 构建 warning 阈值
- 构建分析开关
- 在 route-level `lazy` 之后，才考虑少量 `manualChunks`

## 当前建议

第一轮只做两件事：

1. 把非首页路由改成 `lazy`
2. 再看 build 结果，确认是否还需要少量 `manualChunks`
