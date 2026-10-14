// 精简模式 / Lite mode 的服务器配对替身（vite.config.js 在 --mode lite 下把 lib/remote.js 指到这里）。
//
// 完整版用这一组函数保存“连接自建服务器”的配对文件、兑换一次性码并续期令牌；store/useStore.js
// 静态引用它们，所以即使 boot() 在 LITE 下直接走本机分支，原模块仍会进入包。精简版永远只存
// 本机：配对文件读取一律回答“没有”，其余动作保持同名同签名。

// 精简版没有服务器地址可连；保留校验函数只是为了让调用方拿到 null 而不是异常。
export const normalizeServerUrl = () => null

// boot() 的 MOBILE 分支在 LITE 下不会执行，返回 null 表示“本机模式”。
export const loadRemote = async () => null
export const chooseLocal = async () => {}
export const forgetRemote = async () => {}
export const renewToken = async () => {}

// 设置页的“连接服务器”入口在精简版里不存在；真被直接调用时明确拒绝，而不是静默假装成功。
export const connect = async () => { throw new Error('精简版不支持连接服务器') }
