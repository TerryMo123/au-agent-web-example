import { Button, Layout, Menu, Space, Tag, Typography } from 'antd'
import {
  BarChartOutlined,
  LogoutOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const { Header, Content } = Layout

export default function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const selected = location.pathname.startsWith('/data') ? 'data' : 'chat'
  const { user, logout, isManager } = useAuth()

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
        <Space style={{ marginLeft: 16 }}>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.85)' }}>
            {user?.display_name || user?.username}
          </Typography.Text>
          <Tag color={isManager ? 'gold' : 'blue'}>
            {isManager ? '运营组长' : '运营组员'}
          </Tag>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            退出
          </Button>
        </Space>
      </Header>
      <Content className="app-content">
        <Outlet />
      </Content>
    </Layout>
  )
}
