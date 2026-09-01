<!-- docs/labs-rules.md -->

# Labs Rules

本文件是当前 labs 主题的直接规则文档。

## 定位

`labs` 用于可受控进入生产的实验功能：

- 已有明确用途
- 可快速验证真实效果
- 不默认等同于正式功能
- 保持短生命周期和低稳定性预期，可以撤回、删除或迁入 `stable`

## 基本要求

- 必须有 `access list`
- 必须有用途说明
- 必须有负责人
- 必须有复查时间
- 必须说明撤回方式
- `reviewAt` 到期后必须复查，并给出“删除 / 延期 / 迁入 stable”之一的结论

## 依赖边界

生成或扩展 `labs` 时先看本节。

- `labs` 默认不得依赖 `stable` 的 `pages / widgets / features` 实现。
- `labs` 不得 deep import stable 私有文件；跨模块只能走公开 barrel。
- `labs` 可以依赖 `shared`，必要时可以依赖 `entities` 的公开 API。
- 已经确定为稳定业务对象的能力，应从一开始统一走对应 `entity`，不要在各个 lab 内复制。
- `upstream session` 明确归属 `entities/upstream-session`；任何 upstream 登录、恢复、
  rolling token、staff directory 或 upstream proxy GraphQL 需求，都必须使用
  `@/entities/upstream-session` 的公开 API。
- labs 页面不得直接依赖 `features/auth` 读取本站登录态；需要当前本站账号时，由
  `app/router` 的 labs loader 注入最小 `currentAccount` 数据。
- lab 自己的实验 API、mock、页面流程仍收束在当前 lab 内部。

## 推荐结构

```txt
src/labs/<lab-name>/
  index.tsx
  access.ts
  meta.ts
  ui/
  lib/
  infrastructure/   # optional
  mock.ts           # optional
```

补充：

- `labs` 要求基本分层：`access.ts` / `meta.ts` / route 入口 / 页面实现 / 实验内
  `ui`、`lib`、`infrastructure` 等边界应按需要分开
- `labs` 不要求完整第二维
- 但 API、storage、URL 参数、SDK、mock 等外部边界，应收束在当前实验模块内
- 简单实验可用 `mock.ts`
- 边界增多时，改为 `infrastructure/`
- 具体收束规则见 [infrastructure-rules.md](./infrastructure-rules.md)

## 借用方向

- `labs` 不建立与 `stable-clean` 对等的 `labs-clean` 体系
- `labs` 不强制补齐 `domain / application / infrastructure / ui`
- 但当实验开始出现稳定外部边界、轻量流程编排或 mock / real 切换时，优先借用 `stable-clean` 的边界收束思路
- 这里的“借用”只表示优先让职责更清晰，不表示必须把实验模块工程化为完整 Clean 分层
- 若实验仍然是轻量验证、一次性观察或短生命周期实现，继续保持简单结构即可
- 若实验后续被确认长期保留，再在迁入 `stable` 时判断是否需要正式进入第二维

## 迁入 Stable

- `labs` 迁入 `stable` 时，默认不是让正式区继续依赖 `labs` 实现
- 更稳的做法是把已验证的能力重新落到 `stable` 内部的拥有者切片中，再由 `pages` 或其他正式模块消费
- `labs` 更像验证场与过渡形态，不作为正式区长期依赖目标
- 若迁入后已形成稳定业务切片，再按 `stable-clean` 判断是否需要第二维

## access.ts

`labs` 若要出现在 `prod`，必须带轻量 access list。

统一结构：

```ts
{
  env: ['dev', 'prod'],
  allowedAccessLevels: ['admin', 'staff'],
  menu: false,
}
```

访问语义：

- 未命中 access list 时，不得暴露入口
- 未命中 access list 时，不得直接访问成功
- access list 不是“只隐藏菜单”，而是实验功能的暴露控制
- `menu: false` 的 lab 可以只保留直达路由或内部联调入口，不要求进入 navigation provider
- `menu: true` 的 lab 才需要出现在 `src/app/navigation/providers/labs.ts`
- `app/router` 统一使用 labs loader helper 执行环境、登录、profile completion 与权限检查；
  新 lab 不应在页面内自行恢复本站登录态。
- 若 lab 需要 loader 数据，loader 只注入页面所需的最小稳定数据，例如
  `{ currentAccount: { accountId, displayName } }`。
- 受“稳定区不得依赖 labs”的单向依赖限制，navigation 不 import `labs/*/access.ts`；若
  lab 进入菜单，`src/app/navigation/providers/labs.ts` 只镜像对应 `access.ts` 的暴露范围
- 若菜单可见的 lab 需要额外 `canAccess` 条件，router guard 与 navigation provider
  必须同步同一能力 helper
- staff lab 暴露默认不等于所有 staff 都有相同业务数据范围；具体数据权限仍以后端接口为准
- 删除或撤回 lab 时，应同步移除路由注册、导航投影与相关测试断言

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

## 当前落地示例

- `/labs/demo`
  - 用于第三工作区跳层 demo
- `/labs/invite-issuer`
  - 用于临时调用 `inviteStaff` / `issueStudentRegistrationLink` 生成联调链接，或触发老用户回归改密邮件
  - 属于实验性联调工具，不承担正式管理后台职责
  - 若后续出现正式管理入口，应优先迁入正式区拥有者切片，而不是继续扩展该 labs 页面
- `/labs/upstream-session-demo`
  - 用于演示“前端持有 upstream token、后端代访问 upstream”的当前标准链路
  - 当前使用教师字典、班级列表、历史班主任、教职工身份、教学计划等 upstream 代理接口作为示例数据源
  - 若后续出现正式 upstream 业务页，应优先迁入正式区拥有者切片，而不是让 labs 长期承担正式入口
- `/labs/upstream-session-reference`
  - 用于展示新 labs 接入 upstream session 的最小标准样板
  - 页面只展示登录、恢复、pending action 与 modal controller，不绑定具体 upstream 业务接口
  - 后续需要 upstream session 的 lab，应优先参考该页，而不是复制业务型
    `/labs/upstream-session-demo`
- `/labs/student-evaluation-comment`
  - 用于验证学期/毕业正式评语的班级批量编辑、Excel 草稿导入、学期 AI 加密草稿确认、CAS 冲突恢复和学生本人只读链路
  - 对 `ADMIN / STAFF / STUDENT` 暴露；页面按当前会话投影编辑/本人视图，最终业务权限始终以后端为准
  - 编辑页只使用评语 workspace 返回的班级、真实学期、正式名单与 action
  - Excel 只执行单文件 dry-run、工作表/重名身份确认和草稿预填，最终保存仍使用正式评语 GraphQL mutation
  - AI 草稿只支持真实学期范围：老师主动选择目标，系统异步生成 7 天有效的加密草稿；草稿修改需显式保存，老师二次确认后才写入正式评语
  - 普通学期综合已确认操行、课程成绩和可选风格样例；班级学制最后一个学期自动使用下厂/校外实习场景，不读取这些个体依据，只生成需要人工审阅的一般性职业期许
  - 班级、学期和名单读取本地治理快照；普通学期的 AI 区复用公共 upstream session，可在当前页登录并依次同步当前班级当前学期的已确认操行与课程成绩生成依据
  - 不承载 AI 历史版本、导出或跨班批量操作；确认稳定后应迁入正式学生评语拥有者切片
- `/labs/student-evaluation-comment-workbench`
  - 保留原学生评语 Lab 作为功能认证基线，独立验证教师侧产品化工作台，不依赖旧 Lab 实现
  - 班级选择在“学期评语 / 毕业鉴定”Tab 间共享，以待处理、生成中、待审阅、已完成和问题状态驱动统一学生列表
  - 人工填写、AI 生成、草稿审阅、生成依据更新和正式确认在同一任务流中完成
  - 最后一个学期按下厂/校外实习场景独立治理，跳过操行预检、成绩同步和上一学期风格样例
  - 毕业鉴定不选学期、不导入 Excel、不配置生成语气；正常在读学生须具备全部应有学期正式评语，复学学生至少两学期，实际生成统一采用最近最多三学期
  - 当前仅对 `ADMIN / STAFF` 暴露；学生本人评语查看仍由原 Lab 承担
- `/labs/my-teaching-plan`
  - 用于验证把课表与校历计算后的 academic planned occurrence 真源投影为教师课程级教学计划
  - 默认选择当前可见学期，按 `scheduleId` 区分同名课程与教学班，并以接近 Excel 的 A–E 列展示授课时间、学时数、节次、授课方式和授课地点
  - 每条有效 occurrence 固定投影为一行；真源已切分的 `1,2` 与 `3,4` 必须保持两行，不得在前端重组为连续四节
  - 授课方式默认线下；授课地点首次填写会补齐本课程其余空行，二者仅按当前账号、目标教师、学期、课程在当前浏览器保留至最后编辑后 24 小时，服务器不保存
  - 页面每次读取当前真源重新生成 A–C；F“授课章节与内容”和 G“课外作业”暂不开放编辑并以空列导出，后续应在相同真源行边界上扩展
  - Excel 是用户长期保留教学计划的唯一载体，页面必须持续强提示限时草稿边界并提供直接导出入口
  - 停课与调出仅作为低噪音调整记录，不混入有效日期和主指标
  - 普通教师只读取本人计划；管理员、教务人员和教研组长可选择后端授权范围内的教师，最终数据权限以后端为准
  - 当前不发送通知、不写回排课，也不表达实际到课或教学执行结果
- `/labs/zquiz-activity-builder`
  - 用于验证教师侧 Zquiz 组卷与活动发布流程
  - 当前对 `ADMIN / STAFF` 暴露，不要求教务 slot
- `/labs/zquiz-exam-teacher-gradebook`
  - 用于验证教师侧考试成绩分析体验
  - 当前对 `ADMIN / STAFF` 暴露
- `/labs/zquiz-exam-activities`
  - 用于验证学生侧可选考试列表与考试入口
  - 当前对 `STUDENT` 暴露
- `/labs/zquiz-practice-activities`
  - 用于验证学生侧可选练习列表、状态展示与开始练习接口联调体验
  - 当前对 `STUDENT` 暴露
  - 若后续作为正式学生练习入口，应迁入正式区拥有者切片
- `/labs/student-roster-membership-reconciliation`
  - 用于验证单班学生名册归属核对 dry-run、确认与 commit 流程
  - 当前正式入口已迁入 `/academic-affairs/student-roster-membership-reconciliation`，在“班务管理 / 本地建班”中暴露
  - labs 路由只保留历史兼容重定向或遗留代码治理语义，不再作为 staff labs 入口

## 例外声明位置

- 若 `labs` 需要使用规则之外的例外依赖，必须记录在该实验自己的 `meta.ts` 中
- 不使用文档尾部集中例外列表，也不依赖单独 `README.md` 口头说明
- `exception` 只记录已确认例外，不作为默认字段滥用
