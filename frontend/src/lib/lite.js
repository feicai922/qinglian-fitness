// 精简模式 / Lite mode (VITE_LITE=1).
//
// This fork is used as a lean, Chinese-first training log — the shape 练记 (lianji-fitness) had:
// an exercise library, a guided workout, a weekly plan, body weight and stats, all on the device.
// Upstream also ships accounts, sync, an AI coach, an admin dashboard, gym-card check-in, progress
// photos, body measurements and structural balance. A lite build leaves every one of those in the
// code and only takes its entry away.
//
// A build flavor, the way VITE_MOBILE already works, and not a profile setting: the ordinary
// `npm run dev` / `npm run build` — and the whole test suite — stay the full app, so the trimmed
// surface can never drift from what a saved profile holds. `npm run dev:lite` and
// `npm run build:lite` read frontend/.env.lite; `VITE_LITE=0` (or dropping the variable) gives the
// whole app back.
//
// Nothing here deletes: a route that is not registered falls through to the catch-all redirect
// (App.jsx), and a settings page, row or card that is not rendered is still in the tree.
export const LITE = import.meta.env.VITE_LITE === '1'
