// 精简模式 / Lite mode 的推送替身（vite.config.js 在 --mode lite 下把 lib/push.js 指到这里）。
//
// 完整版的推送订阅必须登录服务器才能用：订阅记录在账号下、由服务端按设备投递。精简版没有账号、
// 没有服务端，也就没有推送要订阅；原来的 lib/push.js 还会静态牵连 lib/api.js 与账户逻辑。
// 这里只保留调用方（App.jsx、store/useUI.js）用到的名字，签名与完整版一致。

const DEVICE_KEY = 'gym_device'

// 完整版用这个本地令牌区分同一账号下的多台设备。精简版不发推送，但 useUI 仍会引用它，
// 保留同样的生成规则以免任何落盘数据在两种构建之间互相冲突。
export function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id = (crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')).replace(/-/g, '')
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch { return undefined }
}

// 精简版不注册推送：能力查询一律回答“没有”，其余动作都是空实现。
export const pushSupported = () => false
export const pushPermission = () => 'unsupported'
export const enablePush = async () => {}
export const disablePush = async () => {}
export const sendTestPush = async () => {}
export const syncPushSubscription = async () => {}
