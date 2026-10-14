// 精简模式的中文动作名清洗。上游动作库保留原始中英对照数据，Lite 构建只在加载
// 中文名称包时做展示层转换，因此搜索仍能匹配英文原名，界面不会出现英文动作段落。

const SHAPE_REPLACEMENTS = [
  // B-stance 在中文健身语境里通常描述前后分腿的站姿。
  [/b式站姿/gi, '分腿站姿'],
  // 拜日式常用数字区分串联顺序。
  [/拜日式a/gi, '拜日式一'],
  [/拜日式b/gi, '拜日式二'],
  // V 形杆/把手与中国器械习惯叫法。
  [/v形杆|v型杆|v形杠|v型杠/gi, '曲杆'],
  [/v形把手|v型把手/gi, '三角把手'],
  [/v形|v型|v字/gi, '屈体'],
  [/y字|y(?=到|滑|转|$)/gi, '斜展'],
  [/t杠/gi, '三角杠'],
  [/t字/gi, '平展'],
  [/t形/gi, '平展'],
  [/w字/gi, '收展'],
  [/w形/gi, '收展形'],
  [/w转/gi, '收展转'],
  [/w(?=推举|$)/gi, '收展'],
  [/(?<=从|转|到)y(?=滑|到|转|$)/gi, '斜展'],
  [/(?<=转|到)t(?=到|$)/gi, '平展'],
  [/l坐/gi, '直角坐'],
  [/l型|l形/gi, '直角'],
  [/x字|x形/gi, '交叉'],
  [/a字/gi, '人字'],
  // Z press / Z 字推举，用中文动作形态描述替代拉丁字母。
  [/z式|z字/gi, '之字'],
]

const WORD_REPLACEMENTS = [
  [/\s*v\.\s*(\d+)/gi, '（第$1式）'],
  // EZ 曲杆是器械名；先处理长词，避免 "EZ杠铃" 被拆坏。
  [/EZ杠铃/gi, '曲杆杠铃'],
  [/EZ杠/gi, '曲杆'],
  [/\bEZ\b/gi, '曲杆'],
  [/pvc管/gi, '塑料管'],
  [/pvc/gi, '塑料管'],
  [/\bRDL\b/gi, '罗马尼亚硬拉'],
  // 常见瑜伽体式梵文名和动作名。
  [/\(\s*setu bandhasana\s*\)/gi, ''],
  [/\bsetu bandhasana\b/gi, '桥式'],
  [/肘支撑planche/gi, '肘水平支撑'],
  [/\bplanche\b/gi, '水平支撑'],
  [/\bfaber\b/gi, '法伯'],
  [/\bjm\b/gi, '窄距'],
]

const PUNCTUATION_REPLACEMENTS = [
  [/\(/g, '（'],
  [/\)/g, '）'],
  [/,/g, '，'],
]

/**
 * Turns every remaining Latin token in a Chinese exercise name into a Chinese
 * equivalent. The mappings are deliberately semantic: "v. 2" becomes "第二式",
 * "EZ bar" becomes "曲杆", and shape codes become their Chinese movement names.
 */
export function chineseExerciseName(name) {
  let out = String(name || '')
  for (const [pattern, replacement] of WORD_REPLACEMENTS) out = out.replace(pattern, replacement)
  for (const [pattern, replacement] of SHAPE_REPLACEMENTS) out = out.replace(pattern, replacement)
  for (const [pattern, replacement] of PUNCTUATION_REPLACEMENTS) out = out.replace(pattern, replacement)
  return out.replace(/\s{2,}/g, ' ').trim()
}

export function chineseExerciseNames(names) {
  return Object.fromEntries(Object.entries(names || {}).map(([id, name]) => [id, chineseExerciseName(name)]))
}
