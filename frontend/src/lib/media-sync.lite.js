// 精简模式 / Lite mode 的媒体同步替身（vite.config.js 在 --mode lite 下把 lib/media-sync.js 指到这里）。
//
// 完整版在设备与服务器之间按内容哈希上传/下载自定义动作与训练照片，并顺带做本地清理和离线预取。
// 精简版没有服务器：本机媒体仍然由 lib/media-store.js 正常保存与读取，但同步循环、上传、下载
// 都不再运行，因此 api.js、media-store-fs 与相关分块不必进入包。

export const createMediaSync = () => ({
  syncMedia: () => {},
  settle: async () => {},
  fetchToStore: async () => { throw new Error('精简版没有服务器媒体') },
  mayFetch: () => false,
  localMediaGc: () => {},
  startCustomMediaPrefetch: () => {},
  start: () => {},
  _setStore: () => {},
})

export const startMediaSync = () => {}
export const syncMedia = () => {}
export const fetchToStore = async () => { throw new Error('精简版没有服务器媒体') }
export const mayFetch = () => false
