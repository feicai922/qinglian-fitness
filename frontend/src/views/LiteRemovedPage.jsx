import { Navigate } from 'react-router-dom'

// 完整版专用路由在 Lite 构建中会替换成这个极小组件。即使旧书签命中了对应地址，
// 也只回到首页，不会把聊天、扫码、身体图示等整块功能带进精简包。
export default function LiteRemovedPage() {
  return <Navigate to="/home" replace />
}
