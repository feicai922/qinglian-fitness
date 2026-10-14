// AI 教练设置页（精简版）：Base URL + API Key 的接入方式。
//
// 断言的重点是「密钥进安全存储、不进 S / 不进备份」这条线，以及服务商切换、测试连接与清除密钥。
// @vitest-environment happy-dom
import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings.lite.jsx'
import { COACH_PRESETS, coachEndpoints } from '../lib/coach-openai.lite.js'
import { bindUI } from '../components/ui.jsx'
import { useUI } from '../store/useUI.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  state: { S: null, cfg: null, saved: [] },
  listModels: vi.fn(),
  getKey: vi.fn(async () => null),
  setKey: vi.fn(async () => {}),
  clearKey: vi.fn(async () => {}),
  openSheet: null,
}))

const zhipu = COACH_PRESETS.find(p => p.id === 'zhipu')

vi.mock('../lib/coach-openai.lite.js', async importOriginal => ({
  ...(await importOriginal()),
  listModels: mocks.listModels,
}))

vi.mock('../lib/coach-secrets.js', () => ({
  getProviderApiKey: mocks.getKey,
  setProviderApiKey: mocks.setKey,
  clearProviderApiKey: mocks.clearKey,
  getApiKey: vi.fn(async () => null), setApiKey: vi.fn(async () => {}), clearApiKey: vi.fn(async () => {}),
}))

vi.mock('../store/useStore.js', () => {
  const snapshot = () => ({
    S: mocks.state.S,
    coachCfg: mocks.state.cfg,
    setCoachCfg: next => { mocks.state.cfg = { ...(mocks.state.cfg || {}), ...next }; mocks.state.saved.push(next) },
    user: null,
    setUser: vi.fn(), replaceState: vi.fn(),
    update: mut => { const n = structuredClone(mocks.state.S); mut(n); mocks.state.S = n },
    importBackup: vi.fn(), setUnit: vi.fn(), resetEverything: vi.fn(),
  })
  const useStore = selector => selector ? selector(snapshot()) : snapshot()
  useStore.getState = snapshot
  return { useStore, DEF: {}, hasData: () => false }
})

vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: mocks.openSheet })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})

vi.mock('react-router-dom', () => ({
  useNavigate: () => () => {}, useParams: () => ({}), useLocation: () => ({ state: null }), Navigate: () => null,
}))
vi.mock('../sheets.jsx', () => ({ confirmSheet: vi.fn() }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false, shareExport: vi.fn() }))
vi.mock('../lib/sound.js', () => ({
  unlock: vi.fn(), chime: vi.fn(), playOnSilentSupported: () => false, vibrateSupported: () => true, appleTouchDevice: () => false,
}))

// The Coach page renders its picker sheet through ui.jsx's require_ui(), which only works once the
// real app has called bindUI. Keep the sheet inside the same tree (Harness) so switching a provider
// does not unmount the page and lose the base/model it just filled in.
function Harness() {
  const [sheet, setSheet] = useState(null)
  mocks.openSheet = render => setSheet(() => render)
  return <>
    <Settings page="coach" />
    {sheet ? sheet(() => setSheet(null)) : null}
  </>
}

let host, root
beforeEach(() => {
  mocks.state.S = { unit: 'kg', workouts: [], routines: [], exWeights: {} }
  mocks.state.cfg = null
  mocks.state.saved = []
  mocks.listModels.mockReset()
  mocks.getKey.mockReset().mockResolvedValue(null)
  mocks.setKey.mockReset().mockResolvedValue(undefined)
  mocks.clearKey.mockReset().mockResolvedValue(undefined)
  bindUI(useUI)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = async () => {
  await act(async () => { root.render(<Harness />) })
  await act(async () => { await new Promise(r => setTimeout(r, 0)) })
}
const rowByTitle = title => [...host.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === title)
const button = title => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === title)
const typeInto = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
}
// The click path runs an async handler (read the stored key, then call the provider).
const clickAsync = async el => {
  await act(async () => { el.click(); await new Promise(r => setTimeout(r, 0)) })
}

// 接口地址、模型、密钥按 DOM 顺序排列，与占位文字无关（选完服务商后占位会跟着变）。
const baseField = () => host.querySelectorAll('input.field')[0]
const modelField = () => host.querySelectorAll('input.field')[1]
const keyField = () => host.querySelector('input[type="password"]')

const fill = (base = 'https://api.example.com', model = 'gpt-4o-mini', key = 'sk-secret') => {
  act(() => { typeInto(baseField(), base) })
  act(() => { typeInto(modelField(), model) })
  if (key !== null) act(() => { typeInto(keyField(), key) })
}

describe('Lite Settings — AI coach', () => {
  it('renders the base URL, model and API key fields', async () => {
    await mount()
    expect(rowByTitle('服务商')).toBeTruthy()
    expect(baseField()).toBeTruthy()
    expect(modelField()).toBeTruthy()
    expect(keyField().type).toBe('password')
    expect(rowByTitle('服务商').querySelector('.lrow-v').textContent).toBe('其它 OpenAI 兼容服务')
  })

  it('refuses to save without an address', async () => {
    await mount()
    await clickAsync(button('保存'))
    expect(mocks.state.saved).toEqual([])
    expect(host.textContent).toContain('请填写接口地址（base URL）')
  })

  it('saves the key into secure storage, never into the synced config', async () => {
    await mount()
    fill()
    await clickAsync(button('保存'))
    expect(mocks.setKey).toHaveBeenCalledWith('compatible', 'sk-secret')
    expect(mocks.state.saved).toEqual([{ preset: 'compatible', base: 'https://api.example.com', model: 'gpt-4o-mini' }])
    expect(JSON.stringify(mocks.state.saved)).not.toContain('sk-secret')
    expect(host.textContent).toContain('可以开始对话了')
  })

  it('fills base and model from the chosen provider, and points Zhipu away from /v1', async () => {
    await mount()
    await clickAsync(rowByTitle('服务商'))
    await clickAsync(rowByTitle(zhipu.label))
    expect(baseField().value).toBe(zhipu.base)
    expect(modelField().value).toBe(zhipu.model)
    expect(host.textContent).toContain('不要再加 /v1')
    expect(coachEndpoints(baseField().value, 'zhipu').chatUrl).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions')
  })

  it('tests the connection, lists models, and offers them at model picker', async () => {
    mocks.listModels.mockResolvedValue({ ok: true, models: ['gpt-4o', 'gpt-4o-mini'] })
    await mount()
    fill()
    await clickAsync(button('测试连接'))
    expect(mocks.listModels).toHaveBeenCalledWith({ base: 'https://api.example.com', apiKey: 'sk-secret', provider: 'compatible' })
    expect(host.textContent).toContain('2')
    expect(rowByTitle('可用模型')).toBeTruthy()
  })

  it('surfaces a failed connection and saves nothing', async () => {
    mocks.listModels.mockResolvedValue({ ok: false, error: 'Invalid API key' })
    await mount()
    fill()
    await clickAsync(button('测试连接'))
    expect(host.textContent).toContain('Invalid API key')
    expect(mocks.state.saved).toEqual([])
  })

  it('shows a stored key as saved, and clears it on demand', async () => {
    mocks.getKey.mockResolvedValue('stored-key')
    mocks.state.cfg = { preset: 'compatible', base: 'https://api.example.com', model: 'gpt-4o-mini' }
    await mount()
    expect(host.textContent).toContain('已保存')
    expect(keyField().placeholder).toContain('已保存')
    await clickAsync(rowByTitle('清除已保存的密钥'))
    expect(mocks.clearKey).toHaveBeenCalledWith('compatible')
    // Back to the provider's own hint once nothing is stored for it.
    expect(keyField().placeholder).toBe('可留空')
  })

  it('keeps an already saved key when the field is left blank', async () => {
    mocks.getKey.mockResolvedValue('stored-key')
    await mount()
    fill('https://api.example.com', 'gpt-4o-mini', null)
    await clickAsync(button('保存'))
    expect(mocks.setKey).not.toHaveBeenCalled()
    expect(mocks.state.saved[0]).toEqual({ preset: 'compatible', base: 'https://api.example.com', model: 'gpt-4o-mini' })
  })
})
