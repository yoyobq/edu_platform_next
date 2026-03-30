<!-- docs/project-convention/time-display-semantics.md -->

# Time Display Semantics

本文件是当前时间展示与时间语义主题的直接规则文档。

## 目标

前端最常见的问题之一，不是“不会显示时间”，而是“把不同语义的时间当成同一种值处理”。

当前项目至少区分三类时间语义：

- event time
- business date
- business date-time

本文件用于统一：

- 不同时间语义分别表示什么
- state、API contract、display 应如何处理
- 哪些场景允许 timezone conversion，哪些场景不应自动转换

一句话原则：

`先声明时间语义，再决定 parsing、state shape 与 display 方式。`

## 三类时间语义

### Event Time

适用场景：

- `createdAt`
- `updatedAt`
- published timestamp
- log、audit record
- 一切表示“某一刻发生了什么”的时间

推荐表示方式：

- API contract：带 timezone 或 offset 的 ISO 8601 string
- frontend state：优先保留原始 string
- formatting 边界：在 helper、selector 或 view-model mapping 中临时转成 `Date`

### Business Date

适用场景：

- 只关心“哪一天”的日期
- enrollment date
- due date
- 以天为单位的 schedule filter

推荐表示方式：

- API contract：`YYYY-MM-DD`
- frontend state：保持为 `string`

统一要求：

- 不要为了方便把 business date 存成 `Date`
- 不要把 `new Date('YYYY-MM-DD')` 当作稳定写法默认扩散
- business date 的核心语义是“日”，不是“某一时刻”

### Business Date-Time

适用场景：

- booking slot
- 业务上约定的本地发布日期时间
- Sidecar 或 workflow 中按本地墙钟时间安排的动作

推荐表示方式：

- API contract：使用仓库内明确约定的序列化格式
- frontend state：保持该稳定格式，或保持拆分后的输入结构

统一要求：

- 不得把 business date-time 默认当成 event time 处理
- 不得在未声明的情况下自动附加浏览器 timezone

## Display 规则

- formatting 应集中在 helper、selector 或 view-model mapping 中处理
- component tree 应尽量消费已经确定好的 display value，而不是各自临时拼格式
- absolute time 与 relative time 应有意识地区分，不要在同一信息块里随意混用
- 当同一页面同时出现 business date 与 event time 时，应通过 label 或格式差异让用户能一眼区分

## Input 规则

- form 编辑中可以暂存 raw string
- 在 submit 或 URL 边界统一做 normalization，不要把零散转换散在多个事件处理器里
- 如果某个 component 直接吐出 `Date`，应尽快把它转换为仓库认可的语义表示，再向外传递

## Timezone 规则

- event time 可以做 timezone conversion
- business date 默认不做 timezone conversion
- business date-time 是否做 timezone conversion，必须由明确 contract 决定
- 不要把浏览器 locale 或当前机器 timezone 默认固化进 shared business logic

## 快速判断法

改动一个时间字段前，先问四个问题：

1. 它是 event time、business date，还是 business date-time？
2. 它在 state 和 API 中应使用什么稳定表示？
3. display formatting 放在哪一层处理？
4. 对它做 timezone conversion 会不会改变原本语义？
