// 精简模式没有身体图示：统计页、训练完成页和详情页的对应入口在 Lite 下不渲染，
// 这里给它们一个空组件，让 components/BodyMap.jsx 和约 90 KB 的身体路径数据
// 完全不进入精简构建。完整构建不受影响。
const BodyMap = () => null
export const BodyMapLegend = () => null
export default BodyMap
