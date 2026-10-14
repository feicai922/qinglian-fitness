// 精简模式 / Lite mode 的同步横幅替身（vite.config.js 在 --mode lite 下把
// components/SyncBanner.jsx 指到这里）。
//
// 完整版在页面顶部挂一条连接状态栏，并由此静态牵连 components/ServerSync.jsx、lib/remote.js
// 与整套账号/同步状态。精简版是本机单人、只存本地的版本：没有服务器，也就没有要报告的状态，
// 因此这里不给任何界面，只保留调用方要用的几个名字，签名与完整版一致。

// 完整版里由连接状态推出的“有没有问题”；精简版永远没有。
export const useConnectionTrouble = () => false

// “显示连接状态”“保留本机提示条”两个开关：精简版不渲染这条，值本身不影响任何东西。
export const showsConnection = () => false
export const showsLocalLine = () => false

// 完整版里等未同步超过宽限期才提示的时长，测试会引用；精简版保留常量以免深链导入报错。
export const PENDING_GRACE_MS = 5000

export default function SyncBanner() {
  return null
}
