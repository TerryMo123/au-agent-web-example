import { ConfigProvider, App as AntApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import ChatPage from './pages/ChatPage'
import DataPage from './pages/DataPage'
import 'dayjs/locale/zh-cn'

const theme = {
  token: {
    colorPrimary: '#1F4B3A',
    colorInfo: '#2F6B52',
    colorSuccess: '#3D8B6E',
    colorWarning: '#C4A35A',
    colorError: '#B85C38',
    borderRadius: 8,
    fontFamily:
      '"IBM Plex Sans", "PingFang SC", "Noto Sans SC", system-ui, sans-serif',
  },
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={theme}>
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/chat" replace />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/data" element={<DataPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  )
}
