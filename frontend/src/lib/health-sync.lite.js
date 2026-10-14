// 精简模式 / Lite mode 的 Health Connect 替身（vite.config.js 在 --mode lite 下把
// lib/health-sync.js 指到这里）。
//
// Health Connect 只有安卓 App 才有，web 构建本来就到不了；但 store/useStore.js 会静态引用它，
// 原模块因此连带 health-connect.js 与动作索引进入包。精简版是 web 本机版，两个入口都做成空操作。
export const HEALTH_FILE = 'opengym-health.json'
export const initHealthSync = () => {}
export const syncHealth = async () => {}
export const healthStatus = async () => ({ supported: false, on: false, error: null })
export const loadHealth = async () => ({ on: false, written: {}, at: 0, error: null })
export const enableHealth = async () => {}
export const disableHealth = async () => {}
export const openHealthConnect = async () => {}
export const onHealthChange = () => () => {}
