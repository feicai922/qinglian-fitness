// 精简版的 AI 教练：自带密钥(BYOK) + OpenAI 兼容接口。
//
// 只做两件事，都直接对用户填的 base URL 发起（多数服务补 /v1，智谱的 base 自带 /v4）：
//   1. GET  {base}/models   —— 测试连接、列出模型
//   2. POST {base}/chat/completions —— 把训练数据摘要交给模型，回答用户的问题
//
// 密钥不在这个文件里，也不进 S：它由 lib/coach-secrets.js 放进系统安全存储
// (Android Keystore / iOS Keychain)，只在发请求时取出。
//
// 手机端走 CapacitorHttp（原生网络，绕过 WebView 的 CORS 与 Android 明文限制），
// 浏览器预览直接用 fetch。这与完整版的 coach-local.js 是同一套 fetch 注入思路。
import { nativeFetch } from './capacitor-fetch.js'
import { getProviderApiKey } from './coach-secrets.js'
import { exerciseNameFor } from './i18n.js'

// 主流的 OpenAI 兼容服务。多数服务的接口挂在 {base}/v1 下，请求时再拼 /v1/models，
// 所以缺省就把 base 当成「到 /v1 之前」的根地址。
//
// 智谱是例外：它的 base 本身就带了版本号（https://open.bigmodel.cn/api/paas/v4），
// 再补一层 /v1 会打到不存在的路径。apiPath 就是这条规则——'' 表示 base 已到版本号为止，
// 缺省（未写）表示拼 /v1。
export const COACH_PRESETS = [
  { id: 'openai', label: 'OpenAI', base: 'https://api.openai.com', model: 'gpt-4o-mini', hint: 'sk-…' },
  { id: 'deepseek', label: 'DeepSeek 深度求索', base: 'https://api.deepseek.com', model: 'deepseek-chat', hint: 'sk-…' },
  { id: 'dashscope', label: '阿里云百炼（通义千问）', base: 'https://dashscope.aliyuncs.com/compatible-mode', model: 'qwen-plus', hint: 'sk-…' },
  { id: 'siliconflow', label: '硅基流动 SiliconFlow', base: 'https://api.siliconflow.cn', model: 'Qwen/Qwen2.5-7B-Instruct', hint: 'sk-…' },
  { id: 'zhipu', label: '智谱 GLM', base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', hint: '你的 API Key', apiPath: '' },
  { id: 'moonshot', label: '月之暗面 Kimi', base: 'https://api.moonshot.cn', model: 'moonshot-v1-8k', hint: 'sk-…' },
  { id: 'ollama', label: '本地 Ollama（需 https 或局域网反代）', base: 'http://127.0.0.1:11434', model: 'llama3.1', hint: '可留空' },
  { id: 'compatible', label: '其它 OpenAI 兼容服务', base: '', model: '', hint: '可留空' },
]

export const COACH_PRESET_IDS = COACH_PRESETS.map(p => p.id)

/** 去掉结尾斜杠；空串保持空串。 */
export const normalizeCoachBase = base => {
  const b = typeof base === 'string' ? base.trim() : ''
  return b ? b.replace(/\/+$/, '') : ''
}

// base 已经以版本号结尾（/v1、/v2、/v4、/v1beta…）时不再重复拼接。
const VERSION_SUFFIX = /\/v\d+(?:[a-z]+\d*)?$/i

const apiPathOf = provider => {
  const p = COACH_PRESETS.find(x => x.id === provider)
  return p && 'apiPath' in p ? p.apiPath : '/v1'
}

/** base URL → {base, modelsUrl, chatUrl}。provider 决定要不要补 /v1（智谱不补）。 */
export function coachEndpoints(base, provider) {
  const root = normalizeCoachBase(base)
  if (!root) return null
  const apiPath = apiPathOf(provider)
  const prefix = !apiPath || VERSION_SUFFIX.test(root) ? root : root + apiPath
  return { base: root, modelsUrl: prefix + '/models', chatUrl: prefix + '/chat/completions' }
}

export function validateCoachConfig({ base, model, apiKey, keyRequired = false } = {}) {
  const root = normalizeCoachBase(base)
  if (!root) return { ok: false, error: '请填写接口地址（base URL）' }
  if (!/^https?:\/\//i.test(root)) return { ok: false, error: '接口地址要以 http:// 或 https:// 开头' }
  try {
    const u = new URL(root)
    if (u.username || u.password) return { ok: false, error: '密钥请填在 API Key 一栏，不要写进地址' }
  } catch { return { ok: false, error: '接口地址不是有效的 URL' } }
  if (keyRequired && !String(apiKey || '').trim()) return { ok: false, error: '请填写 API Key' }
  if (!String(model || '').trim()) return { ok: false, error: '请填写或选择模型名称' }
  return { ok: true }
}

const errText = (status, body) => {
  const t = String(body || '').trim()
  if (!t) return `HTTP ${status}`
  try {
    const j = JSON.parse(t)
    return j.error?.message || j.message || j.error || (`HTTP ${status}`)
  } catch { return t.slice(0, 300) }
}

const request = (url, { method = 'GET', apiKey, body, signal } = {}) => nativeFetch(url, {
  method,
  headers: {
    ...(apiKey ? { Authorization: 'Bearer ' + apiKey } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  },
  ...(body ? { body: JSON.stringify(body) } : {}),
  ...(signal ? { signal } : {}),
})

/** 测试连接并列出模型。base 与 key 用参数传入（设置页可能还没保存）。 */
export async function listModels({ base, apiKey, provider } = {}) {
  const ep = coachEndpoints(base, provider)
  if (!ep) return { ok: false, error: '请填写接口地址（base URL）' }
  try {
    const res = await request(ep.modelsUrl, { apiKey })
    const text = await res.text()
    if (!res.ok) return { ok: false, error: errText(res.status, text) }
    const json = JSON.parse(text)
    const list = Array.isArray(json?.data) ? json.data.map(m => m?.id).filter(Boolean)
      : Array.isArray(json?.models) ? json.models.map(m => m?.name || m?.id).filter(Boolean)
        : []
    return { ok: true, models: list }
  } catch (e) {
    return { ok: false, error: e?.message || '连接失败' }
  }
}

const fmtDate = iso => typeof iso === 'string' ? iso : ''
const round1 = n => Math.round(Number(n || 0) * 10) / 10

/**
 * 把用户自己的训练数据压成一段中文摘要，随问题一起发给模型。
 *
 * 只读，且只读 S 里训练日志相关的那几项：计划、最近 14 天训练、体重、常用重量。
 * 上限 8000 字，超出就截断，避免一次请求把整份日志推上去。
 */
export function buildTrainingContext(S, { days = 14, maxChars = 8000 } = {}) {
  const L = []
  const nameOf = ex => {
    try { return exerciseNameFor({ id: ex }) || ex } catch { return ex }
  }

  L.push('【训练数据摘要】')

  const routines = Array.isArray(S?.routines) ? S.routines : []
  if (routines.length) {
    L.push('训练计划：')
    for (const r of routines) {
      const ex = Array.isArray(r?.ex) ? r.ex : []
      const items = ex.slice(0, 20).map(e => {
        const w = Number(e?.weight) || Number(S?.exWeights?.[e?.id]?.w) || 0
        return `${nameOf(e?.id)} ${e?.sets ?? '?'}组×${e?.reps ?? '?'}次${w ? ` @${round1(w)}kg` : ''}`
      })
      L.push(`- ${r?.name || '未命名'}：${items.join('；') || '（空）'}`)
    }
  } else {
    L.push('训练计划：尚未建立固定计划。')
  }

  const workouts = (Array.isArray(S?.workouts) ? S.workouts : [])
    .filter(w => w && typeof w.d === 'string')
    .sort((a, b) => String(a.d).localeCompare(String(b.d)))
    .slice(-Math.max(1, days))
  if (workouts.length) {
    L.push(`最近 ${workouts.length} 次训练：`)
    for (const w of workouts) {
      const parts = (Array.isArray(w?.entries) ? w.entries : []).map(e => {
        const sets = (Array.isArray(e?.sets) ? e.sets : []).filter(s => s && (s.done !== false))
        const top = sets.reduce((m, s) => Math.max(m, Number(s?.w) || 0), 0)
        const reps = sets.map(s => s?.r).filter(r => r != null)
        const rpe = sets.map(s => s?.rpe).filter(v => v != null)
        const rir = sets.map(s => s?.rir).filter(v => v != null)
        const bits = [`${sets.length}组`]
        if (top) bits.push(`最重${round1(top)}kg`)
        if (reps.length) bits.push(`次数${reps.join('/')}`)
        if (rpe.length) bits.push(`RPE${rpe.join('/')}`)
        if (rir.length) bits.push(`RIR${rir.join('/')}`)
        return `${nameOf(e?.id)}（${bits.join('、')}）`
      })
      L.push(`- ${fmtDate(w.d)} ${w.name || ''}：${parts.join('；') || '无记录'}${w.bw ? `｜体重${round1(w.bw)}kg` : ''}`)
    }
  } else {
    L.push('最近训练：暂无记录。')
  }

  const bw = (Array.isArray(S?.bodyweight) ? S.bodyweight : [])
    .filter(x => x && x.w != null).sort((a, b) => String(a.d).localeCompare(String(b.d)))
  if (bw.length) {
    const first = bw[0], last = bw[bw.length - 1]
    const delta = round1(Number(last.w) - Number(first.w))
    L.push(`体重：${fmtDate(first.d)} ${round1(first.w)}kg → ${fmtDate(last.d)} ${round1(last.w)}kg（${delta >= 0 ? '+' : ''}${delta}kg）`)
  }

  L.push(`单位：重量用 ${S?.unit === 'lb' ? '磅' : '公斤'}；每周从 ${Number(S?.weekStart) === 0 ? '周日' : '周一'} 开始。`)

  const out = L.join('\n')
  return out.length > maxChars ? out.slice(0, maxChars) + '\n（摘要已截断）' : out
}

export function coachSystemPrompt() {
  return [
    '你是这位用户的中文力量训练教练。',
    '只依据下面的训练数据说话，不要编造没记录过的重量、动作或身体数据。',
    '回答要短、具体、可执行：先给结论，再给 1-3 条理由或做法。',
    '涉及疼痛或伤病时，提醒就医，不要代替医生诊断。',
    '不要输出 JSON，也不要复述整段数据摘要。',
  ].join('\n')
}

/**
 * 一次问答。messages 是完整的对话历史（含本轮用户消息），便于多轮追问。
 * 返回 { ok, text } 或 { ok: false, error }。
 */
export async function askCoach({ base, model, provider, apiKey, messages, signal } = {}) {
  const ep = coachEndpoints(base, provider)
  if (!ep) return { ok: false, error: '请先配置接口地址' }
  const key = apiKey || (await getProviderApiKey(provider))
  try {
    const res = await request(ep.chatUrl, {
      method: 'POST',
      apiKey: key,
      signal,
      body: { model, messages, temperature: 0.3, stream: false },
    })
    const text = await res.text()
    if (!res.ok) return { ok: false, error: errText(res.status, text) }
    const json = JSON.parse(text)
    const answer = json?.choices?.[0]?.message?.content
      ?? json?.choices?.[0]?.text
      ?? json?.message?.content
    if (!answer) return { ok: false, error: '模型没有返回内容' }
    return { ok: true, text: String(answer).trim() }
  } catch (e) {
    if (e?.name === 'AbortError') return { ok: false, error: '已取消' }
    return { ok: false, error: e?.message || '请求失败' }
  }
}
