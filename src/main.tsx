import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initBaiduTongji } from './analytics/baiduTongji'
import './styles.css'

initBaiduTongji()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
