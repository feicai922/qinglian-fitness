// 精简模式 / Lite mode 的登录页替身（vite.config.js 在 --mode lite 下把 views/Login.jsx 指到这里）。
//
// 精简版没有账号：store/useStore.js 里 isGuest() 在 LITE 下恒为 true，所以 App.jsx 永远不会
// 渲染这一页。完整版登录页会静态牵连密码注册、通行密钥、邀请码与 /api/config；这里只保留一个
// 兜底入口，万一状态异常也不至于白屏。
import { useStore } from '../store/useStore.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

export default function Login() {
  const setGuest = useStore(s => s.setGuest)
  return <div className="narrow" style={{ paddingTop: '30vh', textAlign: 'center' }}>
    <Icon name="dumbbell" style={{ fontSize: 40, color: 'var(--label-3)' }} />
    <h1 style={{ marginTop: 16 }}>openGym</h1>
    <p className="muted">所有数据只保存在本机。</p>
    <Button variant="primary" onClick={() => setGuest(true)}>开始使用</Button>
  </div>
}
