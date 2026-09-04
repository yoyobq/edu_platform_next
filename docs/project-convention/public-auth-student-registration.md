<!-- docs/project-convention/public-auth-student-registration.md -->

# Public Auth Student Registration

本文件描述学生注册链接注册链路的前端稳定约定。后端 contract、schema 与 resolver 真相以 `docs/backend/README.md` 指向的后端来源为准。

## 入口

- 学生注册入口：`/invite/student-registration/:token`
- 初始登录邮箱验证入口：`/verify/account-email/:token`
- 旧 `/invite/student/:verificationCode` 已下线，路由按 404 处理
- `/verify/email/:verificationCode` 继续表示“登录邮箱变更确认”，不复用为新账号初始邮箱验证

## 签发

- 正式管理入口为 `/admin/verification-issuance`
- 页面从本地可用班级中选择 `classCode`，签发班级共享注册链接
- 后端 contract 仍支持 `classCode + studentId` 的指定学生链接，正式前端不暴露该能力
- 签发结果优先展示并复制后端返回的 `link`，前端不自行拼接注册 URL
- 签发结果 ID 使用后端返回的 `recordId`，不再使用旧 `campaignId`

## 注册流程

- 页面先查询 `publicStudentRegistrationLinkInfo(token)`
- 只有 `success=true && info.canProceed=true` 展示注册表单
- `LINK_NOT_FOUND` 时 `info=null`，页面展示失效态
- 身份核对步骤填写 `studentId + name + idCardLastSix`
- 身份核对失败受后端分布式频率限制；达到上限时页面展示稍后重试，不继续提交
- `scope=STUDENT` 时锁定 `studentId`，提交后端返回值
- `scope=CLASS` 时由学生填写 `studentId`，学号示例从班级名推导并脱敏尾号：
  `1301 -> 3130101XX`，`13大2 -> 3130202XX`
- 从身份核对进入账号信息前，调用 `verifyStudentRegistrationIdentity`
- `verifyStudentRegistrationIdentity` 只做只读校验，不创建账号、不绑定学生档案、不签发邮箱验证
- 身份预校验失败统一展示“身份信息不匹配，请核对后重试。”
- 从账号信息进入登录邮箱前，调用 `verifyStudentRegistrationAccount`
- `verifyStudentRegistrationAccount` 只做只读校验，不创建账号、不绑定学生档案、不签发邮箱验证
- 登录密码的页面校验与后端当前密码策略保持一致，包括长度、字符类型、首尾空格、常见弱密码片段和连续重复字符
- 预校验或最终提交返回链接级 reason（`LINK_NOT_FOUND` / `LINK_EXPIRED` / `LINK_REVOKED` /
  `LINK_NOT_ACTIVE` / `CLASS_NOT_FOUND`）时，重新读取 `publicStudentRegistrationLinkInfo`
  并进入整页失效态
- `LOGIN_NAME_TAKEN` 统一展示“这个登录名已被使用，请换一个。”
- 账号预校验不校验 `loginEmail`；登录邮箱仍由最终注册提交校验
- `loginEmail` 是 `account.loginEmail`，不是学生资料邮箱

提交 `consumeStudentRegistrationLink` 成功后：

- 表示账号、`base_user_info`、既有 `member_student.account_id` 绑定与登录邮箱验证记录已落库；
  `scope=STUDENT` 的注册链接已在同一事务内标记为 `CONSUMED`，`scope=CLASS`
  的注册链接继续可复用
- 账号状态为 `PENDING`，前端不创建登录态、不自动登录
- `emailVerificationRequired=true && emailVerificationSent=true` 时提示查收验证邮件
- `emailVerificationRequired=true && emailVerificationSent=false` 时提示注册已完成但初始邮件未发送，并提供重发入口
- `emailVerificationRequired=false` 时不展示邮箱验证或重发提示，直接引导前往登录

## 登录邮箱验证

- `/verify/account-email/:token` 打开后直接调用 `verifyLoginEmail(input: { token })`
- `success=true` 展示验证成功，并提供“前往登录”
- 去登录时使用 router `location.state` 预填登录名，不把邮箱放入 URL
- `success=false` 按 `reason: EXPIRED | USED | INVALID` 展示失败态

## 重发验证邮件

- `resendLoginEmailVerification(input: { loginEmail })` 是公开防枚举接口
- `success=true` 只表示请求被泛化接受
- 前端不得写“邮件已发送成功”
- 成功反馈统一使用“如果账户需要验证，请稍后查收邮箱”
- 前端不得暴露邮箱是否存在、是否已验证、是否冷却中、或本次邮件基础设施是否发送成功

## 错误边界

- 身份核验失败统一识别 `extensions.errorCode === 'STUDENT_REGISTRATION_IDENTITY_MISMATCH'`
- 页面文案统一为“身份信息不匹配，请核对后重试。”
- 未验证登录邮箱时登录失败识别 `extensions.errorCode === 'AUTH_LOGIN_EMAIL_NOT_VERIFIED'`
- 该业务码只用于登录页提交失败提示，不用于普通 session refresh/logout 分支
