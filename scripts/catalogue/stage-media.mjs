#!/usr/bin/env node
// Copies the exercise stills and animations next to a built app, as exercise-media/still and /clip:
//
//   node scripts/catalogue/stage-media.mjs frontend/dist                 web demo, 180 px from catalogue/media
//   node scripts/catalogue/stage-media.mjs frontend/dist --lite          only the Lite exercise whitelist
//   APP_MEDIA_DIR=/private/app node scripts/catalogue/stage-media.mjs frontend/dist
//                                                                        Android package: larger animations
//   VITE_CLIP_EXT=webp APP_MEDIA_DIR=/private/app-webp ...              ... as animated WebP (the release)
//
// The media are licensed from Gym visual for openGym only (catalogue/media/NOTICE.md). 180 px is
// what may sit in the repository, a website or a self-hosted server; anything larger may only
// ever end up inside a compiled app package, so APP_MEDIA_DIR is set by the release build alone
// and points at the maintainer's private copy, never at anything in this repository.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)
const lite = args.includes('--lite')
const outArg = args.find(arg => !arg.startsWith('--'))
const out = path.resolve(outArg || 'frontend/dist')
const media = path.join(ROOT, 'catalogue/media')
const appDir = process.env.APP_MEDIA_DIR
const clipExt = process.env.VITE_CLIP_EXT === 'webp' ? '.webp' : '.mp4'
if (clipExt === '.webp' && !appDir) {
  console.error('VITE_CLIP_EXT=webp needs APP_MEDIA_DIR: the repository only has the MP4 animations')
  process.exit(1)
}

const clipName = file => (clipExt !== '.mp4' && file.endsWith('.mp4') ? file.slice(0, -4) + clipExt : file)
const selected = { still: null, clip: null }
let exerciseCount = 0
if (lite) {
  const dataFile = path.join(ROOT, 'frontend/src/lib/exercises-data.lite.js')
  const { EXDB } = await import(pathToFileURL(dataFile).href)
  exerciseCount = EXDB.length
  selected.still = new Set()
  selected.clip = new Set()
  for (const ex of EXDB) {
    if (ex.img) selected.still.add(ex.img)
    if (ex.gif) selected.clip.add(clipName(ex.gif))
    if (ex.fv) {
      selected.still.add(`${ex.fv}.webp`)
      selected.clip.add(`${ex.fv}${clipExt}`)
    }
    if (ex.mv) {
      selected.still.add(`${ex.mv}.webp`)
      selected.clip.add(`${ex.mv}${clipExt}`)
    }
  }
}

const copyDir = (from, to, ext, wanted) => {
  if (wanted) {
    const missing = [...wanted].filter(f => !fs.existsSync(path.join(from, f)))
    if (missing.length) {
      throw new Error(`${missing.length} selected ${ext} files missing from ${from}: ${missing.slice(0, 10).join(', ')}`)
    }
  }
  fs.mkdirSync(to, { recursive: true })
  let n = 0
  for (const f of fs.readdirSync(from)) {
    if (!f.endsWith(ext)) continue
    if (wanted && !wanted.has(f)) continue
    fs.copyFileSync(path.join(from, f), path.join(to, f))
    n++
  }
  return n
}
const dest = path.join(out, 'exercise-media')
const stills = copyDir(path.join(media, 'still'), path.join(dest, 'still'), '.webp', selected.still)
const clips = copyDir(appDir || path.join(media, 'clip'), path.join(dest, 'clip'), clipExt, selected.clip)
fs.copyFileSync(path.join(media, 'NOTICE.md'), path.join(dest, 'NOTICE.md'))
const scope = lite ? ` (${exerciseCount} Lite exercises)` : ''
console.log(`media: ${stills} stills, ${clips} animations${scope}${appDir ? ' (app size)' : ''} -> ${path.relative(ROOT, out) || out}`)
