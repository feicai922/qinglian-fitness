# 轻练

**中文优先的健身训练记录应用，基于 [DuarteSantos8/openGym](https://github.com/DuarteSantos8/openGym) 精简改造。**

轻练保留了 openGym 最实用的部分：循环训练计划、动作与重量记录、组间休息计时、统计热力图、AI 教练。同时移除了用不到的功能，并把动作素材改为按需在线加载，而不是全部塞进安装包。

## 与上游的关系

- 上游项目：[DuarteSantos8/openGym](https://github.com/DuarteSantos8/openGym)
- 本项目是非商业精简分支，只做删减、中文化和小幅适配，不改变上游的核心数据模型
- 上游版权归 Duarte Santos 所有，本项目继续以 **AGPL-3.0** 开源，详见 [LICENSE](LICENSE) 和 [NOTICE.md](NOTICE.md)

### 主要精简内容

- 移除健身房签到、扫码识别及条码扫描依赖
- 移除多用户、账号、社交、订阅等在线功能
- 动作库只保留热门动作和训练计划相关动作，不再内置全量素材
- 动作动画改为打开详情时按需请求，不在启动时批量下载
- 界面默认中文，动作名称同时保留英文原名
- Android 应用名、包名、版本号和图标已与原版区分

## 主要功能

| 模块 | 说明 |
| --- | --- |
| 训练计划 | 按循环轮次安排训练，不绑定具体星期；可设置每个训练日练什么 |
| 动作记录 | 记录动作、重量、组数、次数和完成情况 |
| 训练计时 | 组间休息倒计时、通知提醒 |
| 统计 | 训练热力图、容量统计等，全部由本地记录生成，不需要扫码 |
| 动作库 | 热门动作 + 训练计划相关动作，中文名称优先，保留英文名 |
| 动作素材 | 静态图可随包，动画在线按需加载，支持自定义图源 |
| AI 教练 | 通过 Base URL + API Key 接入 OpenAI 兼容接口 |
| 数据导出 | 训练记录可导出为 JSON，便于备份和迁移 |

## Android 三种安装包

仓库提供三种媒体策略，互不覆盖：

| 变体 | 说明 | 适用场景 |
| --- | --- | --- |
| `remote` | 静态图随包，动画在线加载 | 推荐；安装包小，动画需要联网 |
| `local` | 只打包热门动作和训练计划相关动作的 180px 素材 | 常用动作可离线查看 |
| `full` | 打包全量素材，不压缩、不省略 | 完全离线，安装包最大 |

## 构建 APK

需要 JDK 21 和 Android SDK 35。默认路径在脚本顶部，可按本机环境修改。

```powershell
pwsh -File scripts/build-lite-apk.ps1 -Variant remote
pwsh -File scripts/build-lite-apk.ps1 -Variant local
pwsh -File scripts/build-lite-apk.ps1 -Variant full
```

产物输出到 `outputs/`，文件名格式为 `qinglian-lite-<变体>-v<版本号>-debug.apk`。

## iOS：源码构建

仓库不提供现成的 `.ipa`。原生 iOS 包必须在 Mac 上用 Xcode 从源码构建，需要 Xcode 15+、CocoaPods 和 Node.js 20+：

```bash
cd frontend
npm install
npm run build:mobile
npx cap open ios
```

Xcode 打开后，在 `Signing & Capabilities` 中选择自己的 Team，连接 iPhone 或 iPad 后直接运行。免费 Apple ID 签名的应用 7 天后过期，需要重新从 Xcode 安装。

## 在线动作素材

动作动画不会在应用启动时一次性下载。打开动作详情时才发起请求，避免浪费流量和拖慢启动。

默认使用公开镜像：

- 静态图与动画：`DuarteSantos8/openGym` 的 `catalogue/media`
- GIF 镜像：`hasaneyldrm/exercises-dataset`

也可以在应用内手动设置图源地址。若自建媒体服务，把地址填到对应设置项即可，前端不绑定特定服务器。

> 公开分发前请先确认素材授权。动作视频的版权归原作者所有，能否二次分发以原始数据集的许可声明为准。

## AI 教练

AI 教练不是内置模型，也不会把数据发到第三方。它是一个 OpenAI 兼容接口入口，由你自己填写：

- Base URL
- API Key
- 模型名称

和普通豆包聊天应用的区别：AI 教练运行在轻练内部，可以把你的训练计划、动作和记录一起带入对话，回答更贴近你的训练上下文；普通豆包默认不知道这些数据。

API Key 只保存在本机，不会写入仓库或提交到版本控制。

## 本地数据

- 训练记录保存在本机
- 支持导出 JSON 备份
- 不依赖账号系统，也不需要登录

## 本地开发

```powershell
cd frontend
npm install
npm run dev:lite
```

构建网页版：

```powershell
cd frontend
npm run build:lite
```

运行测试：

```powershell
cd frontend
npm test
```

## 目录结构

```text
frontend/            Web 前端与 Capacitor Android 工程
  src/               页面、组件与业务逻辑
  android/           Android 原生工程
  ios/               iOS 原生工程
  resources/         应用图标源文件
catalogue/           动作数据与说明
scripts/             构建、素材与打包脚本
outputs/             构建产物
```

## 版本

- 当前版本：`0.1.0`
- Android / iOS 包名：`app.qinglian.fitness`
- 调试包名：`app.qinglian.fitness.test`

## 许可与声明

本项目代码以 **GNU AGPL v3.0** 发布。你可以自行部署、修改和分发，但分发修改版时需要继续以 AGPL 开源，并保留上游署名。

动作媒体（图片与视频）的版权与许可独立于代码，详见 [NOTICE.md](NOTICE.md)。Gym visual 素材仅授权用于 openGym 应用内，二次分发或商用前需要自行取得授权。

上游项目与版权：

> openGym, Copyright (C) 2026 Duarte Santos.
> <https://github.com/DuarteSantos8/openGym>
