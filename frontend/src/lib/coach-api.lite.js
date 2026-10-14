// Lite builds never register a Coach route or row. The real API module reaches the phone's
// on-device Coach through dynamic imports, so replacing that one module keeps the whole Coach
// runtime out of the Lite bundle while the untouched screen modules can still be compiled.
import { useEffect } from 'react'

const off = async () => ({ ok: false, enabled: false, job: null, pending: null })

export const awaitedJob = () => null
export const settleAwaited = () => {}
export const requestReview = off
export const requestPlan = off
export const refinePlan = off
export const requestDebrief = off
export const cohortStats = off
export const setCohortShare = async () => ({ ok: true, sharing: false })
export const resolvePending = off
export const forgetCoach = off
export const disclosure = off
export const jobErrorText = () => ''
export const JOB_ERRORS = {}
export const BYOK_ERRORS = {}

export function useCoachStatus(active = true) {
  useEffect(() => {}, [active])
  return { job: null, pending: null, cap: null, loading: false, refresh: off }
}
