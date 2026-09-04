<!-- docs/project-convention/academic-split-joint-teaching.md -->

# 拆分合班确认

## 正式入口

- 路径：`/academic-affairs/split-joint-teaching-confirmation`
- 导航分组：教务管理
- 准入：`ADMIN` 或持有 `ACADEMIC_OFFICER` slot 的 staff
- 页面与后端 mutation 使用同一准入口径；不能只隐藏菜单而放开直达路由

## 页面职责

- 候选、共同周、例外周、原始/语义课时全部由后端实时推导，前端不复制识别或系数公式
- 开关只提交 `semesterId + staffId + sstsCourseId + confirmed`
- 开启或关闭前必须显式说明影响，并在写入成功后重新获取候选
- 已失效的历史确认仍显示并允许关闭；非有效候选或冲突候选不能开启

## 消费口径

- 确认后，每周课表、学期课表、工作量明细、工作量预报、节假日扣课和外聘兼课金消费教师 delivery 接口
- 教学日志、授课计划与课程计划首页继续消费校园网原始 schedule / occurrence 口径
- 未确认课程保持原始口径；页面不得提供第二个全局模式开关，也不得在客户端猜测是否应合并
