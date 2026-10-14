import { describe, expect, it } from 'vitest'
import zhNames from '../exercise-names/zh.js'
import { chineseExerciseName, chineseExerciseNames } from './zh-lite-names.js'

describe('精简模式中文动作名', () => {
  it('把版本号、器械缩写和动作形态统一转成中文', () => {
    expect(chineseExerciseName('杠杆三头肌伸展 v. 2')).toBe('杠杆三头肌伸展（第2式）')
    expect(chineseExerciseName('EZ杠铃窄握弯举')).toBe('曲杆杠铃窄握弯举')
    expect(chineseExerciseName('半跪姿pvc管胸肌活动拉伸')).toBe('半跪姿塑料管胸肌活动拉伸')
    expect(chineseExerciseName('肘支撑planche')).toBe('肘水平支撑')
    expect(chineseExerciseName('桥式瑜伽体式(setu bandhasana)')).toBe('桥式瑜伽体式')
    expect(chineseExerciseName('史密斯jm卧推')).toBe('史密斯窄距卧推')
    expect(chineseExerciseName('俯卧W转T')).toBe('俯卧收展转平展')
  })

  it('补丁应用到整个中文动作库后不再残留拉丁字母', () => {
    const clean = chineseExerciseNames(zhNames)
    const leftovers = Object.entries(clean).filter(([, name]) => /[A-Za-z]/.test(name))
    expect(leftovers).toEqual([])
  })
})
