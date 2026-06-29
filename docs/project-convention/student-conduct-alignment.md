<!-- docs/project-convention/student-conduct-alignment.md -->

# 操行对齐

## 适用范围

- 页面：`/class-affairs/student-conduct-alignment`
- 前端实现：`src/features/student-conduct-alignment/`、
  `src/pages/student-conduct-alignment/`
- 本文描述当前前端对操行对齐页面的调用约定、阻断条件和 UI 行为

## 班级与学期来源

- 班级 selector 继续使用 `studentPrivateProfileClassOptions`
- 返回字段结构未变，前端无额外兼容逻辑
- 后端目前会先按权限和 `keyword` 缩小候选班级，再补建档范围统计；这属于查询路径优化，不改变前端行为

- 操行页面的学期 selector 只能使用
  `studentConductGradeClassTermOptions(input: { classCode })`
- 前端不得使用全局 `academic_semester.isVisible` 列表推学期
- 前端不得按年份自行拼装操行学期
- `studentConductGradeEffectiveView`、`refreshStudentConductGradeClassFromUpstream`、
  `cleanupStudentConductGradeCorrection`、`patchStudentConductGradeCorrections`、
  补录材料导入 dry-run 都必须使用 `terms[]` 返回的 `schoolYear + semester`

## 当前学期口径

- 当前学期由后端生成，不由前端推断
- 后端优先按本地 `academic_semester.start_date / end_date` 判断当前日期所在学期
- 该判断不受 `isVisible` 影响
- 若当前日期未命中任何本地 semester 区间，后端才按上海时区自然规则兜底：
  `9-12 月 -> 当学年第一学期`
  `1-8 月 -> 上一学年第二学期`
- 前端只消费 `studentConductGradeClassTermOptions().terms[]`，不再显示“当前”标识，也不自行纠正学期顺序

## 生成阻断与快照前置

- 前端只认 `generationStatus`
- `generationStatus = CLASS_CONFIG_MISSING` 时：
  页面阻断操行列表、同步、清理和后续批量动作
- `disabled major` 不再是前端阻断条件
- 只要后端能返回 `terms[]`，前端就按可对齐学期处理

- 若 `studentPrivateProfileClassOverview.students` 中存在 `snapshotPresent = false`
  页面不展示操行表格、状态筛选、同步入口和学生明细
- 此时仅保留班级切换 UI，并提示先到
  `/class-affairs/student-profile-filing`
  初始化本地快照

## 页面调用顺序

1. 读取 `studentPrivateProfileClassOptions`
2. 默认选择排序后的首个班级
3. 读取 `studentConductGradeClassTermOptions(classCode)`
4. 学期按时间线倒序展示
5. 默认选择倒序后的第一个学期
6. 读取 `studentPrivateProfileClassOverview(classId)`
7. 若快照完整，再读取
   `studentConductGradeEffectiveView(classCode, schoolYear, semester)`

说明：

- “本地读取”是本地重读当前选择，不等价于校园网同步
- 校园网同步通过单独的“校园网同步”入口触发

## 同步、补录与清理

- 校园网操行同步已接入公开前端入口
- 前端通过 upstream 会话登录后，可执行两种动作：
  `同步所选学期`
  `同步该班全部学期`
- 同步完成后前端重新读取当前仍选中的班级和学期
- 若用户在同步进行中切换班级或学期，旧请求结果不会覆盖当前选择

- 操行 inputbox 小范围本地补录已接入公开前端入口
- 前端只开放 `score` 和 `confirmedGrade`，不开放 `estimatedGrade`
- `confirmedGrade` 固定提交中文枚举：`优 / 良 / 中 / 差`
- 前端只提交有 set 或 clear 操作的学生，不提交全班
- 补录调用：
  `patchStudentConductGradeCorrections(classCode, schoolYear, semester, students[])`
- `clearFieldKeys` 只支持 `score / confirmedGrade`，且只对已有本地补正字段开放清除入口
- 补录成功后前端重新读取当前仍选中的班级和学期
- 若用户在补录进行中切换班级或学期，旧请求结果不会覆盖当前选择
- 补录材料导入只把 Word / Excel 历史文档解析为草稿预填，不直接落库
- 本地开发如需解析旧版 `.doc / .xls`，需安装本地 Office/LibreOffice 转换能力
- 真正保存仍统一调用 `patchStudentConductGradeCorrections`

- 清理动作仅对 `CORRECTION_CLEANUP_PENDING` 状态学生开放
- 清理调用：
  `cleanupStudentConductGradeCorrection(classCode, schoolYear, semester, studentId)`
- 该接口不使用 upstream session
- 清理完成后前端只会刷新发起清理时对应的当前选择；若用户已经切换班级或学期，旧清理结果不会污染当前页面

## 当前列表展示口径

- 左侧纵向学期 tab 参照 `class-affairs/course-results-summary`
- 学期按时间线倒序
- 不显示“当前”tag
- 显示学期序号徽标
- 表格列：
  `学号 / 姓名 / 分数 / 确认等级 / 数据源 / 操作`
- `推定等级` 不单列展示，仅作为 `确认等级` tooltip
- 冲突码不在主表单独成列；存在冲突时通过操作列的“查看冲突”查看
- `UPSTREAM_CONFIRMED` 不再单独显示为数据状态 tag 文案，列表口径保留“校园网”

## 前端不做的事

- 不按 `studentStatus` 或其他本地字段重算班级名单
- 不按全局 semester 或自然日期自行决定可对齐学期
- 不因专业停用状态自行阻断操行页面
- 不自动重复提交写回或清理动作
- 不在同步和清理完成后把旧选择的数据回写到新选择页面
