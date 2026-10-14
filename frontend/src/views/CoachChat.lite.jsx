// 精简版的 AI 教练聊天页（vite.config.js 在 --mode lite 下把 views/CoachChat.jsx 指到这里）。
//
// 与完整版最大的不同：没有服务端、没有提案卡片、没有计划导入。这里只有一段本机对话——
// 用户问，模型答，按需把训练数据摘要作为系统消息一起发出去。历史只存在这个组件的 state 里，
// 不进 S、不上传、关掉页面就没了；密钥与 base URL 来自设置页（lib/coach-openai.lite.js）。
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { askCoach, buildTrainingContext, coachSystemPrompt } from '../lib/coach-openai.lite.js'
import Icon from '../components/Icon.jsx'
import '../coach.css'

// 打开就能点的问题，省得空屏发呆；点一下等于把这句话打出来发送。
const QUICK = [
  '帮我看一下我现在的训练计划，哪里可以改进？',
  '根据我的计划，今天该练什么？',
  '我最近两周的训练有什么进步或问题？',
  '哪些动作的重量可以再往上加了？',
]

export default function CoachChat() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const cfg = useStore(s => s.coachCfg)
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [withData, setWithData] = useState(true)
  const endRef = useRef(null)

  const configured = !!cfg?.base && !!cfg?.model
  // 没配置就回设置页：在空表单上问问题只会拿到一个连接错误。
  useEffect(() => {
    if (!configured) nav('/settings/coach', { replace: true })
  }, [configured, nav])

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }) }, [msgs, busy])

  const send = async raw => {
    const q = String(raw ?? text).trim()
    if (!q || busy || !configured) return
    setText('')
    const thread = [...msgs, { role: 'user', text: q }]
    setMsgs(thread)
    setBusy(true)
    const messages = [
      { role: 'system', content: coachSystemPrompt() },
      ...(withData ? [{ role: 'system', content: buildTrainingContext(S) }] : []),
      ...thread.map(m => ({ role: m.role, content: m.text })),
    ]
    const r = await askCoach({ base: cfg.base, model: cfg.model, provider: cfg.preset, messages })
    setBusy(false)
    setMsgs(cur => [...cur, r.ok
      ? { role: 'assistant', text: r.text }
      : { role: 'assistant', text: r.error, err: true }])
  }

  const onKeyDown = e => {
    if (e.key !== 'Enter' || e.shiftKey) return
    e.preventDefault()
    send()
  }

  if (!configured) return null

  return (
    <div className="chat">
      <div className="chat-hdr">
        <button className="sp-back" onClick={() => nav('/settings/coach')} aria-label={t('Settings')}><Icon name="chevronLeft" /></button>
        <span className="chat-av"><Icon name="sparkles" /></span>
        <span className="grow">
          <h1>AI 教练</h1>
          <span className="chat-st">{cfg.model}</span>
        </span>
        {msgs.length > 0 && (
          <button className="sp-back" onClick={() => setMsgs([])} aria-label={t('新对话')}><Icon name="plus" /></button>
        )}
      </div>

      <div className="msgs">
        {msgs.length === 0 && (
          <>
            <div className="chat-empty">
              {withData
                ? t('先设定目标，或直接问我。每次提问会把最近的训练数据摘要一起发出去。')
                : t('先设定目标，或直接问我。当前不发送训练数据，只发你打的字。')}
            </div>
            <div className="chips-row" style={{ margin: '4px 0 0', flexWrap: 'wrap' }}>
              {QUICK.map(q => <button key={q} className="qchip" onClick={() => send(q)}>{q}</button>)}
            </div>
          </>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={'msg ' + (m.role === 'user' ? 'user' : 'coach')}>
            <div className={'bub' + (m.err ? ' err' : '')}>{m.text}</div>
          </div>
        ))}
        {busy && (
          <div className="msg coach">
            <div className="bub typing"><i /><i /><i /></div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="composer">
        <div className="chips-row">
          <button className={'qchip' + (withData ? ' on' : '')} onClick={() => setWithData(v => !v)}>
            <Icon name={withData ? 'check' : 'plus'} />
            {withData ? t('带上训练数据') : t('不发送训练数据')}
          </button>
        </div>
        <div className="composer-in">
          <textarea rows={1} value={text} placeholder={t('问教练…')} enterKeyHint="send"
            onChange={e => setText(e.target.value)} onKeyDown={onKeyDown} />
          <button className="send" disabled={busy || !text.trim()} onClick={() => send()} aria-label={t('发送')}>
            <Icon name="arrowUp" />
          </button>
        </div>
        <div className="composer-cap">{t('AI 的回答仅供参考，涉及伤痛请咨询医生。')}</div>
      </div>
    </div>
  )
}
