// 精简模式 / Lite mode 的通行密钥（passkey）与设备配对替身（vite.config.js 在 --mode lite
// 下把 components/Passkeys.jsx 指到这里）。
//
// 完整版在这里实现 Settings → 账号里的通行密钥列表、另一台设备的一次性码，以及扫码链接的
// 兑换；它静态牵连 lib/api.js、components/PasswordAuth.jsx、QrCanvas.jsx 和整套服务端账号。
// 精简版没有账号，也就没有这些界面，只保留调用方 import 的名字。

// App.jsx 启动时若本地存着设备链接码会调它；精简版没有账号，什么也不做。
export const openDeviceLinkRedeem = () => {}

// 下面几个名字完整版的设置页会用到；精简版设置页不引入它们，留在这里只为任何深链导入安全。
export const usePasskeys = () => ({ st: null, load: () => {}, set: () => {} })
export const PasskeysRow = () => null
export const DeviceLinkRow = () => null
export const PasskeysSheet = () => null
export const DeviceLinkSheet = () => null
export const DeviceLinkRedeemSheet = () => null
export const passkeyError = () => ''
