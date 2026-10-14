// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings.lite.jsx'
import { GIF_SOURCE_PRESETS } from '../lib/gif-sources.lite.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null, ui: null }
  const snapshot = () => ({
    S: state.S,
    coachCfg: null,
    setCoachCfg: vi.fn(),
    user: null,
    setUser: vi.fn(), replaceState: vi.fn(),
    update: mut => {
      const next = structuredClone(state.S)
      mut(next)
      state.S = next
    },
    importBackup: vi.fn(), setUnit: vi.fn(), resetEverything: vi.fn(),
  })
  return { state, snapshot }
})

vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, DEF: {}, hasData: () => false }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: mocks.state.ui })
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

let host, root, opened
beforeEach(() => {
  mocks.state.S = {
    unit: 'kg', restSec: 90, sound: false, gifSize: 'full', gifMirrorBase: null,
    theme: 'dark', workouts: [], routines: [], exWeights: {},
  }
  opened = []
  mocks.state.ui = vi.fn(render => { opened.push(render) })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = () => act(() => root.render(<Settings page="workout" />))
const rowByTitle = title => [...host.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === title)
const buttonByText = text => [...host.querySelectorAll('button')].find(b => b.textContent.includes(text))
const openSheet = () => {
  act(() => { rowByTitle('GIF 图源').click() })
  act(() => { root.render(opened[0](() => {})) })
}
const typeInto = (input, value) => {
  // React tracks the node's value; go through the prototype setter so its onChange runs.
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
}

describe('Lite Settings — GIF source', () => {
  it('shows the current source and opens the preset sheet', () => {
    mount()
    const row = rowByTitle('GIF 图源')
    expect(row).toBeTruthy()
    expect(row.querySelector('.lrow-v').textContent).toBe('默认')
    openSheet()
    // 默认项走勾，各预设与自定义都在同一张表里；没选自定义就不出现 URL 输入框
    expect(rowByTitle('默认（构建内置）').querySelector('.lrow-k')).toBeTruthy()
    expect(rowByTitle(GIF_SOURCE_PRESETS[0].label)).toBeTruthy()
    expect(rowByTitle('自定义地址')).toBeTruthy()
    expect(host.querySelector('.field')).toBe(null)
  })

  it('saves a preset and shows its label in the settings row', () => {
    mount()
    openSheet()
    act(() => { rowByTitle(GIF_SOURCE_PRESETS[0].label).click() })
    act(() => { buttonByText('保存').click() })
    expect(mocks.state.S.gifMirrorBase).toBe(GIF_SOURCE_PRESETS[0].base)
    mount()
    expect(rowByTitle('GIF 图源').querySelector('.lrow-v').textContent).toBe(GIF_SOURCE_PRESETS[0].label)
  })

  it('saves a custom base, normalised to a trailing slash', () => {
    mount()
    openSheet()
    act(() => { rowByTitle('自定义地址').click() })
    const input = host.querySelector('.field')
    expect(input).toBeTruthy()
    act(() => { typeInto(input, '  https://mine.example.com/gif  ') })
    act(() => { buttonByText('保存').click() })
    expect(mocks.state.S.gifMirrorBase).toBe('https://mine.example.com/gif/')
    mount()
    expect(rowByTitle('GIF 图源').querySelector('.lrow-v').textContent).toBe('mine.example.com')
  })

  it('rejects a non-http address and keeps the sheet open', () => {
    mount()
    openSheet()
    act(() => { rowByTitle('自定义地址').click() })
    act(() => { typeInto(host.querySelector('.field'), 'ftp://mine.example.com/gif') })
    act(() => { buttonByText('保存').click() })
    expect(mocks.state.S.gifMirrorBase).toBe(null)
    expect(host.textContent).toContain('http')
  })

  it('clears a custom override back to the build default', () => {
    mocks.state.S.gifMirrorBase = 'https://mine.example.com/gif/'
    mount()
    expect(rowByTitle('GIF 图源').querySelector('.lrow-v').textContent).toBe('mine.example.com')
    openSheet()
    const custom = host.querySelector('.field')
    expect(custom.value).toBe('https://mine.example.com/gif/')
    act(() => { rowByTitle('默认（构建内置）').click() })
    act(() => { buttonByText('保存').click() })
    expect(mocks.state.S.gifMirrorBase).toBe(null)
  })
})
