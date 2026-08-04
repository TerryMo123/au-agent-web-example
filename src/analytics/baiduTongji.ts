/** 百度统计（可选）：优先读 VITE_BAIDU_TONGJI_ID，否则用下方默认站点 ID */

declare global {
  interface Window {
    _hmt?: Array<unknown[]>
  }
}

/** moyong.net 百度统计 hm.js 站点 ID */
const DEFAULT_BAIDU_TONGJI_ID = '0c9d8aab323d726a31b6d312bdcf58a9'

const SCRIPT_ID = 'baidu-tongji-hm'

export function getBaiduTongjiId(): string {
  const fromEnv = (import.meta.env.VITE_BAIDU_TONGJI_ID as string | undefined)?.trim()
  return fromEnv || DEFAULT_BAIDU_TONGJI_ID
}

/** 加载 hm.js；未配置 ID 时跳过 */
export function initBaiduTongji(): void {
  const id = getBaiduTongjiId()
  if (!id || typeof document === 'undefined') return
  if (document.getElementById(SCRIPT_ID)) return

  window._hmt = window._hmt || []
  const hm = document.createElement('script')
  hm.id = SCRIPT_ID
  hm.async = true
  hm.src = `https://hm.baidu.com/hm.js?${id}`
  const first = document.getElementsByTagName('script')[0]
  first?.parentNode?.insertBefore(hm, first)
}

/** SPA 路由变化时补报 PV（百度默认只记首屏） */
export function trackBaiduPageview(path?: string): void {
  if (!getBaiduTongjiId()) return
  const page = path || `${window.location.pathname}${window.location.search}`
  window._hmt = window._hmt || []
  window._hmt.push(['_trackPageview', page])
}
