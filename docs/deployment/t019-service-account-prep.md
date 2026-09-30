# T-019-prep 微信服务号模板消息接入准备

## 目标

在公众号 / 服务号资质未最终就绪前，先把后端发送骨架、回调校验入口、环境变量模板和验收路径准备好；真实模板 ID、关注用户 openid、公众号后台配置由用户后续补齐。

## 本次已准备

- 统一通知 helper：业务路由不再只写库 + 打日志，而是统一走可投递的通知底座
- `Notification` 表增加投递状态字段：
  - `deliveryStatus`
  - `deliveryError`
  - `externalMessageId`
  - `deliveredAt`
- 微信服务号配置状态接口：
  - `GET /api/notification/wechat/config-status`
- 微信服务号 URL 校验 / 事件回调骨架：
  - `GET /api/notification/wechat/callback`
  - `POST /api/notification/wechat/callback`
- 模板消息发送底座：
  - 已支持稳定 access token 获取
  - 已支持模板消息发送
  - 缺配置 / 缺模板 / 缺 openid 时自动降级为落库，不会把业务通知打崩

## 需要你后续补齐的真实信息

- `WX_SERVICE_APPID`
- `WX_SERVICE_SECRET`
- `WX_SERVICE_TOKEN`
- `WX_SERVICE_AES_KEY`
- 服务号后台回调 URL
- 真实模板 ID
- 用户在服务号侧的 `openid`

## 当前后端约定

### 1) 配置状态

```text
GET /api/notification/wechat/config-status
```

用于快速判断：

- 是否已配置服务号 appid / secret
- 是否已配置 URL 校验 token
- 是否已具备模板消息发送条件

### 2) URL 校验

```text
GET /api/notification/wechat/callback
```

服务号后台填写 URL 后，微信会带 `signature/timestamp/nonce/echostr` 打这个接口。

### 3) 事件回调

```text
POST /api/notification/wechat/callback
```

当前版本先做签名校验 + 原始 XML 日志落地（控制台），并返回 `success`，后面如果要做关注事件、openid 建联，再在这个入口继续补。

## 当前业务通知已接入统一底座

- 作业批改
- 晋级通过 / 失败
- PK 积分变动
- PK 对战结果
- 赛季获奖
- 领奖确认
- 手工 `POST /api/notification/send`

## 真资质到位后的最短落地步骤

1. 在服务号后台创建模板并拿到模板 ID
2. 在服务器进程环境里写入 `WX_SERVICE_*`
3. 把服务号后台 URL 指到：
   - `https://你的域名/api/notification/wechat/callback`
4. 先调：
   - `GET /api/notification/wechat/config-status`
5. 再用一个已关注服务号、且知道 openid 的测试用户调用：
   - `POST /api/notification/send`
6. 检查该条通知的：
   - `deliveryStatus=sent`
   - `externalMessageId` 非空

## 当前限制

- 现有 `User.openid` 是小程序 openid，不保证可直接用于服务号模板消息
- 未做服务号粉丝 openid 绑定表；当前如需真发，建议在 `payload.wechatOpenId` 或 `payload.wechatTemplate.touser` 显式传入
- 模板字段名称因模板而异；当前底座已支持传完整模板 payload，但模板 ID / data 字段名仍需按真实模板填写
