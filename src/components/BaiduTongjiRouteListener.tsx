import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackBaiduPageview } from '../analytics/baiduTongji'

/** 监听 React Router 变化，向百度统计上报 pageview */
export default function BaiduTongjiRouteListener() {
  const location = useLocation()

  useEffect(() => {
    trackBaiduPageview(`${location.pathname}${location.search}`)
  }, [location.pathname, location.search])

  return null
}
