// 精简模式的 GIF 图源预设。
//
// 动作动画来自练记(lianji-fitness)所用的同一套 Gym visual GIF。构建时通过
// VITE_GIF_MIRROR_BASE 选定默认图源；这里把几个常用镜像列成预设，用户不必重新打包就能切换，
// 也可以填自己的地址（S.gifMirrorBase = null 表示沿用构建时的默认）。
//
// 每个预设的 base 都必须以 / 结尾：gifSrc() 直接拼 `${base}${id}-${media}.gif`。

export const GIF_SOURCE_PRESETS = [
  {
    id: 'jsdelivr',
    label: 'jsDelivr 镜像（默认）',
    base: 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos/',
    note: '全球 CDN，国内通常可达，随构建默认值一起发布。',
  },
  {
    id: 'jsdelivr-fastly',
    label: 'jsDelivr（Fastly 节点）',
    base: 'https://fastly.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos/',
    note: '换一个 CDN 节点，某些网络下比默认更快。',
  },
  {
    id: 'raw-github',
    label: 'GitHub 原始地址（练记同款）',
    base: 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/',
    note: '练记(lianji-fitness)原来用的地址。国内经常较慢，作为兜底。',
  },
]

export const GIF_SOURCE_PRESET_IDS = GIF_SOURCE_PRESETS.map(p => p.id)

const normalize = base => {
  const b = typeof base === 'string' ? base.trim() : ''
  if (!b) return ''
  return b.endsWith('/') ? b : b + '/'
}

/** 哪个预设（或自定义 / 默认）当前生效，给设置项显示与勾选。 */
export function gifSourceChoice(current) {
  if (current === null || current === undefined) return { kind: 'default', id: null }
  const c = normalize(current)
  if (c === '') return { kind: 'off', id: null }
  const hit = GIF_SOURCE_PRESETS.find(p => normalize(p.base) === c)
  return hit ? { kind: 'preset', id: hit.id, base: hit.base } : { kind: 'custom', id: null }
}

/** 预设的短标签，用于设置行右侧的值。 */
export function gifSourceShortLabel(current) {
  const choice = gifSourceChoice(current)
  if (choice.kind === 'default') return '默认'
  if (choice.kind === 'off') return '已关闭'
  if (choice.kind === 'preset') return GIF_SOURCE_PRESETS.find(p => p.id === choice.id).label
  try { return new URL(current).host } catch { return '自定义' }
}
