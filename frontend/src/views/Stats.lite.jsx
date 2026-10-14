import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { lastBW, streakWeeks, workoutDay } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, weekStartOf } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { bwSheet, goalSheet, WorkoutRow, bwDeltaColor, weighInsSheet, workoutDetailSheet, calendarSheet, dayOverrideSheet } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Heatmap from '../components/Heatmap.jsx'
import Icon from '../components/Icon.jsx'
import { loadOfWorkouts, muscleBalanceWindow, rankOf, MUSCLE_NAME } from '../lib/muscles.js'
import { Segmented } from '../components/ui.jsx'
import { Button } from '../components/ui.jsx'

// 精简模式的统计页：只回答“练了多少、练到哪些部位、体重怎么走”。
// 完整版的疲劳度、保留力量、估算 1RM、动作进度曲线和身体图示不进这个构建；
// 活动（热力图）保留：它只读本机训练记录，不依赖扫码/签到。
const rangeOptions = () => [
  { value: 30, label: '近 30 天' },
  { value: 90, label: '近 90 天' },
  { value: 365, label: '近一年' },
  { value: 0, label: t('All') }
]

function MuscleSetsCard({ S }) {
  const [win, setWin] = useState(30)
  const now = Date.now()
  const inWin = win === 0
    ? S.workouts
    : muscleBalanceWindow(S.workouts, win, now, todayISO(), weekStartOf(S))
  const load = loadOfWorkouts(inWin)
  const { worked } = rankOf(load)
  const max = worked.length ? load[worked[0]] : 0
  return <div className="card">
    <h2>{t('Muscle balance')} <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>· {t('by sets worked')}</span></h2>
    <Segmented className="seg-range" value={win} onChange={setWin}
      options={[{ value: 7, label: t('Week') }, { value: 30, label: '近 30 天' }, { value: 90, label: '近 90 天' }, { value: 0, label: t('All') }]} />
    {worked.length ? <div style={{ marginTop: 10 }}>
      {worked.map(m => <div key={m} className="mrow" data-muscle-volume={m}>
        <span className="nm">{t(MUSCLE_NAME[m])}</span>
        <span className="bar"><i style={{ width: Math.round(load[m] / max * 100) + '%' }} /></span>
        <span className="v">{t('{0} sets', fmtNum(Math.round(load[m] * 10) / 10))}</span>
      </div>)}
    </div> : <div className="muted small" style={{ marginTop: 10 }}>{t('No workouts in this period yet.')}</div>}
  </div>
}

export default function Stats() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [range, setRange] = useState(90)
  const now = Date.now()

  const bwPts = S.bodyweight.filter(b => range === 0 || (b.t || new Date(b.d).getTime()) > now - range * 86400000)
    .map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w, d: b.d }))
  const bw30 = S.bodyweight.filter(b => (b.t || new Date(b.d).getTime()) > now - 30 * 86400000)
  const bwDelta30 = bw30.length > 1 ? bw30[bw30.length - 1].w - bw30[0].w : null
  const workouts = S.workouts
  const monthW = workouts.filter(w => workoutDay(w)?.slice(0, 7) === todayISO().slice(0, 7)).length

  return <>
    <div className="hdr"><div><h1>{t('Stats')}</h1><div className="sub">{t('Progress & history')}</div></div>
      <button className="iconbtn" onClick={() => nav('/history')} aria-label={t('History')}><Icon name="history" /></button></div>

    <div className="tiles">
      <div className="tile"><div className="l"><Icon name="dumbbell" />{t('Workouts')}</div><div className="v">{workouts.length}</div></div>
      <div className="tile"><div className="l"><Icon name="calendar" />{t('This month')}</div><div className="v">{monthW}</div></div>
      <div className="tile"><div className="l"><Icon name="flame" />{t('Week streak')}</div><div className="v">{streakWeeks(S)}</div></div>
      <div className="tile"><div className="l"><Icon name="scale" />{t('Weight 30d')}</div><div className="v" style={{ fontSize: 22, color: bwDelta30 === null ? 'inherit' : bwDeltaColor(bwDelta30, (lastBW(S) || {}).w || 0) }}>{bwDelta30 === null ? '–' : (bwDelta30 > 0 ? '+' : '') + fmtNum(bwDelta30) + ' ' + S.unit}</div></div>
    </div>

    {workouts.length > 0 && <MuscleSetsCard S={S} />}

    {/* 活动热力图取自本机训练记录（lib/history.js 的 workoutDay），与扫码/签到无关：
        点开一次训练、点「结束」保存后，当天格子就会着色。 */}
    <div className="card">
      <h2>{t('Activity (last 12 months)')}</h2>
      <Heatmap
        S={S}
        metric={S.heatmapMetric === 'vol' ? 'vol' : 'time'}
        onMetricChange={metric => useStore.getState().update(s => { s.heatmapMetric = metric })}
        onDay={iso => { const ws = workouts.filter(w => workoutDay(w) === iso); if (ws.length === 1) workoutDetailSheet(ws[0]); else if (ws.length) calendarSheet(iso); else dayOverrideSheet(iso) }}
      />
    </div>

    <div className="card">
      <div className="row between bw-head" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>{t('Body weight')}</h2>
        <div className="row" style={{ gap: 8 }}>
          <Button size="sm" icon="target" style={S.targetW ? { color: 'var(--yellow)' } : undefined} onClick={goalSheet}>{S.targetW ? fmtNum(S.targetW) : t('Goal')}</Button>
          <Button size="sm" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
        </div>
      </div>
      <Segmented className="seg-range" value={range} onChange={setRange}
        options={rangeOptions()} />
      <div className="chart"><LineChart points={bwPts} h={160} unit={S.unit} goal={S.targetW} /></div>
      {S.bodyweight.length > 0 && <div className="row" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
        <Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={weighInsSheet}>{t('All weigh-ins')}</Button>
      </div>}
    </div>

    {workouts.length > 0 && <>
      <div className="row between" style={{ marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Recent workouts')}</h4>
        <Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={() => nav('/history')}>{t('All')} {workouts.length}</Button>
      </div>
      <div className="list">{[...workouts].reverse().slice(0, 6).map(w => <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} />)}</div>
    </>}
  </>
}
