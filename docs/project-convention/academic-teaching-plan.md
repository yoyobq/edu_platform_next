<!-- docs/project-convention/academic-teaching-plan.md -->

# My 授课计划

## 当前真相

- 正式路由是 `/academic-affairs/my-teaching-plan`，页面所有者为 `src/pages/my-teaching-plan`，功能所有者为 `src/features/academic-teaching-plan`。
- 旧 `/labs/my-teaching-plan` 已移除，不提供重定向或兼容入口。
- 导航位于“教务助手”，紧跟 `My 计划首页`，并标记“试运行”。
- GraphQL schema、operation 名和后端合同保持不变；正式化只调整前端所有权、路由、导航和用户文案。

## 准入与数据视角

- `ADMIN / STAFF` 可进入，router loader 与 navigation provider 共用 `src/entities/auth-access` 的授课计划 capability helper。
- 普通教师仅读取本人计划。`ADMIN`、`ACADEMIC_OFFICER`、`TEACHING_GROUP_LEADER` 可使用教师选择器，最终数据权限始终以后端为准。
- upstream 登录、token 续期与失效恢复继续由公共 upstream session 能力承担，本 feature 只保留当前业务的 pending action。

## 课次投影与编辑

- 默认选择当前可见学期，按 `scheduleId` 区分同名课程和教学班。每条有效 academic planned occurrence 固定投影为一条正式课次；真源中分开的节次不在前端重组。
- A–E 每次从课表与校历真源重新生成。F“授课章节与内容”/G“课外作业”作为不可拆分的内容组编辑、拖动和删除。
- 内容组可拖到任意后方正式课次，来源与中间位置可保留未定义空位。因此参考计划只有 43 行而当期有 46 个正式课次时，可把原第 42 组移到第 46 格，第 42、44、45 格留空待填。
- 参考历史计划从近 6 学期的同教师相似课程中选择；用户确认后按历史完整行序替换 F/G。历史行多于正式课次时扩展表格，扩展行的 A–E 不展示数据。
- 删除后提供一次撤销。一体化课程只显示模板差异提示，不生成该 A–G 表格或导出。

## 草稿、地点与导出

- 授课方式、逐课次地点例外与 F/G 内容组使用 v4 localStorage key，按当前账号、目标教师、学期、课程隔离，从最后编辑起保留 24 小时，不兼容旧草稿版本。
- 授课方式默认线下。课程统一地点由后端 `classroomName` 持有；首次填写或表头整体修改会写回后端，整体修改同时清除当前课程的逐行地点例外。
- 导出格式是真实 BIFF8 `.xls`，文件名和工作表使用“授课计划”。只有 F/G 槽位总数与本学期正式课次数相等，且每个正式位置都存在内容组时才能导出；组内的两个文本单元格可以为空。扩展行或未定义空位都会阻止导出。
- 当前不发送通知；除课程统一地点外不写回排课，也不表达实到课或授课执行结果。
