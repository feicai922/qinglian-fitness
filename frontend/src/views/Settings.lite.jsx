import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation, Navigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { ACCENTS, ACCENT_NAMES, todayISO } from '../lib/format.js'
import { unlock, chime, playOnSilentSupported, vibrateSupported, appleTouchDevice } from '../lib/sound.js'
import { REST_SOUND_IDS, restSoundOf } from '../lib/rest-sounds.js'
import { setRestAccent } from '../lib/rest-alert.js'
import { CUSTOM, accentKey, adjustedIn, applyAccent, cleanHex, inkOn, isGrey } from '../lib/accent.js'
import { REST_MAX, fmtRest } from '../lib/duration.js'
import { wakeLockSupported } from '../lib/wakelock.js'
import { MOBILE, shareExport } from '../lib/mobile.js'
import { t, tn } from '../lib/i18n.js'
import { GIF_MIRROR_BASE, normalizeGifMirrorBase } from '../lib/exercises.js'
import { GIF_SOURCE_PRESETS, gifSourceChoice, gifSourceShortLabel } from '../lib/gif-sources.lite.js'
import { COACH_PRESETS, validateCoachConfig, listModels, normalizeCoachBase } from '../lib/coach-openai.lite.js'
import { getProviderApiKey, setProviderApiKey, clearProviderApiKey } from '../lib/coach-secrets.js'
import { confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { durationSheet } from '../components/DurationWheel.jsx'
import { Section, Row, SelectRow, Switch, Segmented, Button, SearchField, TextField } from '../components/ui.jsx'
import { PAGES, ROOT_GROUPS, pageVisible, searchSettings } from './settings-pages.js'

// 精简模式的设置（vite.config.js 在 --mode lite 下把 views/Settings.jsx 指到这里）。
// 完整版设置页把账号/同步、Passkey、AI 教练、提醒推送、器械、1RM、更新检查、媒体 ZIP 和
// 第三方导入全挂在一棵树上；这个 fork 是本机单人、只存本地、中文优先，那些整块都不进来。
// 保留的六页：训练、计时提示、单位、外观、AI 教练（BYOK 自带密钥）、数据（JSON 导入导出与重置）。

const REST_SOUND_LABEL = { chime: 'Chime (louder)', classic: 'Classic beeps', bell: 'Bell',
  beep: 'Beep-beep', whistle: 'Whistle', soft: 'Soft' }
const REST_SOUND_HINT = {
  classic: 'The quieter three-beep sound from before 1.3.9, instead of the louder chime.',
  bell: 'Ding-dong. Rest is over, class is in.',
  beep: 'Your sports watch, calling you back.',
  whistle: 'Coach wants you back on the bar.',
  soft: 'Gentle, for headphones or a quiet room.',
}

export function pickRestSound(id) {
  unlock(true)
  useStore.getState().update(s => { s.restSound = id; s.classicChime = id === 'classic' })
  chime(true, id)
}

export function RestSoundSheet({ close }) {
  const S = useStore(s => s.S)
  const cur = restSoundOf(S)
  return <>
    <h3>{t('Sound')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('Tap one to hear it.')}</div>
    <Section>
      {REST_SOUND_IDS.map(id => <Row key={id} icon={id === cur ? 'speaker' : 'play'} iconTint="var(--pink)" title={t(REST_SOUND_LABEL[id])}
        subtitle={REST_SOUND_HINT[id] ? t(REST_SOUND_HINT[id]) : null} accessory={id === cur ? 'check' : 'none'}
        onClick={() => pickRestSound(id)} />)}
    </Section>
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={close}>{t('Done')}</Button>
  </>
}

const restSoundSheet = () => useUI.getState().openSheet(close => <RestSoundSheet close={close} />)

// GIF 图源：练记用的是同一套 Gym visual GIF，这里把几个常用 CDN 镜像做成预设，用户不必重新
// 打包就能切换；也可以填自己的服务器地址。选「默认」写回 null，S.gifMirrorBase 留空表示不覆盖
// 构建时的 VITE_GIF_MIRROR_BASE。保存只做最基本的 HTTP(S) 校验与结尾斜杠补全；真正能不能打开
// 交给图片自己的 onError 兜底。
const GifSourceRow = ({ pick, setPick, id, label, note, icon, tint }) => (
  <Row icon={icon} iconTint={tint} title={label} subtitle={note}
    accessory={pick === id ? 'check' : 'none'} onClick={() => setPick(id)} />
)

function GifSourceSheet({ close }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const choice = gifSourceChoice(S.gifMirrorBase)
  const [pick, setPick] = useState(
    choice.kind === 'preset' ? choice.id : choice.kind === 'custom' ? 'custom' : 'default')
  const [custom, setCustom] = useState(choice.kind === 'custom' ? String(S.gifMirrorBase || '') : '')
  const [error, setError] = useState('')
  const choose = id => { setPick(id); if (error) setError('') }
  const save = () => {
    if (pick === 'default') {
      update(s => { s.gifMirrorBase = null })
    } else if (pick === 'custom') {
      const v = custom.trim()
      if (!v) { setError('请填写自定义地址'); return }
      if (!/^https?:\/\//i.test(v)) { setError('地址要以 http:// 或 https:// 开头'); return }
      update(s => { s.gifMirrorBase = normalizeGifMirrorBase(v) })
    } else {
      const p = GIF_SOURCE_PRESETS.find(x => x.id === pick)
      if (!p) { setError('请选择一个图源'); return }
      update(s => { s.gifMirrorBase = p.base })
    }
    useUI.getState().toast(t('已保存'))
    close()
  }
  return <>
    <h3>{t('GIF 图源')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>
      {t('练习动画来自练记同一套 GIF 素材，动画按需加载。选一个 CDN 镜像，或填自己的服务器地址。')}
    </div>
    <Section>
      <GifSourceRow pick={pick} setPick={choose} id="default" label={t('默认（构建内置）')}
        note={GIF_MIRROR_BASE || t('当前构建未内置镜像')} icon="refresh" tint="var(--grey)" />
      {GIF_SOURCE_PRESETS.map(p => (
        <GifSourceRow key={p.id} pick={pick} setPick={choose} id={p.id} label={t(p.label)}
          note={t(p.note)} icon="cloud" tint="var(--teal)" />
      ))}
      <GifSourceRow pick={pick} setPick={choose} id="custom" label={t('自定义地址')}
        note={t('填自己的服务器地址，需以 http:// 或 https:// 开头')} icon="pencil" tint="var(--purple)" />
    </Section>
    {pick === 'custom' && <>
      <div style={{ height: 10 }} />
      <TextField value={custom} autoFocus inputMode="url" autoCapitalize="none" autoCorrect="off"
        placeholder={GIF_MIRROR_BASE || 'https://你的域名/gif/'}
        onChange={e => { setCustom(e.target.value); if (error) setError('') }} />
    </>}
    <div className="small" style={{ margin: '12px 0 16px', lineHeight: 1.45, color: error ? 'var(--red)' : 'var(--label-2)' }}>
      {error ? t(error) : t('动画只有在打开动作详情时才发起请求，不会一次加载全部。')}
    </div>
    <Button variant="primary" icon="check" onClick={save}>{t('保存')}</Button>
  </>
}

const gifSourceSheet = () => useUI.getState().openSheet(close => <GifSourceSheet close={close} />)

// AI 教练（精简版）：自带密钥(BYOK) + OpenAI 兼容接口。设置页只做三件事——选服务商、
// 填 Base URL / 模型 / API Key、测试能不能列出模型；真正提问在 /coach 聊天页里。
// 密钥按服务商分开存进系统安全存储（lib/coach-secrets.js），不写进 S、不进备份、不发去别处。
function CoachField({ label, hint, children }) {
  return (
    <div style={{ padding: '12px 14px' }}>
      {label && <div className="small dim" style={{ marginBottom: 6 }}>{label}</div>}
      {children}
      {hint && <div className="small" style={{ marginTop: 6, color: 'var(--label-3)', lineHeight: 1.4 }}>{hint}</div>}
    </div>
  )
}

function CoachSettings() {
  const nav = useNavigate()
  const cfg = useStore(s => s.coachCfg)
  const setCoachCfg = useStore(s => s.setCoachCfg)
  const toast = useUI(s => s.toast)
  const [preset, setPreset] = useState(cfg?.preset || 'compatible')
  const [base, setBase] = useState(cfg?.base || '')
  const [model, setModel] = useState(cfg?.model || '')
  const [key, setKey] = useState('')
  const [haveKey, setHaveKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)   // { ok, text }
  const [models, setModels] = useState([])

  const cur = COACH_PRESETS.find(p => p.id === preset) || COACH_PRESETS[COACH_PRESETS.length - 1]
  const keyRequired = preset !== 'ollama'

  // 切服务商就看那一家存过的密钥；输入框始终留空，避免把已保存的密钥再次显示出来。
  useEffect(() => {
    let gone = false
    setKey(''); setModels([]); setNote(null)
    getProviderApiKey(preset).then(v => { if (!gone) setHaveKey(!!v) })
    return () => { gone = true }
  }, [preset])

  const pickPreset = id => {
    const p = COACH_PRESETS.find(x => x.id === id)
    if (!p || id === preset) return
    setPreset(id)
    if (p.base) setBase(p.base)
    setModel(p.model || '')
  }

  // 用户没重填时用系统里存着的那个密钥；这样「测试连接」不比「保存」多要一次输入。
  const effectiveKey = async () => key.trim() || (await getProviderApiKey(preset)) || ''

  const test = async () => {
    const apiKey = await effectiveKey()
    const chk = validateCoachConfig({ base, model, apiKey, keyRequired })
    if (!chk.ok) { setNote({ ok: false, text: chk.error }); return }
    setBusy(true); setNote(null)
    const r = await listModels({ base, apiKey, provider: preset })
    setBusy(false)
    if (!r.ok) { setModels([]); setNote({ ok: false, text: r.error }); return }
    setModels(r.models)
    setNote({ ok: true, text: t('连接成功，可用模型 {0} 个', r.models.length) })
  }

  const save = async () => {
    const apiKey = await effectiveKey()
    const chk = validateCoachConfig({ base, model, apiKey, keyRequired })
    if (!chk.ok) { setNote({ ok: false, text: chk.error }); return }
    if (key.trim()) await setProviderApiKey(preset, key.trim())
    setHaveKey(!!apiKey)
    setCoachCfg({ preset, base: normalizeCoachBase(base), model: model.trim() })
    setKey('')
    toast(t('已保存'))
    setNote({ ok: true, text: t('已保存，可以开始对话了。') })
  }

  const clearKey = async () => {
    await clearProviderApiKey(preset)
    setKey(''); setHaveKey(false)
    toast(t('密钥已清除'))
  }

  const modelOptions = models.map(m => ({ value: m, label: m }))

  return <>
    <Section title="模型服务" footer={t('选一个服务商会自动填好地址与常用模型；也可以选「其它 OpenAI 兼容服务」自己填。')}>
      <SelectRow icon="cloud" iconTint="var(--blue)" title="服务商" value={preset}
        options={COACH_PRESETS.map(p => ({ value: p.id, label: p.label, subtitle: p.base || undefined }))}
        onChange={pickPreset} />
    </Section>

    <Section title="接口地址">
      <CoachField label="Base URL" hint={cur.apiPath === ''
        ? t('智谱的地址自带 /v4，照原样填到 /api/paas/v4 为止，不要再加 /v1。')
        : t('填到 /v1 之前即可；以 /v1 结尾也不会重复拼接。')}>
        <TextField value={base} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder={cur.base || 'https://api.example.com'}
          onChange={e => { setBase(e.target.value); if (note) setNote(null) }} />
      </CoachField>
    </Section>

    <Section title="模型" footer={modelOptions.length ? null : t('先点「测试连接」列出可用模型，或直接填写模型名称。')}>
      {modelOptions.length > 0 && (
        <SelectRow icon="sparkles" iconTint="var(--green)" title="可用模型" value={model}
          options={modelOptions} onChange={v => { setModel(v); if (note) setNote(null) }} />
      )}
      <CoachField label={t('模型名称')}>
        <TextField value={model} autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder={cur.model || 'gpt-4o-mini'}
          onChange={e => { setModel(e.target.value); if (note) setNote(null) }} />
      </CoachField>
    </Section>

    <Section title="API Key" footer={t('密钥只保存在本机的系统安全存储里，不会写进备份，也不会上传到别的地方。')}>
      <CoachField
        label={t('密钥')}
        hint={haveKey ? t('已保存一个密钥。留空即保持不变，重新填写则覆盖。') : (cur.hint ? t('例如：{0}', cur.hint) : null)}>
        <TextField type="password" value={key} autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder={haveKey ? '••••••••（已保存）' : (cur.hint || 'API Key')}
          onChange={e => { setKey(e.target.value); if (note) setNote(null) }} />
      </CoachField>
      {haveKey && <Row icon="key" iconTint="var(--red)" title={t('清除已保存的密钥')} danger onClick={clearKey} />}
    </Section>

    {note && (
      <div className="small" style={{ margin: '-8px 4px 16px', lineHeight: 1.45, color: note.ok ? 'var(--green)' : 'var(--red)' }}>
        {note.text}
      </div>
    )}

    <div className="row" style={{ display: 'flex', gap: 8 }}>
      <Button icon="refresh" disabled={busy} onClick={test}>{busy ? t('测试中…') : t('测试连接')}</Button>
      <Button variant="primary" icon="check" onClick={save}>{t('保存')}</Button>
    </div>
    {cfg?.model && (
      <>
        <div style={{ height: 10 }} />
        <Button icon="chat" onClick={() => nav('/coach')}>{t('开始对话')}</Button>
      </>
    )}
  </>
}

// What the chosen accent is called: a preset's colour name, or the user's own.
function accentLabel(S) {
  const k = accentKey(S)
  return k === CUSTOM ? t('Your own color') : t(ACCENT_NAMES[k] || 'Green')
}

// 与完整版同一套「自己的颜色」逻辑（lib/accent.js）：拖动只重绘，停一下或关闭时才保存。
const OWN_COLOR_SETTLE_MS = 400
function AccentSwatches({ S, update }) {
  const key = accentKey(S)
  const own = cleanHex(S.accentCustom)
  const onCustom = key === CUSTOM
  const pickPreset = k => { update(s => { s.accent = k }); setRestAccent(k) }
  const pickOwn = hex => {
    const c = cleanHex(hex)
    if (!c || (onCustom && c === own)) return
    update(s => { s.accent = CUSTOM; s.accentCustom = c })
    setRestAccent(c)
  }
  const inputRef = useRef(null)
  const pending = useRef(null)
  const timer = useRef(0)
  const pickOwnRef = useRef(pickOwn)
  pickOwnRef.current = pickOwn
  const commit = () => {
    clearTimeout(timer.current)
    const c = pending.current
    pending.current = null
    if (c) pickOwnRef.current(c)
  }
  const preview = hex => {
    const c = cleanHex(hex)
    if (!c) return
    const de = document.documentElement
    applyAccent(de, c, de.dataset.theme)
    pending.current = c
    clearTimeout(timer.current)
    timer.current = setTimeout(commit, OWN_COLOR_SETTLE_MS)
  }
  const hasInput = !(own && !onCustom)
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const onChange = () => { pending.current = cleanHex(el.value) || pending.current; commit() }
    el.addEventListener('change', onChange)
    return () => el.removeEventListener('change', onChange)
  }, [hasInput]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => commit, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pending.current && inputRef.current) inputRef.current.value = own || '#30d158'
  }, [own])
  const ownLabel = t('Your own color')
  const grey = own && isGrey(own)
  const notes = own && onCustom ? [
    adjustedIn(own, 'dark') && (grey ? t('Greys show lighter in dark mode, so buttons don’t look switched off.') : t('A touch lighter in dark mode, so you can still read it.')),
    adjustedIn(own, 'light') && (grey ? t('Greys show darker in light mode, so buttons don’t look switched off.') : t('A touch darker in light mode, so you can still read it.')),
  ].filter(Boolean) : []
  return <>
    <div className="swatches" style={{ flexBasis: '100%', paddingInlineStart: 41 }}>
      {Object.entries(ACCENTS).map(([k, c]) => (
        <button key={k} className={'swatch' + (key === k ? ' on' : '')}
          style={{ background: c }} onClick={() => pickPreset(k)} aria-label={t(ACCENT_NAMES[k] || k)} />
      ))}
      {!hasInput
        ? <button className="swatch swatch-own" style={{ background: own }} onClick={() => pickOwn(own)} aria-label={ownLabel} />
        : <span className={'swatch swatch-own' + (own ? ' on' : ' unset')} style={own ? { background: own, color: inkOn(own) } : undefined}>
          {own ? <Icon name="pencil" /> : <Icon name="plus" />}
          <input ref={inputRef} type="color" className="swatch-input" defaultValue={own || '#30d158'}
            onChange={e => preview(e.target.value)}
            aria-label={own ? t('Change your own color') : t('Pick your own color')} />
        </span>}
    </div>
    {notes.map(n => <span key={n} className="lrow-s swatch-note" style={{ flexBasis: '100%', paddingInlineStart: 41 }}>{n}</span>)}
  </>
}

// 精简模式的中文界面：重量单位只在这两种里选，标签也直接用中文。
const weightUnitLabel = unit => unit === 'lb' ? '磅' : '公斤'

// Lite 没有语言选择，“单位与语言”这个页名会误导；其余页名正常走 zh 词典。
const pageTitle = page => page === 'units' ? '单位' : t(PAGES[page].title)

// The route: /settings and /settings/<page>. 精简模式只认识留下的几页，其余回根页。
export function SettingsRoute() {
  const { page } = useParams()
  const loc = useLocation()
  const ctx = { user: useStore(s => s.user), mobile: MOBILE }
  if (page && (!PAGES[page] || !pageVisible(page, ctx))) return <Navigate to="/settings" replace />
  // 精简版保留「计划与日程」入口，但这块内容就在底部的计划页。设置里没有第二份
  // 排期界面，所以这里直接跳过去，避免点开后又落回设置首页。
  if (page === 'plan') return <Navigate to="/plan" replace />
  return <Settings key={page || 'root'} page={page || null} find={loc.state?.find || null} />
}

// What was typed into the search, kept while you step into a hit and back out again.
let lastQuery = { q: '', key: null }

export default function Settings({ page = null, find = null }) {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const coachCfg = useStore(s => s.coachCfg)
  const { update, importBackup, setUnit, resetEverything: resetAll } = useStore()
  const toast = useUI(s => s.toast)
  const fileRef = useRef(null)
  const body = useRef(null)
  const wakeOK = wakeLockSupported()
  const canVibrate = vibrateSupported()

  // A search hit: scroll its row into view and flash it once.
  useEffect(() => {
    if (!find || !body.current) return
    const el = body.current
    const named = label => [...el.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === label)
      || [...el.querySelectorAll('.btn')].find(b => b.textContent.trim() === label)
    const row = named(t(find))
    let tm = null
    if (row) {
      row.classList.add('sp-flash')
      if (typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'center' })
      tm = setTimeout(() => row.classList.remove('sp-flash'), 1900)
    }
    return () => clearTimeout(tm)
  }, [find])

  const open = id => nav('/settings/' + id)
  const back = () => {
    const up = PAGES[page]?.parent ? '/settings/' + PAGES[page].parent : '/settings'
    if ((window.history.state?.idx || 0) > 0) nav(-1)
    else nav(up, { replace: true })
  }

  const themeLabel = { dark: t('Dark'), light: t('Light'), system: t('System') }[S.theme || 'dark'] || t('Dark')
  const preview = {
    workout: () => S.restSec > 0 ? t('{0} rest', fmtRest(S.restSec)) : t('No rest timer'),
    alerts: () => [S.sound ? t('Sound') : null, canVibrate && S.vibrate !== false ? t('Vibrate') : null, S.timerFlash ? t('Flash') : null].filter(Boolean).join(' · ') || t('Silent'),
    units: () => weightUnitLabel(S.unit || 'kg'),
    look: () => themeLabel + ' · ' + accentLabel(S),
    coach: () => coachCfg?.model ? coachCfg.model : t('未配置'),
    data: () => '',
  }

  const doExport = async () => {
    const json = JSON.stringify(useStore.getState().S, null, 2)
    const name = 'opengym-backup-' + todayISO() + '.json'
    if (MOBILE) {
      try { await shareExport(json, name); toast(t('Backup exported')) } catch (e) { /* share sheet dismissed */ }
      return
    }
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
    toast(t('Backup exported'))
  }

  const doImport = async ev => {
    const f = ev.target.files[0]; if (!f) return
    ev.target.value = ''
    let state
    try { state = JSON.parse(await f.text()) } catch { toast(t('Could not read that file')); return }
    confirmSheet({
      title: t('Import backup?'), message: t('This replaces all current data with the backup file.'), confirmText: t('Import'), danger: true,
      onConfirm: () => { importBackup(state); toast(t('Backup imported')) },
    })
  }

  const resetEverything = () => confirmSheet({
    title: t('Reset everything?'),
    message: t('Deletes your plan, workouts, body weight, photos and videos on this device. This cannot be undone.'),
    confirmText: t('Delete everything'), danger: true,
    onConfirm: () => { resetAll(); nav('/home'); toast(t('All data reset')) },
  })

  // Two honest choices on a unit switch (issue #22): convert the numbers, or keep them and only
  // change the label. Closing the sheet leaves the unit as it was.
  const switchUnit = v => {
    if (v === S.unit) return
    useUI.getState().openSheet(close => <>
      <h3>{t('Convert to {0}?', v)}</h3>
      <div className="muted small" style={{ marginBottom: 12 }}>{t('Every stored weight is in {0}. Convert the numbers, or keep them and only change the label?', S.unit)}</div>
      <Section>
        <Row icon="calculator" title={t('Convert the numbers')} accessory="chevron" onClick={() => { setUnit(v); close() }} />
        <Row icon="pencil" title={t('Keep the numbers, change the label')} accessory="chevron" onClick={() => { setUnit(v, { convert: false }); close() }} />
      </Section>
    </>)
  }

  const layout = ['list', 'compact', 'focus'].includes(S.workoutView) ? S.workoutView : 'cards'

  const pages = {
    workout: () => <>
      <Section title={t('Rest')} footer={t('Each exercise can have its own rest too. Set it in the exercise settings of a routine.')}>
        <Row icon="timer" iconTint="var(--orange)" title={t('Rest timer')} value={fmtRest(S.restSec)} accessory="chevron"
          onClick={() => durationSheet({
            title: t('Rest timer'), value: S.restSec, max: REST_MAX, off: t('Off'),
            footer: t('Scroll to 0:00 to turn the rest timer off.'),
            onDone: v => update(s => { s.restSec = v }),
          })} />
      </Section>
      <Section title={t('Logging')}>
        <SelectRow icon="history" iconTint="var(--blue)" title={t('Shown under each exercise')}
          value={S.logRef === 'best' ? 'best' : 'last'} onChange={v => update(s => { s.logRef = v })}
          options={[
            { value: 'last', label: t('Last time'), subtitle: t('What you did the last time, in that routine.') },
            { value: 'best', label: t('Best set'), subtitle: t('Your heaviest set of the exercise, from any workout.') },
          ]} />
        <Row icon="layout" iconTint="var(--blue)" title={t('Layout')}>
          <Segmented className="seg-inline"
            options={[{ value: 'cards', label: t('Cards') }, { value: 'list', label: t('List') }, { value: 'compact', label: t('Compact') }, { value: 'focus', label: t('Focus') }]}
            value={layout} onChange={v => update(s => { s.workoutView = v })} />
        </Row>
        <Row icon="minimize" iconTint="var(--teal)" title={t('Collapse completed exercises')}
          subtitle={t('In List and Compact, a finished exercise folds into one line.')}>
          <Switch aria-label={t('Collapse completed exercises')} checked={!!S.collapseCompleted}
            onChange={v => update(s => { s.collapseCompleted = v; if (s.active) delete s.active.collapseCompleted })} />
        </Row>
      </Section>
      <Section title={t('Before and during')}>
        <Row icon="scale" iconTint="var(--green)" title={t('Weigh in before workouts')}
          subtitle={t('Asks for your body weight when a workout starts. Off starts the session straight away.')}>
          <Switch checked={S.weighIn !== false} onChange={v => update(s => { s.weighIn = v })} />
        </Row>
        {(wakeOK || !MOBILE) && (
          <Row icon="phoneScreen" iconTint="var(--yellow)" title={t('Keep screen awake')}
            subtitle={wakeOK ? t('The screen stays on while a workout is running, so you don’t have to unlock your phone between sets.') : t('Not supported in this browser.')}>
            <Switch checked={wakeOK && S.keepAwake !== false} disabled={!wakeOK}
              onChange={v => update(s => { s.keepAwake = v })} />
          </Row>
        )}
        <Row icon="image" iconTint="var(--teal)" title={t('Exercise animations')}>
          <Segmented className="seg-inline"
            options={[{ value: 'full', label: t('Full') }, { value: 'mini', label: t('Small') }, { value: 'off', label: t('Hidden') }]}
            value={S.gifSize === 'mini' || S.gifSize === 'off' ? S.gifSize : 'full'}
            onChange={v => update(s => { s.gifSize = v })} />
        </Row>
        <Row icon="cloud" iconTint="var(--teal)" title="GIF 图源" value={gifSourceShortLabel(S.gifMirrorBase)} accessory="chevron" onClick={gifSourceSheet} />
      </Section>
    </>,

    alerts: () => {
      const iPhone = appleTouchDevice()
      return <>
        <Section title={t('When a rest ends')}>
          <Row icon="speaker" iconTint="var(--pink)" title={t('Play a sound')}>
            <Switch checked={!!S.sound} onChange={v => { if (v) unlock(true); update(s => { s.sound = v }) }} />
          </Row>
          {S.sound && <Row icon="speaker" iconTint="var(--pink)" title={t('Sound')} value={t(REST_SOUND_LABEL[restSoundOf(S)])}
            accessory="chevron" onClick={restSoundSheet} />}
          {S.sound && playOnSilentSupported() && (
            <Row icon="speaker" iconTint="var(--orange)" title={t('Play even on silent')}
              subtitle={<>{t('Music playing on this phone stops during a workout and does not resume by itself.')}<br />{t('iPhone only')}</>}>
              <Switch checked={!!S.soundOnSilent} onChange={v => update(s => { s.soundOnSilent = v })} />
            </Row>
          )}
        </Section>
        <Section footer={!canVibrate && iPhone ? t('iPhone doesn’t let openGym vibrate. A sound or a flash does the job.') : null}>
          <Row icon="vibrate" iconTint="var(--indigo)" title={t('Vibrate')} className={canVibrate ? '' : 'dis'}
            subtitle={canVibrate ? null : iPhone ? t('Not on iPhone') : t('Not supported in this browser.')}>
            <Switch checked={canVibrate && S.vibrate !== false} disabled={!canVibrate} onChange={v => update(s => { s.vibrate = v })} />
          </Row>
          <Row icon="sun" iconTint="var(--yellow)" title={t('Flash the screen')}>
            <Switch checked={!!S.timerFlash} onChange={v => update(s => { s.timerFlash = v })} />
          </Row>
        </Section>
      </>
    },

    units: () => <>
      <Section footer={t('Switching the unit of weight changes what every screen shows and what the steppers count in.')}>
        <Row icon="scale" iconTint="var(--teal)" title={t('Weight unit')}>
          <Segmented className="seg-inline"
            options={[{ value: 'kg', label: '公斤' }, { value: 'lb', label: '磅' }]}
            value={S.unit === 'lb' ? 'lb' : 'kg'} onChange={switchUnit} />
        </Row>
        <Row icon="ruler" iconTint="var(--teal)" title={t('Weight decimals')} subtitle={t('How precisely weights are shown.')}>
          <Segmented className="seg-inline"
            options={[{ value: 1, label: t('0.5') }, { value: 2, label: t('0.25') }]}
            value={S.wdec === 2 ? 2 : 1} onChange={v => update(s => { s.wdec = v })} />
        </Row>
      </Section>
    </>,

    look: () => <>
      <Section>
        <Row icon="moon" iconTint="var(--indigo)" title={t('Theme')}>
          <Segmented className="seg-inline"
            options={[
              { value: 'dark', icon: 'moon', label: t('Dark') },
              { value: 'light', icon: 'sun', label: t('Light') },
              { value: 'system', icon: 'gear', label: t('System') },
            ]}
            value={S.theme || 'dark'} onChange={v => update(s => { s.theme = v })} />
        </Row>
        <div className="lrow" style={{ flexWrap: 'wrap', rowGap: 12, paddingBottom: 14 }}>
          <span className="lrow-i" style={{ '--tint': 'var(--purple)' }}><Icon name="palette" /></span>
          <span className="lrow-m"><span className="lrow-t">{t('Accent color')}</span></span>
          <span className="lrow-v">{accentLabel(S)}</span>
          <AccentSwatches S={S} update={update} />
        </div>
      </Section>
      <Section title={t('On Home')}>
        <Row icon="scale" iconTint="var(--green)" title={t('Body weight')}
          subtitle={t('Show the body weight card on Home.')}>
          <Switch checked={S.showWeightCard !== false} onChange={v => update(s => { s.showWeightCard = v })} />
        </Row>
      </Section>
    </>,

    // AI 教练（精简版）：自带密钥 + OpenAI 兼容接口。配置就在这一页，问答在 /coach。
    coach: () => <CoachSettings />,

    data: () => <>
      <Section title={t('Back up')}>
        <Row icon="share" iconTint="var(--blue)" title="导出备份" accessory="chevron" onClick={doExport} />
      </Section>
      <Section title={t('Bring data in')}>
        <Row icon="download" iconTint="var(--teal)" title={t('Import backup')} accessory="chevron" onClick={() => fileRef.current.click()} />
      </Section>
      <Section>
        <Row icon="trash" iconTint="var(--red)" title={t('Reset everything')} danger onClick={resetEverything} />
      </Section>
      <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={doImport} />
    </>,
  }

  if (page && pages[page]) {
    return <div className="narrow" ref={body}>
      <div className="sp-nav">
        <button className="sp-back" onClick={back}>
          <Icon name="chevronLeft" /><span>{t('Settings')}</span>
        </button>
        <h1 className="sp-title">{pageTitle(page)}</h1>
      </div>
      {pages[page]()}
    </div>
  }

  return <SettingsRoot nav={nav} preview={preview} open={open} go={hit => {
    nav('/settings/' + hit.page, hit.isPage ? undefined : { state: { find: hit.title } })
  }} ctx={{ user: useStore.getState().user, mobile: MOBILE }} />
}

function SettingsRoot({ nav, preview, open, go, ctx }) {
  const [key] = useState(() => window.history.state?.key || null)
  const [q, setQ] = useState(() => (key && lastQuery.key === key ? lastQuery.q : ''))
  const set = v => { lastQuery = { q: v, key }; setQ(v) }
  const hits = q.trim() ? searchSettings(q, ctx) : null
  return <div className="narrow">
    <div className="sp-nav">
      <button className="sp-back" onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="chevronLeft" /><span>{t('Home')}</span></button>
    </div>
    <h1 className="sp-root-title">{t('Settings')}</h1>
    <div className="sp-search">
      <SearchField value={q} onChange={e => set(e.target.value)} onClear={() => set('')}
        placeholder={t('Search…')} aria-label={t('Search settings')} inputMode="search" enterKeyHint="search" autoComplete="off" />
    </div>
    {hits ? (hits.length ? <Section title={tn('{0} result', '{0} results', hits.length)}>
      {hits.slice(0, 40).map(h => (
        <Row key={h.page + ':' + h.title} icon={h.icon} iconTint={h.tint} title={h.label} subtitle={h.trail} accessory="chevron" onClick={() => go(h)} />
      ))}
    </Section> : <div className="sp-empty">{t('No setting matches “{0}”.', q.trim())}</div>) : (
      ROOT_GROUPS.map(g => g.filter(id => pageVisible(id, ctx))).filter(g => g.length).map(g => (
        <Section key={g[0]}>
          {g.map(id => <Row key={id} icon={PAGES[id].icon} iconTint={PAGES[id].tint} title={t(PAGES[id].title)}
            value={preview[id]?.() || null} accessory="chevron" onClick={() => open(id)} className="sp-root-row" />)}
        </Section>
      ))
    )}
  </div>
}
