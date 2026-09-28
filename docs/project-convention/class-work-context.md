<!-- docs/project-convention/class-work-context.md -->

# 班务工作班级

- 班务管理菜单提供工作班级选择，覆盖学生建档、操行对齐、成绩汇总、评语治理和学籍卡 Lab。
- 选择源是 `studentPrivateProfileClassOptions`；本地建班继续使用其独立的班级代码与核对流程。
- 仅菜单选择改变工作班级，按账号保存在当前浏览器。无保存值时单班自动选择、多班明确选择；网络错误不删除保存值。
- 页面临时切班不改变工作班级。显式链接范围优先于工作班级；无工作班级时保留页面已有默认规则。
- 菜单切班通过路由导航触发页面切换，只有导航获准后才保存工作班级；未保存内容或进行中的写操作由页面拦截。其他标签页不会强制切换当前工作内容。
- `classId`、`semesterId`、`studentId`、`commentKind` 是治理导航范围。页面仍通过自身 API 校验权限，不能用菜单班级列表代替授权。
- 学籍卡缺项链接携带原学生检查地址，目标页提供返回检查入口。返回后重新预检，不复用过期检查结果。
- 全局 provider/API/storage/URL adapter 归 `features/class-work-context`；共享状态契约和展示归 `entities/class-work-context`；app 挂载 provider 并向侧栏注入控件。
- 前端自动测试使用 GraphQL mock 验证交互和请求范围，不代表后端持久化或上游真实联调。
