import { Layout, Menu } from 'antd'
import {
  BarChartOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { Link, Outlet, useLocation } from 'react-router-dom'

const { Header, Content } = Layout

export default function AppLayout() {
  const location = useLocation()
  const selected = location.pathname.startsWith('/data') ? 'data' : 'chat'

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <div className="brand">
          <span className="brand-name">傲基 Agent</span>
          <span className="brand-sub">智能问答 · 经营数据台</span>
        </div>
        <Menu
          mode="horizontal"
          selectedKeys={[selected]}
          style={{ flex: 1, justifyContent: 'flex-end', minWidth: 0, border: 'none' }}
          items={[
            {
              key: 'chat',
              icon: <MessageOutlined />,
              label: <Link to="/chat">智能问答</Link>,
            },
            {
              key: 'data',
              icon: <BarChartOutlined />,
              label: <Link to="/data">数据看板</Link>,
            },
          ]}
        />
      </Header>
      <Content className="app-content">
        <Outlet />
      </Content>
    </Layout>
  )
}
