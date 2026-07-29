import { Button, Layout, Menu, Modal, Space, Tag, Typography } from 'antd'
import {
  BarChartOutlined,
  ExclamationCircleOutlined,
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

  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出登录？',
      icon: <ExclamationCircleOutlined />,
      content: '退出后需要重新登录才能继续使用。',
      okText: '确认退出',
      cancelText: '取消',
      okButtonProps: { danger: true },
      centered: true,
      onOk: () => {
        logout()
        navigate('/login', { replace: true })
      },
    })
  }

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
          <Typography.Text className="header-user-name">
            {user?.display_name || user?.username}
          </Typography.Text>
          <Tag
            color={
              user?.role === 'admin' ? 'purple' : isManager ? 'gold' : 'blue'
            }
          >
            {user?.role === 'admin'
              ? '系统管理员'
              : isManager
                ? '运营组长'
                : '运营组员'}
          </Tag>
          <Button
            className="header-logout-btn"
            type="default"
            danger
            ghost
            icon={<LogoutOutlined />}
            onClick={handleLogout}
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
