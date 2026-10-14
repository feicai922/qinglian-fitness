import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutineIds, effectiveRoutines, streakWeeks, lastBW } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, isoOf, weekStartOf, weekDayOffset, DAYS } from '../lib/format.js'
import { t, tn, dateLocale } from '../lib/i18n.js'
import { bwSheet, goalSheet, calendarSheet, bwDeltaColor, weighInsSheet } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { glyphOf } from '../lib/glyphs.js'

// 精简模式的首页（vite.config.js 在 --mode lite 下把 views/Home.jsx 指到这里）。
// 完整版首页带着队列/轮换、训练日备注、gym 打卡与连接状态条，那些在这个构建里都没有：
// 这里只留“今天练什么 + 一眼看进度”。日期条直接开练（不走 startFlow 的称重流程），
// 深图表与历史仍在 Stats 页。
export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const [weekOffset, setWeekOffset] = useState(0)

  const today = new Date()
  const todayRoutines = effectiveRoutines(S, todayISO())
  const routine = todayRoutines[0] || null
  const bw = lastBW(S)
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null

  const ws = weekStartOf(S)
  const wkStart = new Date(today)
  wkStart.setDate(today.getDate() - weekDayOffset(today.getDay(), ws) + weekOffset * 7)
  const doneDays = new Set(S.workouts.map(w => w.d))
  const loggedToday = S.workouts.filter(w => w.d === todayISO())
  // 今天练过一次就不再催：日历点已经变绿，这里跟着显示“已完成”。
  const doneToday = todayRoutines.length && todayRoutines.every(r =>
    loggedToday.some(w => (Array.isArray(w.routineIds) ? w.routineIds : [w.routineId]).includes(r.id))) && loggedToday.at(-1)
  const strip = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(wkStart); d.setDate(wkStart.getDate() + i)
    const iso = isoOf(d)
    const eff = effectiveRoutineIds(S, iso).length > 0
    const dot = doneDays.has(iso) ? ' done' : eff ? ' plan' : ''
    strip.push(<div key={i} className={'wday' + (iso === todayISO() ? ' today' : '')}>
      <div className="lbl">{t(DAYS[d.getDay()])}</div><div className="num">{d.getDate()}</div><div className={'dot' + dot} /></div>)
  }
  const wkEnd = new Date(wkStart); wkEnd.setDate(wkStart.getDate() + 6)
  const wkLabel = weekOffset === 0 ? t('This week') : `${wkStart.getDate()} ${wkStart.toLocaleDateString(dateLocale(), { month: 'short' })} – ${wkEnd.getDate()} ${wkEnd.toLocaleDateString(dateLocale(), { month: 'short' })}`
  const bwPoints = S.bodyweight.slice(-30).map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w, d: b.d }))

  const onToday = () => nav('/workout')

  return <div className="narrow">
    <div className="hdr">
      <div><h1>{user ? t('Hi {0}', user.name) : 'openGym'}</h1><div className="sub">{today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
    </div>

    <div className="card">
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w - 1)} aria-label={t('Previous week')}><Icon name="chevronLeft" /></button>
        <div className="small muted" style={{ fontWeight: 500 }}>{wkLabel}</div>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w + 1)} aria-label={t('Next week')}><Icon name="chevronRight" /></button>
      </div>
      <div className="week">{strip}</div>
      <div className="today-row" {...tappable(onToday)}>
        <div className="row" style={{ gap: 9, minWidth: 0 }}>
          <span className="lrow-i" style={{ background: S.active ? 'var(--orange)' : doneToday ? 'var(--surface-3)' : routine ? 'var(--acc)' : 'var(--surface-3)' }}>
            <Icon name={S.active ? 'play' : doneToday ? 'checkCircle' : routine ? glyphOf(routine.emoji) : 'moon'}
              style={doneToday && !S.active ? { color: 'var(--green)' } : undefined} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="lbl2">{t('Today')}</div>
            <div className="ttl">{S.active ? t('{0} (in progress)', S.active.name)
              : doneToday ? (doneToday.name ? t('{0} (done)', doneToday.name) : t('Workout done'))
              : routine ? routine.name : '可以开始训练'}</div>
          </div>
        </div>
        {S.active ? <span className="tag" style={{ color: 'var(--orange)', background: 'color-mix(in srgb,var(--orange) 16%,transparent)' }}>{t('Resume')}</span>
          : doneToday ? <span className="tag" style={{ color: 'var(--green)', background: 'color-mix(in srgb,var(--green) 16%,transparent)' }}>{t('Done')}</span>
          : <span className="tag acc">{t('Start')}</span>}
      </div>
    </div>

    {!S.active && (
      <div className="card">
        <div className="row" style={{ gap: 10, marginBottom: 6 }}>
          <span className="lrow-i"><Icon name="dumbbell" /></span>
          <div className="big" style={{ fontSize: 22 }}>{t('Welcome!')}</div>
        </div>
        <div className="muted small" style={{ marginBottom: 12 }}>点开开始，选择动作，逐组记录。</div>
        <Button variant="primary" icon="play" onClick={onToday}>开始自由训练</Button>
      </div>
    )}

    {S.showWeightCard !== false && <div className="card">
      <div className="row between bw-head" style={{ marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>{t('Body weight')}</h2>
        <div className="row" style={{ gap: 8 }}>
          <Button size="sm" icon="target" style={S.targetW ? { color: 'var(--yellow)' } : undefined} onClick={goalSheet}>{S.targetW ? fmtNum(S.targetW) : t('Goal')}</Button>
          <Button size="sm" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
        </div>
      </div>
      {bw ? <>
        <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
          <div className="big">{fmtNum(bw.w)} <span className="muted" style={{ fontSize: '1rem' }}>{S.unit}</span></div>
          {!!delta && (
            <span className="small row" style={{ gap: 2, fontWeight: 500, color: bwDeltaColor(delta, bw.w) }}>
              <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 12 }} />
              {fmtNum(Math.abs(delta))}
            </span>
          )}
          <span className="dim small" style={{ marginInlineStart: 'auto' }}>{fmtDate(bw.d, true)}</span>
        </div>
        {S.targetW && (
          <div className="small row" style={{ color: 'var(--yellow)', marginTop: 4, gap: 5 }}>
            <Icon name="target" style={{ fontSize: 13 }} />
            <span>{t('Goal')} {fmtNum(S.targetW)} {S.unit} · {Math.abs(S.targetW - bw.w) < 0.05 ? t('reached!') : t(S.targetW > bw.w ? '{0} to gain' : '{0} to lose', fmtNum(Math.abs(S.targetW - bw.w)) + ' ' + S.unit)}</span>
          </div>
        )}
        <div className="chart" style={{ marginTop: 8 }}><LineChart points={bwPoints} h={130} unit={S.unit} goal={S.targetW} /></div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
          <Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={weighInsSheet}>{t('All weigh-ins')}</Button>
        </div>
      </> : <div className="muted small">{S.weighIn === false
        ? t('No weigh-ins yet. Log your weight to start the curve.')
        : t("No weigh-ins yet. Log your weight to start the curve (we also ask before every workout).")}</div>}
    </div>}

    <div className="card tappable" style={{ cursor: 'pointer' }} {...tappable(() => calendarSheet())}>
      <div className="row between">
        <div>
          <div className="row" style={{ gap: 7, fontSize: 22, fontWeight: 600, letterSpacing: '-.021em' }}>
            <Icon name="flame" style={{ color: 'var(--orange)' }} />
            {t('{0} week streak', streakWeeks(S))}
          </div>
          <div className="muted small" style={{ marginTop: 2 }}>{tn('{0} workout total', '{0} workouts total', S.workouts.length)}</div>
        </div>
        <Icon name="calendar" className="chev" style={{ fontSize: 20 }} />
      </div>
    </div>
  </div>
}
