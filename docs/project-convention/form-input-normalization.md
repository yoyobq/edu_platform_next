# Form Input Normalization

本文件是当前表单输入与 URL Search Params 收敛主题的直接规则文档。

## 目标

前端项目里最容易反复散掉的规则之一，就是 input normalization。

常见问题包括：

- `trim()`、空字符串判断、默认值处理散落在 component、hook、submit handler 多处
- 同一个字段在 form state、URL Search Params、request payload 中语义不一致
- `undefined`、`null`、`''`、空白字符串被默认当成同一件事
- `page`、`pageSize`、`keyword`、`tags`、boolean filter 各自有一套写法

本文件用于统一：

- 原始输入值应在哪一层收敛
- 空值、列表、数字范围、boolean 的基础语义
- form state 与 URL Search Params 如何对齐

一句话原则：

`UI 收集 raw input，normalization 收敛稳定值，feature logic 负责业务决策。`

## 分层边界

### UI / Form Layer

职责：

- 收集用户原始输入
- 管理 controlled state
- 处理与 UI component API 直接相关的轻量转换
- 承接即时交互反馈

允许：

- 保存原始字符串
- 为了显示体验做局部 `trim` 提示
- 将 checkbox、select 等浏览器或 component 原始值转成基础形态

禁止：

- 临时决定仓库级空值策略
- 在事件处理器里到处把空白字符串偷偷转成 `undefined` 或 `null`
- 在 page 内重复拼接 request shaping 逻辑

### Normalization Layer

职责：

- 将 raw input 或 URL Search Params 收敛成稳定值
- 统一空值策略
- 统一列表策略
- 统一数字范围收敛
- 输出稳定的 filter object、query params 或 request params

禁止：

- API 请求
- permission 判断
- route 注册
- UI 反馈编排

推荐落位：

- 跨 feature 的 primitive normalization：`src/shared/`
- `app shell` 或全局 URL state 相关 helper：`src/app/lib/`
- 领域内专用 normalization：放在 owning `feature`、`entity` 或 `labs` 附近

## 空值语义

以下几种值默认不得视为同义：

- `undefined`：调用方未提供
- `null`：调用方显式提供空值，且下游 contract 支持显式清空
- `''`：空字符串
- `'   '`：空白字符串

统一要求：

- 不得在没有声明 policy 的情况下自动合并这四种语义
- 空白字符串的解释应进入 normalization，而不是散落在各个事件处理器里
- optional text 必须显式选择自己的 empty policy

推荐的 empty policy：

- `to_undefined`：适用于 optional filter、optional search、可删除的 URL param
- `to_null`：仅在下游 contract 明确要求 `null` 表示清空时使用
- `keep_empty_string`：仅在空字符串本身有业务含义时使用
- `reject`：UI 层可暂时为空，但 submit 前必须转成有效值

## 文本规则

- required text：先 `trim`，再拒绝空结果
- optional text：先 `trim`，再按显式 empty policy 收敛
- `keyword` 一类搜索字段应只 normalize 一次，再复用到 URL state 与 request payload

## 列表规则

- 先逐项 normalize，再生成最终列表
- 必须显式决定空项是过滤还是报错
- 只有 contract 需要 dedupe 时，才开启 dedupe
- dedupe 后保持原有顺序

## 数字范围规则

- `page`、`pageSize`、`limit` 等值统一按 `fallback + min + max` 收敛
- 不允许在多个 component 中散写 `Number(...) || fallback`
- 非法数字型 URL param 应退化为稳定 fallback，而不是把 `NaN` 继续传下去

## Boolean 规则

- “未提供” 与 `false` 必须区分
- URL 中的 `true`、`false`、`1`、`0` 应由同一套 normalization 规则收口
- 不允许某个 page 认 `1/0`，另一个 page 只认 `true/false`

## URL Search Params

URL Search Params 也是输入面的一部分，应和 form 使用同一套语义。

统一要求：

- 原始 URL 字符串必须先 normalize，再进入 page logic
- 若某字段同时存在于 form state 与 URL state，两边必须收敛到同一稳定表示
- 当 policy 为 `to_undefined` 时，移除 filter 应直接移除对应 param
- 不能因为某个 input component 发出了空字符串，就把语义为空的 param 长期留在 URL 中

## Submit 与 Request Building

- request builder 只消费 normalized value，不直接消费 raw component state
- feature 接收的应是稳定 params object，而不是再从 form 内部状态二次猜语义
- component 可以为了 UX 保留 raw state，但 submit handler 应只跨一次 normalization 边界

## 渐进迁移

- 不要求一次性重写所有 form
- 修改旧 form 时，先把重复的 normalization 逻辑收敛为一个本地 helper
- 当同类 helper 明确复用后，再上收至更稳定的位置
