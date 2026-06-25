<!-- docs/project-convention/student-profile-filing.md -->

# Student Profile Filing

本文件记录“学生建档”的前端契约与范围口径。后端 schema 真相以
[../backend/README.md](../backend/README.md) 指向的来源为准；本文只描述前端需要稳定遵守
的行为。

## 分层

- page owner：`src/pages/student-profile-filing`
- feature owner：`src/features/student-profile-filing`
- API client 归 feature infrastructure，统一通过 `executeGraphQL()` /
  `executeUpstreamSessionGraphQL()` 调用后端
- upstream 会话统一从 `@/entities/upstream-session` 消费，不在页面内自建 token 存储

## 范围口径

学生建档范围由后端统一判定，前端不得自行用 `student_class_membership.status`、
`studentStatus` 或 `currentClassCode` 做额外过滤。

当前后端建档范围包含：

- 当前 active 班级归属学生
- 已报道后最终退学，并且存在 active `EXCLUDE + DROPPED_CONFIRMED` 裁定的学生

因此前端必须接受退学学生出现在以下数据中：

- 班级选项 `studentCount`
- 班级概览 `students[]`
- 整班刷新结果 `results[]`
- 单学生建档 / 更新资料相关流程

## 字段语义

GraphQL 字段结构保持兼容。`activeMembershipClassCode` /
`activeMembershipClassName` 字段名虽然保持不变，但前端语义上只能理解为“建档范围班级”或
“归属班级”，不能展示或推断为“当前 ACTIVE membership 班级”。

对于退学裁定学生，这两个字段可能来自建档范围解析，不一定来自 active membership。

`currentClassCode` / `currentClassId` 仍只是学生读侧投影，不是学生建档归属真相。

## 前端展示约束

- 不展示无业务价值的 `studentStatus` 列
- 不因为 `studentStatus === DROPPED` 隐藏学生
- `UPSTREAM_ID_MISSING` 仍按原逻辑展示为阻断状态，行级操作不可用
- 行级操作文案按建档状态拆分：
  - `待建档`：`建档`
  - `已建档` / `需关注`：`更新资料`
  - `缺学工关联`：`无法建档`

## GraphQL 契约

前端当前使用的接口包括：

- `studentPrivateProfileClassOptions`
- `studentPrivateProfileClassOverview`
- `refreshStudentPrivateProfileClassFromUpstream`
- `refreshStudentPrivateProfileFromUpstream`

范围调整不要求前端新增 DTO 字段、改 mutation 名称或改 input 结构。
