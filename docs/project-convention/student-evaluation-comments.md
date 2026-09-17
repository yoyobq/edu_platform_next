<!-- docs/project-convention/student-evaluation-comments.md -->

# 班级评语治理

正式入口为 `/class-affairs/student-evaluation-comments`，位于班务导航。管理员、具有班主任或辅导员岗位的职工可进入；普通职工和学生不能进入。路由与菜单共用 `hasStudentEvaluationCommentAccess`，最终班级范围与可执行动作由后端 workspace 授权。

本次按用户明确的 stable 升级指令迁移两个学生评语 lab，移除实验入口与暴露控制。学生本人评语接口保留，后续由独立的学生侧页面承接。

页面只组合页头与 feature。`features/student-evaluation-comment` 统一拥有人工编辑、学期和毕业 AI 草稿、Excel 材料预填与依据刷新流程；application 承担流程与范围竞态处理，infrastructure 承担 GraphQL、REST 和 URL 适配，ui 承担展示、确认和离页提示。

保留正式评语和草稿 CAS、AI 必须显式确认、Excel 预填后显式保存、范围切换与离页未保存提示、后台生成状态轮询及过期请求隔离。Excel dry-run 返回的名单和 revision 会在预填前与当前 workspace 快照比对，名单或正式评语变化时要求重新导入。AI 不可用时仍可人工填写。接口真相见后端 `docs/api/student-evaluation-comment-current.md`。
