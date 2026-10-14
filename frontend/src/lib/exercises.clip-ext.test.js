import { afterEach, describe, expect, it, vi } from 'vitest'

// The Android release shows its animations as animated WebP images (VITE_CLIP_EXT=webp); every
// other build keeps the MP4 loops.
describe('gifSrc and VITE_CLIP_EXT', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })
  const ex = { id: '0025', img: '0025.webp', gif: '0025.mp4', fv: '9025' }

  it('names MP4 loops by default', async () => {
    const { gifSrc, isVideoSrc } = await import('./exercises.js')
    expect(gifSrc(ex, 'male')).toBe('exercise-media/clip/0025.mp4')
    expect(gifSrc(ex, 'female')).toBe('exercise-media/clip/9025.mp4')
    expect(isVideoSrc(gifSrc(ex, 'male'))).toBe(true)
  })

  it('names animated WebP images in the Android release', async () => {
    vi.stubEnv('VITE_CLIP_EXT', 'webp')
    const { gifSrc, imgSrc, isVideoSrc } = await import('./exercises.js')
    expect(gifSrc(ex, 'male')).toBe('exercise-media/clip/0025.webp')
    expect(gifSrc(ex, 'female')).toBe('exercise-media/clip/9025.webp')
    expect(isVideoSrc(gifSrc(ex, 'male'))).toBe(false)
    expect(imgSrc(ex, 'male')).toBe('exercise-media/still/0025.webp')
    // a fork's GIF stays a GIF
    expect(gifSrc({ ...ex, gif: '0025.gif', fv: undefined }, 'male')).toBe('exercise-media/clip/0025.gif')
  })
})

// The lianji GIF mirror is a build-time default the user may override or switch off at runtime
// (Settings → GIF 图源, S.gifMirrorBase) — no rebuild, no new APK.
describe('gifSrc runtime mirror base', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })
  const ex = { id: '0025', img: '0025.webp', gif: '0025.mp4', fv: '9025' }

  it('uses the build-time mirror when no runtime value is passed', async () => {
    vi.stubEnv('VITE_GIF_MIRROR_BASE', 'https://cdn.example.com/videos/')
    const { gifSrc } = await import('./exercises.js')
    expect(gifSrc(ex, 'male')).toBe('https://cdn.example.com/videos/0025-EIeI8Vf.gif')
  })

  it('honours a user base and adds the trailing slash it needs', async () => {
    vi.stubEnv('VITE_GIF_MIRROR_BASE', 'https://build.example.com/videos/')
    const { gifSrc, normalizeGifMirrorBase } = await import('./exercises.js')
    expect(normalizeGifMirrorBase('  https://mine.example.com/gif  ')).toBe('https://mine.example.com/gif/')
    expect(gifSrc(ex, 'male', '  https://mine.example.com/gif  ')).toBe('https://mine.example.com/gif/0025-EIeI8Vf.gif')
    expect(gifSrc(ex, 'female', 'https://mine.example.com/gif/')).toBe('https://mine.example.com/gif/0025-EIeI8Vf.gif')
  })

  it('an empty override switches the mirror off and falls back to the CDN loop', async () => {
    vi.stubEnv('VITE_GIF_MIRROR_BASE', 'https://build.example.com/videos/')
    const { gifSrc } = await import('./exercises.js')
    expect(gifSrc(ex, 'male', '')).toBe('exercise-media/clip/0025.mp4')
    expect(gifSrc(ex, 'male', null)).toBe('exercise-media/clip/0025.mp4')
  })

  it('leaves an exercise with no lianji GIF on the CDN loop', async () => {
    vi.stubEnv('VITE_GIF_MIRROR_BASE', 'https://build.example.com/videos/')
    const { gifSrc } = await import('./exercises.js')
    expect(gifSrc({ id: '5965', gif: '5965.mp4' }, 'male', 'https://mine.example.com/gif/'))
      .toBe('exercise-media/clip/5965.mp4')
  })
})
