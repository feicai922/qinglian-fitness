// 精简模式 / Lite mode 的接口层替身（vite.config.js 在 --mode lite 下把 lib/api.js 指到这里）。
//
// 完整版的 lib/api.js 负责同源/远端请求、WebAuthn、通行密钥、密码登录、Cloudflare Access 与
// 媒体上传；它由 store/useStore.js、store/useUI.js 和 Workout.jsx 静态引用，因此即使 LITE
// 下所有请求都被 user / MOBILE 判断挡住，整个模块仍会进入包。精简版只存本机、没有服务器：
// 这里保留同名同签名，正常查询一律拒绝，信标与远端设置是空操作。

const unavailable = () => {
  const e = new Error('精简版没有服务器')
  e.code = 'unavailable'
  e.status = null
  return e
}

export const appBase = ''
export const setRemoteAuth = () => {}
export const setAccessHeaders = () => {}

export const api = async () => { throw unavailable() }
export const beacon = () => {}
export const apiBlob = async () => { throw unavailable() }
export const apiUpload = async () => { throw unavailable() }

// 以下名字只在完整版的登录/配对界面使用；精简版不会渲染它们，留作深链导入的兜底。
export const IS_APPLE = false
export const IS_ANDROID = false
export const BIO = ''
export const VAULT = ''
export const bio = () => ''
export const vault = () => ''
export const webauthnOK = () => false
export const looksLocal = () => false
export const pairRedeem = async () => { throw unavailable() }
export const passkeyError = () => ''
export const passkeyRegister = async () => { throw unavailable() }
export const passkeyAssertion = async () => { throw unavailable() }
export const passkeyLogin = async () => { throw unavailable() }
export const createPasskey = async () => { throw unavailable() }
export const passwordLogin = async () => { throw unavailable() }
export const passwordRegister = async () => { throw unavailable() }
export const passwordResetRedeem = async () => { throw unavailable() }
