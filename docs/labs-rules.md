# Labs Rules

本文件是当前 labs 主题的直接规则文档。

## 定位

`labs` 用于可受控进入生产的实验功能：

- 已有明确用途
- 可快速验证真实效果
- 不默认等同于正式功能

## 基本要求

- 必须有 `access list`
- 必须有用途说明
- 必须有负责人
- 必须有复查时间
- 必须说明撤回方式
- `reviewAt` 到期后必须复查，并给出“删除 / 延期 / 迁入 stable”之一的结论

## 推荐结构

```txt
src/labs/<lab-name>/
  index.tsx
  access.ts
  meta.ts
  ui/
  lib/
```

## access.ts

`labs` 若要出现在 `prod`，必须带轻量 access list。

统一结构：

```ts
{
  env: ['dev', 'prod'],
  roles: ['admin', 'teacher'],
  menu: false,
}
```

访问语义：

- 未命中 access list 时，不得暴露入口
- 未命中 access list 时，不得直接访问成功
- access list 不是“只隐藏菜单”，而是实验功能的暴露控制

## meta.ts

最小模板：

```ts
export const demoLabMeta = {
  name: 'demo',
  purpose: '用于验证某个实验功能的真实使用效果',
  owner: 'frontend',
  reviewAt: '2026-04-30',
  rollback: '移除实验路由并隐藏入口',
  exception: ['依赖 @/entities/user 的公开内容'],
} as const;
```

字段说明：

- `name`：实验标识
- `purpose`：实验用途说明
- `owner`：负责人
- `reviewAt`：复查时间，使用 `YYYY-MM-DD`
- `rollback`：撤回方式
- `exception`：可选，记录经过确认的例外依赖或特殊规则

## 例外声明位置

- 若 `labs` 需要使用规则之外的例外依赖，必须记录在该实验自己的 `meta.ts` 中
- 不使用文档尾部集中例外列表，也不依赖单独 `README.md` 口头说明
- `exception` 只记录已确认例外，不作为默认字段滥用
