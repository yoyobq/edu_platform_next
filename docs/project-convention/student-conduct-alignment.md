<!-- docs/project-convention/student-conduct-alignment.md -->

# 操行对齐

## 适用范围

- 页面：`/class-affairs/student-conduct-alignment`
- 前端实现：`src/features/student-conduct-alignment/`、
  `src/pages/student-conduct-alignment/`
- 本文描述当前前端对操行对齐页面的调用约定、阻断条件和 UI 行为
- 页面访问权限与后端 workspace 一致：`ADMIN`，以及具备 `ACADEMIC_OFFICER`、
  `CLASS_ADVISER` 或 `COUNSELOR` 岗位的 `STAFF`

## 班级与学期来源

- 页面只调用 `studentConductGradeWorkspace(input: { classId?, semesterId? })`
- 班级、真实学期、默认选择、动作权限和当前 effective view 均来自同一个 workspace response
- 前端不得使用全局 `academic_semester.isVisible` 列表推学期
- 前端不得按年份自行拼装或重新排序操行学期，也不得自行推导默认班级、默认学期或按钮权限
- GraphQL 写接口只使用 workspace 返回的 `classId + semesterId`；补录材料 REST dry-run 因协议仍为
  `classCode + schoolYear + semester`，由当前 workspace selection 派生
- 补录材料 REST dry-run 被后端接受并处理时返回 HTTP `201`；前端仍按 `response.ok` 读取
  `{ data, requestId }`，认证分支按 HTTP `401`，不解析 GraphQL category

## 当前学期口径

- 当前学期和默认学期由后端生成，不由前端推断
- 前端直接消费 `termOptions[]` 的 `semesterId / sequence / label / isCurrent`
- expected 当前学期缺少本地 Semester 时，workspace 返回 warning 并选择最新可用真实学期；前端直接展示
  warning 和后端选择结果

## 生成阻断与目标学期名单

- 前端只认 workspace `status` 与 `actions[]`
- `status = CLASS_CONFIG_MISSING` 时：
  页面阻断操行列表、同步、清理和后续批量动作
- `disabled major` 不再是前端阻断条件
- 只要后端能返回 `termOptions[]`，前端就按可对齐学期处理；具体操作仍以对应 action 为准

- 学生名单只使用 `studentConductGradeWorkspace.view.students`
- 前端不再读取 `studentPrivateProfileClassOverview` 计算或阻断操行名单
- `mainSnapshotPresent = false` 只表示目标学期正式名单中的该学生缺少主快照；页面提示可前往
  `/class-affairs/student-profile-filing` 初始化，但不因其他学期或当前建档范围学生缺快照而阻断
  当前学期读取
- `rosterEligibilitySummary` 用于展示后端名单诊断；`excludedNotCheckedInCount` 表示因确认未报到
  而不进入目标学期正式名单的人数

## 页面调用顺序

1. 初次读取 `studentConductGradeWorkspace({})`
2. 直接渲染后端返回的 class/term selection、actions 与 view
3. 切换班级时重查 `studentConductGradeWorkspace({ classId })`
4. 切换学期时重查 `studentConductGradeWorkspace({ classId, semesterId })`
5. mutation 成功后用同一 `classId + semesterId` 重查 workspace

说明：

- “本地读取”是本地重读当前选择，不等价于校园网同步
- 校园网同步通过单独的“校园网同步”入口触发

## 同步、补录与清理

- 校园网操行同步已接入公开前端入口
- 前端通过 upstream 会话登录后，可执行两种动作：
  `同步所选学期`
  `同步该班全部学期`
- 同步完成后前端重新读取当前仍选中的班级和学期
- 指定学期同步只由后端校验该学期正式名单及其主快照；前端不使用其他学期或 Private Profile
  建档范围提前阻断
- `DETAIL_STUDENT_NOT_IN_CLASS` 表示学生不在该批次对应学期的正式名单，不解释为简单的
  “不在当前班级”
- 若用户在同步进行中切换班级或学期，旧请求结果不会覆盖当前选择

- 操行 inputbox 小范围本地补录已接入公开前端入口
- 前端只开放 `score` 和 `confirmedGrade`，不开放 `estimatedGrade`
- `confirmedGrade` 固定提交中文枚举：`优 / 良 / 中 / 差`
- 前端只提交有 set 或 clear 操作的学生，不提交全班
- 补录调用：
  `patchStudentConductGradeCorrections(classId, semesterId, students[])`
- `clearFieldKeys` 只支持 `score / confirmedGrade`，且只对已有本地补正字段开放清除入口
- 补录成功后前端重新读取当前仍选中的班级和学期
- 若用户在补录进行中切换班级或学期，旧请求结果不会覆盖当前选择
- 补录材料导入只把 Word / Excel 历史文档解析为草稿预填，不直接落库
- 本地开发如需解析旧版 `.doc / .xls`，需安装本地 Office/LibreOffice 转换能力
- 真正保存仍统一调用 `patchStudentConductGradeCorrections`
- `STUDENT_NOT_IN_TERM_ROSTER` 统一提示“学生不属于目标学期正式名单”

- 清理动作仅对 `CORRECTION_CLEANUP_PENDING` 状态学生开放
- 清理调用：
  `cleanupStudentConductGradeCorrection(classId, semesterId, studentId)`
- 该接口不使用 upstream session
- 清理完成后前端只会刷新发起清理时对应的当前选择；若用户已经切换班级或学期，旧清理结果不会污染当前页面

## 当前列表展示口径

- 左侧纵向学期 tab 直接使用 workspace 的 `label / isCurrent / sequence`
- 表格列：
  `学号 / 姓名 / 分数 / 确认等级 / 数据源 / 操作`
- `推定等级` 不单列展示，仅作为 `确认等级` tooltip
- 冲突码不在主表单独成列；存在冲突时通过操作列的“查看冲突”查看
- `UPSTREAM_CONFIRMED` 不再单独显示为数据状态 tag 文案，列表口径保留“校园网”

## 前端不做的事

- 不按 `studentStatus` 或其他本地字段重算班级名单
- 不将 Private Profile 建档范围与 effective view 学生合并
- 不按全局 semester 或自然日期自行决定可对齐学期
- 不因专业停用状态自行阻断操行页面
- 不自动重复提交写回或清理动作
- 不在同步和清理完成后把旧选择的数据回写到新选择页面
