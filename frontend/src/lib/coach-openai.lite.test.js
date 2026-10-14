// AI 教练接口层（精简版）：地址拼接、配置校验、列出模型、问答解析、训练数据摘要。
//
// 这里只测纯逻辑与请求形状，不发真实请求：capacitor-fetch 与安全存储都被替身接管。
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), storedKey: vi.fn() }))

vi.mock('./capacitor-fetch.js', () => ({ nativeFetch: mocks.fetch }))
vi.mock('./coach-secrets.js', () => ({ getProviderApiKey: mocks.storedKey }))
vi.mock('./i18n.js', () => ({ exerciseNameFor: ex => (ex && ex.id) || '' }))

import {
  COACH_PRESETS, coachEndpoints, validateCoachConfig, listModels, askCoach,
  buildTrainingContext, coachSystemPrompt, normalizeCoachBase,
} from './coach-openai.lite.js'

const jsonRes = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
})

const zhipuBase = COACH_PRESETS.find(p => p.id === 'zhipu').base

beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.storedKey.mockReset()
  mocks.storedKey.mockResolvedValue(null)
})

describe('coachEndpoints', () => {
  it('appends /v1 to a bare domain', () => {
    expect(coachEndpoints('https://api.openai.com')).toEqual({
      base: 'https://api.openai.com',
      modelsUrl: 'https://api.openai.com/v1/models',
      chatUrl: 'https://api.openai.com/v1/chat/completions',
    })
  })

  it('does not repeat a /v1 the user already typed (and drops trailing slashes)', () => {
    const ep = coachEndpoints('  https://api.deepseek.com/v1/  ', 'deepseek')
    expect(ep.base).toBe('https://api.deepseek.com/v1')
    expect(ep.modelsUrl).toBe('https://api.deepseek.com/v1/models')
    expect(ep.chatUrl).toBe('https://api.deepseek.com/v1/chat/completions')
  })

  it('never adds /v1 for Zhipu, whose base already carries /v4', () => {
    const ep = coachEndpoints(zhipuBase, 'zhipu')
    expect(ep.modelsUrl).toBe('https://open.bigmodel.cn/api/paas/v4/models')
    expect(ep.chatUrl).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions')
    expect(ep.chatUrl).not.toContain('/v4/v1')
    expect(coachEndpoints(zhipuBase + '/', 'zhipu').chatUrl).toBe(ep.chatUrl)
  })

  it('leaves any other versioned base alone instead of stacking a second version', () => {
    expect(coachEndpoints('https://api.example.com/v2', 'compatible').chatUrl)
      .toBe('https://api.example.com/v2/chat/completions')
  })

  it('returns null without a base', () => {
    expect(coachEndpoints('')).toBe(null)
    expect(coachEndpoints('   ')).toBe(null)
    expect(coachEndpoints(null)).toBe(null)
  })
})

describe('normalizeCoachBase', () => {
  it('trims, drops trailing slashes, and keeps an empty string empty', () => {
    expect(normalizeCoachBase('  https://a.example.com/v1// ')).toBe('https://a.example.com/v1')
    expect(normalizeCoachBase('')).toBe('')
    expect(normalizeCoachBase(undefined)).toBe('')
  })
})

describe('validateCoachConfig', () => {
  it('rejects a missing address', () => {
    expect(validateCoachConfig({ model: 'gpt-4o-mini' })).toEqual({ ok: false, error: '请填写接口地址（base URL）' })
  })

  it('rejects a non-http address', () => {
    const r = validateCoachConfig({ base: 'ftp://api.example.com', model: 'm' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('http://')
  })

  it('refuses credentials smuggled into the address', () => {
    const r = validateCoachConfig({ base: 'https://user:secret@api.example.com', model: 'm' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('API Key')
  })

  it('rejects an invalid URL', () => {
    expect(validateCoachConfig({ base: 'https://', model: 'm' }).ok).toBe(false)
  })

  it('requires a key only where one is needed', () => {
    expect(validateCoachConfig({ base: 'https://api.example.com', model: 'm', keyRequired: true }).error)
      .toBe('请填写 API Key')
    expect(validateCoachConfig({ base: 'http://127.0.0.1:11434', model: 'llama3.1', keyRequired: false }).ok)
      .toBe(true)
  })

  it('requires a model name', () => {
    expect(validateCoachConfig({ base: 'https://api.example.com', apiKey: 'k', keyRequired: true }).error)
      .toBe('请填写或选择模型名称')
  })

  it('accepts a complete config', () => {
    expect(validateCoachConfig({ base: 'https://api.example.com', model: 'm', apiKey: 'k', keyRequired: true }))
      .toEqual({ ok: true })
  })
})

describe('listModels', () => {
  it('reads the OpenAI data[].id shape', async () => {
    mocks.fetch.mockResolvedValue(jsonRes({ data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o' }, {}] }))
    expect(await listModels({ base: 'https://api.openai.com', apiKey: 'sk-test' }))
      .toEqual({ ok: true, models: ['gpt-4o-mini', 'gpt-4o'] })
  })

  it('falls back to models[].name or .id', async () => {
    mocks.fetch.mockResolvedValue(jsonRes({ models: [{ name: 'llama3.1' }, { id: 'qwen2.5' }] }))
    expect(await listModels({ base: 'http://127.0.0.1:11434' }))
      .toEqual({ ok: true, models: ['llama3.1', 'qwen2.5'] })
  })

  it('sends the key as a bearer token and hits the provider\u2019s path', async () => {
    mocks.fetch.mockResolvedValue(jsonRes({ data: [] }))
    await listModels({ base: zhipuBase, apiKey: 'zhipu-key', provider: 'zhipu' })
    const [url, init] = mocks.fetch.mock.calls[0]
    expect(url).toBe('https://open.bigmodel.cn/api/paas/v4/models')
    expect(init.headers.Authorization).toBe('Bearer zhipu-key')
  })

  it('surfaces the provider\u2019s error message', async () => {
    mocks.fetch.mockResolvedValue(jsonRes({ error: { message: 'Invalid API key' } }, 401))
    expect(await listModels({ base: 'https://api.openai.com', apiKey: 'nope' }))
      .toEqual({ ok: false, error: 'Invalid API key' })
  })

  it('reports a rate limit with the status when the body is not JSON', async () => {
    mocks.fetch.mockResolvedValue(jsonRes('slow down', 429))
    expect(await listModels({ base: 'https://api.openai.com', apiKey: 'k' }))
      .toEqual({ ok: false, error: 'slow down' })
  })

  it('asks for a base first', async () => {
    expect(await listModels({ base: '' })).toEqual({ ok: false, error: '请填写接口地址（base URL）' })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('turns a network failure into a readable error', async () => {
    mocks.fetch.mockRejectedValue(new Error('Failed to fetch'))
    expect(await listModels({ base: 'https://api.openai.com', apiKey: 'k' }))
      .toEqual({ ok: false, error: 'Failed to fetch' })
  })
})

describe('askCoach', () => {
  const messages = [{ role: 'user', content: '今天练什么？' }]

  it('reads choices[0].message.content', async () => {
    mocks.fetch.mockResolvedValue(jsonRes({ choices: [{ message: { content: '  练推日  ' } }] }))
    expect(await askCoach({ base: 'https://api.openai.com', model: 'gpt-4o-mini', apiKey: 'k', messages }))
      .toEqual({ ok: true, text: '练推日' })
  })

  it('reads the older choices[0].text shape', async () => {
    mocks.fetch.mockResolvedValue(jsonRes({ choices: [{ text: '休息一天' }] }))
    expect(await askCoach({ base: 'https://api.openai.com', model: 'm', apiKey: 'k', messages }))
      .toEqual({ ok: true, text: '休息一天' })
  })

  it('falls back to the key saved for the provider', async () => {
    mocks.storedKey.mockResolvedValue('stored-key')
    mocks.fetch.mockResolvedValue(jsonRes({ choices: [{ message: { content: 'ok' } }] }))
    await askCoach({ base: 'https://api.openai.com', model: 'm', provider: 'openai', messages })
    expect(mocks.storedKey).toHaveBeenCalledWith('openai')
    expect(mocks.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer stored-key')
  })

  it('posts to the Zhipu chat endpoint without a stray /v1', async () => {
    mocks.fetch.mockResolvedValue(jsonRes({ choices: [{ message: { content: 'ok' } }] }))
    await askCoach({ base: zhipuBase, model: 'glm-4-flash', provider: 'zhipu', apiKey: 'k', messages })
    const [url, init] = mocks.fetch.mock.calls[0]
    expect(url).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toMatchObject({ model: 'glm-4-flash', stream: false })
  })

  it('reports a provider error and an empty answer', async () => {
    mocks.fetch.mockResolvedValue(jsonRes({ error: { message: 'quota exceeded' } }, 429))
    expect(await askCoach({ base: 'https://api.openai.com', model: 'm', apiKey: 'k', messages }))
      .toEqual({ ok: false, error: 'quota exceeded' })
    mocks.fetch.mockResolvedValue(jsonRes({ choices: [{ message: {} }] }))
    expect(await askCoach({ base: 'https://api.openai.com', model: 'm', apiKey: 'k', messages }))
      .toEqual({ ok: false, error: '模型没有返回内容' })
  })

  it('names an abort instead of leaking the raw error', async () => {
    mocks.fetch.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    expect(await askCoach({ base: 'https://api.openai.com', model: 'm', apiKey: 'k', messages }))
      .toEqual({ ok: false, error: '已取消' })
  })

  it('asks for a base first', async () => {
    expect(await askCoach({ base: '', messages })).toEqual({ ok: false, error: '请先配置接口地址' })
  })
})

describe('buildTrainingContext', () => {
  const S = {
    unit: 'kg',
    weekStart: 1,
    routines: [{ name: '推日', ex: [{ id: 'bench-press', sets: 4, reps: 8, weight: 60 }] }],
    workouts: [{
      d: '2026-10-01', name: '推日', bw: 70,
      entries: [{ id: 'bench-press', sets: [{ w: 60, r: 8, done: true }, { w: 62.5, r: 6, done: true }] }],
    }],
    bodyweight: [{ d: '2026-09-01', w: 72 }, { d: '2026-10-01', w: 70.5 }],
  }

  it('summarises plan, recent workouts, body weight and units', () => {
    const out = buildTrainingContext(S)
    expect(out).toContain('【训练数据摘要】')
    expect(out).toContain('推日：bench-press 4组×8次 @60kg')
    expect(out).toContain('2026-10-01 推日：bench-press（2组、最重62.5kg、次数8/6）')
    expect(out).toContain('体重：2026-09-01 72kg → 2026-10-01 70.5kg（-1.5kg）')
    expect(out).toContain('单位：重量用 公斤；每周从 周一 开始。')
    expect(out).toContain('体重70kg')
  })

  it('says so when there is nothing yet, and never throws on an empty state', () => {
    const out = buildTrainingContext({})
    expect(out).toContain('训练计划：尚未建立固定计划。')
    expect(out).toContain('最近训练：暂无记录。')
    expect(buildTrainingContext(null)).toContain('【训练数据摘要】')
  })

  it('follows the unit the user picked', () => {
    expect(buildTrainingContext({ ...S, unit: 'lb' })).toContain('单位：重量用 磅；')
  })

  it('keeps only the most recent workouts and truncates a long summary', () => {
    const many = { ...S, workouts: Array.from({ length: 20 }, (_, i) => ({
      d: `2026-09-${String(i + 1).padStart(2, '0')}`, name: 'n', entries: [],
    })) }
    expect(buildTrainingContext(many, { days: 3 })).toContain('最近 3 次训练：')
    const cut = buildTrainingContext(S, { maxChars: 40 })
    expect(cut.length).toBeLessThan(120)
    expect(cut.endsWith('（摘要已截断）')).toBe(true)
  })
})

describe('coachSystemPrompt', () => {
  it('sets the guardrails the chat page relies on', () => {
    const p = coachSystemPrompt()
    expect(p).toContain('中文力量训练教练')
    expect(p).toContain('不要编造')
  })
})
