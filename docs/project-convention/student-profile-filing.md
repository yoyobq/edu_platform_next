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

退学起始学期只消费后端返回的 `rosterScopeSource` / `droppedEffectiveSemesterLabel`。
前端不得用 `studentStatus`、`currentClassCode`、`activeMembershipClassCode` 推断退学学期。

## 前端展示约束

- 不展示无业务价值的 `studentStatus` 列；`studentStatus` 只允许作为退学行内标记来源
- 不因为 `studentStatus === DROPPED` 隐藏学生
- 学生列只展示“退学”标记；退学起始学期放在提醒列，文案为
  `自<droppedEffectiveSemesterLabel>起退学`
- 已建档且缺家庭或教育简历时，可在操作列提供轻量补资料入口；补资料只支持新增单条
  家庭成员或教育简历，不搬运 lab 的详情页、Excel、编辑、删除交互。家庭成员补录只提供
  父亲/母亲关系，并展示已有上游家庭成员列表
- 教育简历按列表展示；补资料抽屉展示已有上游教育简历，并在最后展示一个虚影本校项。
  本校项只展示、不提交；入学年份从学号 `studentId` 的第 2、3 位数字推断，展示为
  `<入学年份> 年 9 月 - <至今或毕业年份 6 月> 江苏省苏州技师学院`；证明人优先使用
  已选班级的 active 班主任
- 教育简历写回受后端限制，每次只提交 1 条新增经历；写回成功后保留抽屉并刷新列表，
  方便继续添加第三、第四条
- 家庭信息写回成功后保留抽屉并刷新已有家庭成员列表，方便继续补另一位家长
- 选中班级后的班级上下文直接消费 `studentPrivateProfileClassOptions` 返回值，包括 active
  班主任、专业/学制、班级年份区间和班级在校状态；前端不再额外发起班级上下文查询
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
- `studentPrivateProfileSummary`：仅用于读取补资料所需 section baseline
- `writeStudentPrivateProfileFamilyToUpstream`
- `writeStudentPrivateProfileEducationToUpstream`

`studentPrivateProfileClassOverview.students[]` 退学裁定展示字段：

- `rosterScopeSource`
- `droppedDecisionReasonCode`
- `droppedEffectiveSemesterId`
- `droppedEffectiveSemesterLabel`

`studentPrivateProfileClassOptions` 班级上下文字段：

- `classAdvisers { staffId staffName isTemporary }`
- `majorId`
- `majorName`
- `trainingYears`
- `classEnrollmentYear`
- `classExpectedGraduationYear`
- `classInSchool`
- `classSchoolYearRangeLabel`
