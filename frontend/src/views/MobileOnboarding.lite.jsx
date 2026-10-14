// 精简模式 / Lite mode 的手机配对页替身（vite.config.js 在 --mode lite 下把
// views/MobileOnboarding.jsx 指到这里）。
//
// 完整版的配对页只在手机 App 首次启动时出现（needsMobileOnboarding），用来选择“只存本机”还是
// “连接自建服务器”。精简版是本机单人版本，不做服务器配对：web 构建里 MOBILE 为 false，这一页
// 永远不渲染，替身只保留 App.jsx 要用的默认导出。
export default function MobileOnboarding() {
  return null
}
