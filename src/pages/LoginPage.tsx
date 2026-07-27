import { Button, Card, Form, Input, Typography, App } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function LoginPage() {
  const { user, loading, login } = useAuth()
  const location = useLocation()
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const from = (location.state as { from?: string } | null)?.from || '/chat'

  if (!loading && user) {
    return <Navigate to={from} replace />
  }

  return (
    <div className="login-page">
      <Card className="login-card" bordered={false}>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          傲基 Agent
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
          登录后使用智能问答与经营数据台
        </Typography.Paragraph>
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            try {
              await login(values.username, values.password)
              message.success('登录成功')
            } catch (e) {
              message.error(e instanceof Error ? e.message : '登录失败')
            }
          }}
          initialValues={{ username: 'moyong-user' }}
        >
          <Form.Item
            name="username"
            label="账号"
            rules={[{ required: true, message: '请输入账号' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="moyong-manager / moyong-user" size="large" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large">
            登录
          </Button>
        </Form>
        <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}>
          演示账号：组长 moyong-manager / 组员 moyong-user，密码均为 my123456
        </Typography.Paragraph>
      </Card>
    </div>
  )
}
