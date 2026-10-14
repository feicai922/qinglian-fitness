// Lite 不提供设备端 AI Coach。保留同形状的空实现，让本地状态迁移代码可以正常编译，
// 同时避免把安全存储和移动端 Coach 配置模块带进精简包。
const EMPTY = { mode: 'off', provider: null, model: null, baseUrl: null, handle: null, daily: null, pending: null }

export async function loadCoachDevice() {
  return EMPTY
}

export async function saveCoachDevice() {
  return EMPTY
}

export const coachDeviceSettings = () => null

export function _resetCoachDevice() {}
