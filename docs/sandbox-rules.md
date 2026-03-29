# Sandbox Rules

本文件是当前 sandbox 主题的直接规则文档。

## 定位

`sandbox` 用于开发期快速试错：

- prompt 直接生成的原型页
- UI 试玩
- 交互验证
- 一次性试验代码
- 尚未确认是否有价值的想法

## 基本要求

- 仅 `dev` 可见
- 不进入 `prod`
- 不进入正式菜单
- 尽量自包含
- 不要求复制正式区分层

## 自包含

“自包含”的含义：

- `sandbox` 可依赖 `shared` 的通用基础能力
- 原型专用的 API 封装、数据映射、临时 mock、字段兼容逻辑应保留在 `sandbox` 内
- 只有当某段能力已脱离原型语义，且可被多个正式模块复用时，才考虑迁入 `shared`

## 推荐结构

```txt
src/sandbox/<prototype-name>/
  index.tsx
  mock.ts
  assets/
```

## 禁止项

- 不进入生产
- 不作为正式交付内容
- 不被正式页面依赖
- 不被 `labs` / `stable` 反向依赖
- 不长期保留不处理
