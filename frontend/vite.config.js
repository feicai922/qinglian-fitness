import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { lazyAssets, stampSw } from './scripts/sw-stamp.mjs'

const backend = process.env.API_TARGET || 'http://127.0.0.1:3000'
// The API refuses a state-changing request that a browser sent from anywhere other than its own
// ORIGIN (the CSRF guard in api/server.js). The dev server is on a different port, so the page's
// real Origin is not ORIGIN — modern browsers get through on Sec-Fetch-Site: same-origin, and
// presenting the expected Origin here covers the ones that don't send it. Match your .env if you
// changed ORIGIN: API_ORIGIN=https://gym.example.com npm run dev
const apiOrigin = process.env.API_ORIGIN || 'http://localhost:8080'
// Exercise media: served straight from catalogue/media in dev (see catalogueMedia below), or
// proxied to a server of your choice with MEDIA_TARGET.
const media = process.env.MEDIA_TARGET
const catalogueMedia = {
  name: 'opengym-catalogue-media',
  configureServer(server) {
    if (media) return
    const dirs = { '/exercise-media/still/': ['still', '.webp'], '/exercise-media/clip/': ['clip', '.mp4'] }
    const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../catalogue/media')
    server.middlewares.use((req, res, next) => {
      const prefix = Object.keys(dirs).find(p => req.url.startsWith(p))
      if (!prefix) return next()
      const [dir, ext] = dirs[prefix]
      const name = decodeURIComponent(req.url.slice(prefix.length).split('?')[0])
      const file = join(root, dir, name)
      if (!/^\d{4,5}\.(webp|mp4)$/.test(name) || !name.endsWith(ext) || !existsSync(file)) { res.statusCode = 404; return res.end() }
      res.setHeader('Content-Type', ext === '.mp4' ? 'video/mp4' : 'image/webp')
      res.end(readFileSync(file))
    })
  }
}

// Optional web analytics (Umami). Injected only when BOTH vars are set at build time,
// so a plain `npm run build` — and every self-hosted install — stays telemetry-free.
// Set for the public instance: VITE_UMAMI_SRC=https://stats.example/script.js VITE_UMAMI_ID=<uuid>
const umamiSrc = process.env.VITE_UMAMI_SRC
const umamiId = process.env.VITE_UMAMI_ID

const umami = {
  name: 'opengym-umami',
  transformIndexHtml() {
    if (!umamiSrc || !umamiId) return
    return [{
      tag: 'script',
      attrs: { defer: true, src: umamiSrc, 'data-website-id': umamiId },
      injectTo: 'head'
    }]
  }
}

// The service worker's cache is named after the build (public/sw.js carries a `__BUILD__`
// placeholder): a deploy is then a new worker with its own cache, and the previous build's
// shell and chunks are dropped on activate instead of piling up under one fixed name. The
// stamp is a hash of the built index.html — it changes exactly when the bundle does.
// The directory is the one this build wrote to (`--outDir` included), not a fixed ./dist/: a
// build into a private outDir left `__BUILD__` unstamped in its sw.js.
// The worker also gets the build's code that loads on demand (`__LAZY__`, scripts/sw-stamp.mjs),
// so it is there offline before the page has ever needed it.
let outDir = fileURLToPath(new URL('./dist/', import.meta.url))
let lazy = []
const swStamp = {
  name: 'opengym-sw-stamp',
  apply: 'build',
  configResolved(config) { outDir = resolve(config.root, config.build.outDir) },
  generateBundle(_, bundle) { lazy = lazyAssets(bundle) },
  closeBundle() {
    const html = join(outDir, 'index.html'), sw = join(outDir, 'sw.js')
    if (!existsSync(html) || !existsSync(sw)) return
    const stamp = createHash('sha256').update(readFileSync(html)).digest('hex').slice(0, 10)
    writeFileSync(sw, stampSw(readFileSync(sw, 'utf8'), { stamp, lazy }))
  }
}

// The phone flavour says so in its index.html. A web build that ran into the same dist/ between
// the mobile build and `cap sync` (two builds in one worktree) shipped the web shell inside an
// APK: no Android-only settings, a service worker, the passkey login. scripts/check-mobile-bundle.mjs
// reads this tag in the synced copy after `cap sync` and fails the build without it.
const flavor = {
  name: 'opengym-flavor',
  transformIndexHtml() {
    if (process.env.VITE_MOBILE !== '1') return
    return [{ tag: 'meta', attrs: { name: 'opengym-flavor', content: 'mobile' }, injectTo: 'head' }]
  }
}

// The version people are asked for in #install-help and on every bug report. Read from
// package.json so it cannot drift from the release it was built in, and inlined at build
// time so no runtime fetch is involved.
//
// APP_BUILD, when the build sets it, is appended as "1.3.8+<build>". A packaged build carries a
// version its package.json cannot know — every image built between two releases reports the same
// number, so the one question a bug report turns on, "which build were you running?", had no
// answer from inside the app. Unset (the ordinary case, and every upstream build) it changes
// nothing: the string is exactly package.json's version.
const pkgVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version
const appVersion = process.env.APP_BUILD ? `${pkgVersion}+${process.env.APP_BUILD}` : pkgVersion

export default defineConfig(({ mode }) => {
  // Lite has no Coach surface at all. Replacing this one module keeps coach-local.js and the
  // server Coach core out of the bundle; the full app, tests and dev server are untouched.
  const lite = mode === 'lite' || process.env.VITE_LITE === '1'
  const liteEmptyPage = fileURLToPath(new URL('./src/views/LiteRemovedPage.jsx', import.meta.url)).replace(/\\/g, '/')
  const liteCoachDevice = fileURLToPath(new URL('./src/lib/coach-device.lite.js', import.meta.url)).replace(/\\/g, '/')
  const litePush = fileURLToPath(new URL('./src/lib/push.lite.js', import.meta.url)).replace(/\\/g, '/')
  // 精简模式没有 gym 打卡/身体图示等页面；这些页面整页替换，深链落到 catch-all。
  // 计划页与训练日编辑（views/Plan.jsx / views/RoutineEdit.jsx）保留：循环排期与
  // 「今天练什么」都在这里，页面内部再按 LITE 收掉分享/进阶等上游功能。
  const litePages = [
    './views/CheckIn.jsx',
    './views/Muscles.jsx',
    './views/StructuralBalance.jsx',
    './views/ProgressPhotos.jsx',
    './views/Measurements.jsx',
    './views/Admin.jsx',
    './views/CoachIntake.jsx',
    './views/CoachSetup.jsx'
  ]
  const liteMuscleExplorer = fileURLToPath(new URL('./src/components/MuscleExplorer.lite.jsx', import.meta.url)).replace(/\\/g, '/')
  return {
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [react(), umami, flavor, swStamp, catalogueMedia],
  base: './',
  resolve: lite ? {
    alias: [
      ...litePages.map(find => ({ find, replacement: liteEmptyPage })),
      {
        find: './views/Stats.jsx',
        replacement: fileURLToPath(new URL('./src/views/Stats.lite.jsx', import.meta.url)).replace(/\\/g, '/')
      },
      {
        find: '../components/BodyMap.jsx',
        replacement: fileURLToPath(new URL('./src/components/BodyMap.lite.jsx', import.meta.url)).replace(/\\/g, '/')
      },
      {
        find: './components/BodyMap.jsx',
        replacement: fileURLToPath(new URL('./src/components/BodyMap.lite.jsx', import.meta.url)).replace(/\\/g, '/')
      },
      { find: '../components/MuscleExplorer.jsx', replacement: liteMuscleExplorer },
      { find: './components/MuscleExplorer.jsx', replacement: liteMuscleExplorer },
      {
        find: './lib/body-paths.js',
        replacement: fileURLToPath(new URL('./src/lib/body-paths.lite.js', import.meta.url)).replace(/\\/g, '/')
      },
      {
        find: '../lib/body-paths.js',
        replacement: fileURLToPath(new URL('./src/lib/body-paths.lite.js', import.meta.url)).replace(/\\/g, '/')
      },
      { find: '../lib/coach-device.js', replacement: liteCoachDevice },
      {
        find: '../lib/coach-api.js',
        replacement: fileURLToPath(new URL('./src/lib/coach-api.lite.js', import.meta.url)).replace(/\\/g, '/')
      },
      // 整页替换：精简模式的首页与设置页不再牵连队列/轮换、账号、同步与推送，
      // 只保留训练日志真正会用到的那几页。
      {
        find: './views/Home.jsx',
        replacement: fileURLToPath(new URL('./src/views/Home.lite.jsx', import.meta.url)).replace(/\\/g, '/')
      },
      {
        find: './views/Settings.jsx',
        replacement: fileURLToPath(new URL('./src/views/Settings.lite.jsx', import.meta.url)).replace(/\\/g, '/')
      },
      // AI 教练在精简版里是自带密钥(BYOK)的本机聊天页：换掉完整的 CoachChat，保留 /coach 路由，
      // 但不牵进服务端 Coach 的提案、状态轮询与 lib/coach-api.js 实现。
      {
        find: './views/CoachChat.jsx',
        replacement: fileURLToPath(new URL('./src/views/CoachChat.lite.jsx', import.meta.url)).replace(/\\/g, '/')
      },
      // 登录与手机配对在精简版里永远不会出现（LITE 恒为访客、MOBILE 为 false），
      // 整页替换后密码注册、邀请码与服务器配对链路不再进入包。
      {
        find: './views/Login.jsx',
        replacement: fileURLToPath(new URL('./src/views/Login.lite.jsx', import.meta.url)).replace(/\\/g, '/')
      },
      {
        find: './views/MobileOnboarding.jsx',
        replacement: fileURLToPath(new URL('./src/views/MobileOnboarding.lite.jsx', import.meta.url)).replace(/\\/g, '/')
      },
      {
        find: './components/SyncBanner.jsx',
        replacement: fileURLToPath(new URL('./src/components/SyncBanner.lite.jsx', import.meta.url)).replace(/\\/g, '/')
      },
      {
        find: '../components/SyncBanner.jsx',
        replacement: fileURLToPath(new URL('./src/components/SyncBanner.lite.jsx', import.meta.url)).replace(/\\/g, '/')
      },
      {
        find: './components/Passkeys.jsx',
        replacement: fileURLToPath(new URL('./src/components/Passkeys.lite.jsx', import.meta.url)).replace(/\\/g, '/')
      },
      {
        find: '../components/Passkeys.jsx',
        replacement: fileURLToPath(new URL('./src/components/Passkeys.lite.jsx', import.meta.url)).replace(/\\/g, '/')
      },
      // 推送与设备令牌：精简版没有账号/服务端，替身只留调用方要用的名字。
      { find: './lib/push.js', replacement: litePush },
      { find: '../lib/push.js', replacement: litePush },
      // 服务器配对与 Health Connect：本机版用不到，做了替身才能把对应链路移出包。
      {
        find: './lib/remote.js',
        replacement: fileURLToPath(new URL('./src/lib/remote.lite.js', import.meta.url)).replace(/\\/g, '/')
      },
      {
        find: '../lib/remote.js',
        replacement: fileURLToPath(new URL('./src/lib/remote.lite.js', import.meta.url)).replace(/\\/g, '/')
      },
      {
        find: './lib/health-sync.js',
        replacement: fileURLToPath(new URL('./src/lib/health-sync.lite.js', import.meta.url)).replace(/\\/g, '/')
      },
      {
        find: '../lib/health-sync.js',
        replacement: fileURLToPath(new URL('./src/lib/health-sync.lite.js', import.meta.url)).replace(/\\/g, '/')
      },
      // 接口层与媒体同步：精简版不做请求，也不上传/下载媒体。
      // 动作库：精简版只装白名单动作（热门家族 + 训练计划，全量 5632 → 301），
      // exercises.js / equipment.js 都从同一个模块取 EXDB，这里换掉即整包生效。
      // 注意：alias 匹配的是「源码里写的导入串」，这两处分别是 src/lib 内的相对写法和
      // 其它目录下 `../lib/...` 的写法。
      {
        find: './exercises-data.js',
        replacement: fileURLToPath(new URL('./src/lib/exercises-data.lite.js', import.meta.url)).replace(/\\/g, '/')
      },
      {
        find: '../lib/exercises-data.js',
        replacement: fileURLToPath(new URL('./src/lib/exercises-data.lite.js', import.meta.url)).replace(/\\/g, '/')
      },
      { find: './lib/api.js', replacement: fileURLToPath(new URL('./src/lib/api.lite.js', import.meta.url)).replace(/\\/g, '/') },
      { find: '../lib/api.js', replacement: fileURLToPath(new URL('./src/lib/api.lite.js', import.meta.url)).replace(/\\/g, '/') },
      { find: './lib/media-sync.js', replacement: fileURLToPath(new URL('./src/lib/media-sync.lite.js', import.meta.url)).replace(/\\/g, '/') },
      { find: '../lib/media-sync.js', replacement: fileURLToPath(new URL('./src/lib/media-sync.lite.js', import.meta.url)).replace(/\\/g, '/') }
    ]
  } : undefined,
  server: {
    // The Coach's core (payload, validator, prompts, HTTP adapters) lives in ../api/coach/core
    // and is imported by the phone build. vite build and vitest already reach it; the dev
    // server needs to be told the workspace is wider than frontend/.
    fs: { allow: ['..'] },
    proxy: {
      '/api': { target: backend, changeOrigin: true, headers: { Origin: apiOrigin } },
      ...(media ? {
        '/exercise-media': { target: media, changeOrigin: true }
      } : {})
    }
  },
  build: { chunkSizeWarningLimit: 1500 }
  }
})
